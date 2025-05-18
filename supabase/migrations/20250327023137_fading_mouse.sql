-- Create function to handle cycle deactivation
CREATE OR REPLACE FUNCTION handle_cycle_deactivation()
RETURNS TRIGGER AS $$
BEGIN
  -- If cycle is being deactivated, clear training goal from profile
  IF OLD.active = true AND NEW.active = false THEN
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
  AFTER UPDATE ON training_cycles
  FOR EACH ROW
  WHEN (OLD.active = true AND NEW.active = false)
  EXECUTE FUNCTION handle_cycle_deactivation();

-- Create view for cycle history
CREATE OR REPLACE VIEW cycle_history AS
WITH exercise_stats AS (
  SELECT 
    tc.id as cycle_id,
    el.exercise_id,
    o.name as exercise_name,
    MIN(ptl.weight) as start_weight,
    MAX(ptl.weight) as end_weight,
    COUNT(DISTINCT wl.id) as workouts,
    COUNT(DISTINCT sl.id) as total_sets,
    SUM(sl.weight * sl.reps) as total_volume
  FROM training_cycles tc
  LEFT JOIN workout_logs wl ON wl.cycle_id = tc.id
  LEFT JOIN exercise_logs el ON el.workout_id = wl.id
  LEFT JOIN ovningar o ON o.id = el.exercise_id
  LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id
  LEFT JOIN progress_tracking_logs ptl ON ptl.workout_id = wl.id AND ptl.exercise_id = el.exercise_id
  GROUP BY tc.id, el.exercise_id, o.name
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
  COALESCE(
    json_agg(
      json_build_object(
        'exercise_id', es.exercise_id,
        'exercise_name', es.exercise_name,
        'start_weight', es.start_weight,
        'end_weight', es.end_weight,
        'workouts', es.workouts,
        'total_sets', es.total_sets,
        'total_volume', es.total_volume
      )
    ) FILTER (WHERE es.exercise_id IS NOT NULL),
    '[]'
  ) as exercise_summary
FROM training_cycles tc
LEFT JOIN workout_logs wl ON wl.cycle_id = tc.id
LEFT JOIN exercise_logs el ON el.workout_id = wl.id
LEFT JOIN exercise_stats es ON es.cycle_id = tc.id
GROUP BY tc.id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_training_cycles_active_dates
ON training_cycles(user_id, active, start_date)
WHERE active = true;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';