-- Drop the triggers that enforce active cycle requirement
DROP TRIGGER IF EXISTS check_active_cycle_workout ON workout_logs;
DROP TRIGGER IF EXISTS check_active_cycle_weight ON weight_tracking;

-- Drop the functions
DROP FUNCTION IF EXISTS enforce_active_cycle_workout;
DROP FUNCTION IF EXISTS enforce_active_cycle_weight;
DROP FUNCTION IF EXISTS check_active_cycle;

-- Update set_workout_cycle function to be more permissive
CREATE OR REPLACE FUNCTION set_workout_cycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to get the active cycle for this user, but don't require it
  SELECT id INTO NEW.cycle_id
  FROM training_cycles
  WHERE user_id = NEW.user_id
    AND active = true
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LIMIT 1;
  
  -- If no active cycle is found, that's fine - just return NEW
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;