-- First drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_cycle_state_changes ON training_cycles;
DROP FUNCTION IF EXISTS handle_cycle_state_change CASCADE;

-- Create function to handle cycle state changes
CREATE OR REPLACE FUNCTION handle_cycle_state_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If a new cycle is being created or an existing one activated
  IF NEW.active = true THEN
    -- First end any existing active cycle
    UPDATE training_cycles
    SET 
      active = false,
      end_date = CURRENT_DATE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND active = true;
  END IF;

  -- Update profile with new goal
  UPDATE training_profiles
  SET training_goal = NEW.goal
  WHERE user_id = NEW.user_id;

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