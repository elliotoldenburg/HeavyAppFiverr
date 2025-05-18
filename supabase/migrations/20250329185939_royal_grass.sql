-- First let's analyze and fix the training_cycles table
SELECT * FROM information_schema.columns WHERE table_name = 'training_cycles';

-- Drop existing constraints and triggers
DROP TRIGGER IF EXISTS handle_cycle_state_changes ON training_cycles;
DROP FUNCTION IF EXISTS handle_cycle_state_change CASCADE;

-- Recreate training_cycles table with proper structure
DROP TABLE IF EXISTS training_cycles CASCADE;
CREATE TABLE training_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create indexes for better performance
CREATE INDEX idx_training_cycles_user_active ON training_cycles(user_id, active);
CREATE INDEX idx_training_cycles_active_dates ON training_cycles(user_id, active, start_date) WHERE active = true;

-- Enable RLS
ALTER TABLE training_cycles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own training cycles"
  ON training_cycles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training cycles"
  ON training_cycles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training cycles"
  ON training_cycles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure training_profiles has nullable training_goal
ALTER TABLE training_profiles
ALTER COLUMN training_goal DROP NOT NULL;

-- Create function to handle cycle state changes
CREATE OR REPLACE FUNCTION handle_cycle_state_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this is an UPDATE to deactivate a cycle
  IF TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false THEN
    -- Set end date if not set
    NEW.end_date := COALESCE(NEW.end_date, CURRENT_DATE);
    
    -- Clear training goal
    UPDATE training_profiles
    SET training_goal = NULL
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
  END IF;

  -- If this is a new cycle being activated
  IF NEW.active = true THEN
    -- First deactivate any existing active cycles
    UPDATE training_cycles
    SET 
      active = false,
      end_date = CURRENT_DATE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND active = true;

    -- Set the training goal
    UPDATE training_profiles
    SET training_goal = NEW.goal
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for cycle state changes
CREATE TRIGGER handle_cycle_state_changes
  BEFORE INSERT OR UPDATE ON training_cycles
  FOR EACH ROW
  EXECUTE FUNCTION handle_cycle_state_change();

-- Create function to safely end a cycle
CREATE OR REPLACE FUNCTION end_training_cycle(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the cycle
  UPDATE training_cycles
  SET 
    active = false,
    end_date = CURRENT_DATE
  WHERE id = p_cycle_id
  AND active = true;

  -- Clear training goal from profile
  UPDATE training_profiles
  SET training_goal = NULL
  WHERE user_id = (
    SELECT user_id 
    FROM training_cycles 
    WHERE id = p_cycle_id
  );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_cycle_state_change() TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION end_training_cycle(uuid) TO postgres, authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';