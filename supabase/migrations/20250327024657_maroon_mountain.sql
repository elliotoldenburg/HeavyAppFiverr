-- First modify the training_profiles table to allow NULL training_goal
ALTER TABLE training_profiles
ALTER COLUMN training_goal DROP NOT NULL;

-- Update the cycle state change function to handle NULL values properly
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
    
    -- Set training goal to NULL when cycle ends
    UPDATE training_profiles
    SET training_goal = NULL
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

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';