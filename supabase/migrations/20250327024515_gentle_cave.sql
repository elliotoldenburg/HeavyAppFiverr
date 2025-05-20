-- First drop existing triggers and constraints
DROP TRIGGER IF EXISTS handle_cycle_state_changes ON training_cycles;
DROP FUNCTION IF EXISTS handle_cycle_state_change CASCADE;

-- Drop and recreate the unique constraint
ALTER TABLE training_cycles 
DROP CONSTRAINT IF EXISTS unique_active_cycle;

ALTER TABLE training_cycles
ADD CONSTRAINT unique_active_cycle 
  UNIQUE (user_id, active) 
  DEFERRABLE INITIALLY DEFERRED;

-- Create function to handle cycle state changes
CREATE OR REPLACE FUNCTION handle_cycle_state_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_active boolean;
BEGIN
  -- Get the user_id and active status we're working with
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_active := COALESCE(NEW.active, false);

  -- If cycle is being deactivated
  IF (TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false) THEN
    -- Set end date to current date if not already set
    IF NEW.end_date IS NULL THEN
      NEW.end_date := CURRENT_DATE;
    END IF;
    
    -- Clear training goal from profile
    UPDATE training_profiles
    SET training_goal = ''
    WHERE user_id = v_user_id;
  END IF;

  -- If cycle is being activated, deactivate all other cycles
  IF v_active = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.active = false)) THEN
    UPDATE training_cycles
    SET active = false
    WHERE user_id = v_user_id
      AND id != COALESCE(NEW.id, -1)
      AND active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cycle state changes
CREATE TRIGGER handle_cycle_state_changes
  BEFORE INSERT OR UPDATE ON training_cycles
  FOR EACH ROW
  EXECUTE FUNCTION handle_cycle_state_change();

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';