-- First drop and recreate the unique constraint with proper deferral
ALTER TABLE training_cycles 
DROP CONSTRAINT IF EXISTS unique_active_cycle;

ALTER TABLE training_cycles
ADD CONSTRAINT unique_active_cycle 
  UNIQUE (user_id, active) 
  DEFERRABLE INITIALLY DEFERRED;

-- Create function to handle cycle deactivation
CREATE OR REPLACE FUNCTION handle_cycle_deactivation()
RETURNS TRIGGER AS $$
BEGIN
  -- If cycle is being deactivated, update end date if not set
  IF OLD.active = true AND NEW.active = false THEN
    -- Set end date to current date if not already set
    IF NEW.end_date IS NULL THEN
      NEW.end_date := CURRENT_DATE;
    END IF;
    
    -- Clear training goal from profile
    UPDATE training_profiles
    SET training_goal = ''
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cycle deactivation
DROP TRIGGER IF EXISTS on_cycle_deactivation ON training_cycles;
CREATE TRIGGER on_cycle_deactivation
  BEFORE UPDATE ON training_cycles
  FOR EACH ROW
  WHEN (OLD.active = true AND NEW.active = false)
  EXECUTE FUNCTION handle_cycle_deactivation();

-- Create view for cycle history
CREATE OR REPLACE VIEW cycle_history AS
WITH exercise_stats AS (
  SELECT 
    wl.cycle_id,
    el.exercise_id,
    o.name as exercise_name,
    COUNT(DISTINCT wl.id) as workouts,
    COUNT(DISTINCT sl.id) as total_sets,
    SUM(sl.weight * sl.reps) as total_volume
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN ovningar o ON o.id = el.exercise_id
  JOIN set_logs sl ON sl.exercise_log_id = el.id
  WHERE wl.cycle_id IS NOT NULL
  GROUP BY wl.cycle_id, el.exercise_id, o.name
)
SELECT 
  tc.id,
  tc.user_id,
  tc.goal,
  tc.start_date,
  tc.end_date,
  tc.notes,
  tc.active,
  COUNT(DISTINCT wl.id) as total_workouts,
  COUNT(DISTINCT el.exercise_id) as unique_exercises,
  json_agg(
    json_build_object(
      'exercise_id', es.exercise_id,
      'exercise_name', es.exercise_name,
      'workouts', es.workouts,
      'total_sets', es.total_sets,
      'total_volume', es.total_volume
    )
  ) FILTER (WHERE es.exercise_id IS NOT NULL) as exercise_summary
FROM training_cycles tc
LEFT JOIN workout_logs wl ON wl.cycle_id = tc.id
LEFT JOIN exercise_logs el ON el.workout_id = wl.id
LEFT JOIN exercise_stats es ON es.cycle_id = tc.id
GROUP BY tc.id;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workout_logs_cycle 
ON workout_logs(cycle_id);

CREATE INDEX IF NOT EXISTS idx_training_cycles_user_active 
ON training_cycles(user_id, active);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';