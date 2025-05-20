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
DECLARE
  v_old_cycle_id uuid;
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
    -- First find any existing active cycle
    SELECT id INTO v_old_cycle_id
    FROM training_cycles
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND active = true;

    -- If found, deactivate it
    IF v_old_cycle_id IS NOT NULL THEN
      UPDATE training_cycles
      SET 
        active = false,
        end_date = CURRENT_DATE
      WHERE id = v_old_cycle_id;
    END IF;

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

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';