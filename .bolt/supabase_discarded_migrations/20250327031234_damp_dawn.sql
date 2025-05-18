-- First drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_cycle_state_changes ON training_cycles;
DROP FUNCTION IF EXISTS handle_cycle_state_change CASCADE;

-- Create function to handle cycle state changes
CREATE OR REPLACE FUNCTION handle_cycle_state_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If a new cycle is being created or an existing one activated
  IF NEW.active = true THEN
    -- First deactivate any existing active cycle and save its data
    UPDATE training_cycles
    SET 
      active = false,
      end_date = CURRENT_DATE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND active = true;

    -- Update profile with new goal
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

-- Drop and recreate the unique constraint
DO $$ 
BEGIN
  -- Drop the constraint if it exists
  ALTER TABLE training_cycles 
  DROP CONSTRAINT IF EXISTS unique_active_cycle;

  -- Recreate the constraint with proper deferral
  ALTER TABLE training_cycles
  ADD CONSTRAINT unique_active_cycle 
    UNIQUE (user_id, active) 
    DEFERRABLE INITIALLY DEFERRED;
EXCEPTION
  WHEN others THEN
    -- Log error but continue
    RAISE NOTICE 'Error recreating constraint: %', SQLERRM;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_cycle_state_change() TO postgres, authenticated;
GRANT ALL ON training_profiles TO postgres, authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';