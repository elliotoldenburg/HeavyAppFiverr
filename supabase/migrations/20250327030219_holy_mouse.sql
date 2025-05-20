-- First drop existing triggers and functions
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
RETURNS TRIGGER
SECURITY DEFINER -- This ensures the function runs with elevated privileges
SET search_path = public -- Explicitly set search path for security
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

-- Drop existing view if it exists
DROP VIEW IF EXISTS cycle_progress_summary;

-- Create view for cycle progress summary
CREATE VIEW cycle_progress_summary AS
WITH cycle_exercises AS (
  SELECT DISTINCT
    w.cycle_id,
    ptl.exercise_id,
    o.name as exercise_name,
    ptl.weight,
    w.date,
    tc.goal,
    tc.start_date,
    tc.end_date
  FROM workout_logs w
  JOIN progress_tracking_logs ptl ON ptl.workout_id = w.id
  JOIN ovningar o ON o.id = ptl.exercise_id
  JOIN training_cycles tc ON tc.id = w.cycle_id
  WHERE w.cycle_id IS NOT NULL
),
exercise_progress AS (
  SELECT 
    cycle_id,
    goal,
    start_date,
    end_date,
    exercise_id,
    exercise_name,
    FIRST_VALUE(weight) OVER (
      PARTITION BY cycle_id, exercise_id 
      ORDER BY date
    ) as start_weight,
    LAST_VALUE(weight) OVER (
      PARTITION BY cycle_id, exercise_id 
      ORDER BY date
      RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as end_weight
  FROM cycle_exercises
)
SELECT 
  cycle_id,
  goal,
  start_date,
  end_date,
  json_agg(
    json_build_object(
      'exercise_id', exercise_id,
      'exercise_name', exercise_name,
      'start_weight', start_weight,
      'end_weight', end_weight,
      'percentage_change', 
      CASE 
        WHEN start_weight > 0 THEN
          ROUND(((end_weight - start_weight) / start_weight * 100)::numeric, 1)
        ELSE 0
      END
    )
  ) as exercises_progress
FROM exercise_progress
GROUP BY cycle_id, goal, start_date, end_date;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_cycle_state_change() TO postgres, authenticated;
GRANT ALL ON training_profiles TO postgres, authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';