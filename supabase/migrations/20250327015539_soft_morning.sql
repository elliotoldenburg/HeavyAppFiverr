-- Create function to check if user has active cycle
CREATE OR REPLACE FUNCTION check_active_cycle(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM training_cycles
    WHERE user_id = $1
      AND active = true
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );
END;
$$;

-- Create trigger function to enforce active cycle requirement for workout logs
CREATE OR REPLACE FUNCTION enforce_active_cycle_workout()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT check_active_cycle(NEW.user_id) THEN
    RAISE EXCEPTION 'No active training cycle found. Please start a new cycle to log workouts.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to enforce active cycle requirement for weight tracking
CREATE OR REPLACE FUNCTION enforce_active_cycle_weight()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT check_active_cycle(NEW.user_id) THEN
    RAISE EXCEPTION 'No active training cycle found. Please start a new cycle to log weight.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS check_active_cycle_workout ON workout_logs;
CREATE TRIGGER check_active_cycle_workout
  BEFORE INSERT ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_cycle_workout();

DROP TRIGGER IF EXISTS check_active_cycle_weight ON weight_tracking;
CREATE TRIGGER check_active_cycle_weight
  BEFORE INSERT ON weight_tracking
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_cycle_weight();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_training_cycles_active_dates
ON training_cycles(user_id, active, start_date)
WHERE active = true;

-- Create view for cycle history with pre-aggregated exercise data
CREATE OR REPLACE VIEW cycle_history AS
WITH exercise_stats AS (
  SELECT 
    tc.id as cycle_id,
    el.exercise_id,
    o.name as exercise_name,
    MAX(ptl.weight) as best_weight,
    COUNT(DISTINCT sl.id) as total_sets
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
        'best_weight', es.best_weight,
        'total_sets', es.total_sets
      )
    ) FILTER (WHERE es.exercise_id IS NOT NULL),
    '[]'
  ) as exercise_summary
FROM training_cycles tc
LEFT JOIN workout_logs wl ON wl.cycle_id = tc.id
LEFT JOIN exercise_logs el ON el.workout_id = wl.id
LEFT JOIN exercise_stats es ON es.cycle_id = tc.id
GROUP BY tc.id;

-- Create function to get cycle progress
CREATE OR REPLACE FUNCTION get_cycle_progress(p_cycle_id uuid)
RETURNS TABLE (
  exercise_name text,
  start_weight numeric,
  end_weight numeric,
  percentage_change numeric,
  total_volume numeric,
  total_sets bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH exercise_data AS (
    SELECT 
      o.name,
      wl.date,
      ptl.weight,
      COUNT(DISTINCT sl.id) as sets,
      SUM(sl.weight * sl.reps) as volume
    FROM training_cycles tc
    JOIN workout_logs wl ON wl.cycle_id = tc.id
    JOIN exercise_logs el ON el.workout_id = wl.id
    JOIN ovningar o ON o.id = el.exercise_id
    JOIN set_logs sl ON sl.exercise_log_id = el.id
    JOIN progress_tracking_logs ptl ON ptl.workout_id = wl.id AND ptl.exercise_id = el.exercise_id
    WHERE tc.id = p_cycle_id
    GROUP BY o.name, wl.date, ptl.weight
  ),
  first_last_weights AS (
    SELECT 
      name,
      FIRST_VALUE(weight) OVER (PARTITION BY name ORDER BY date) as first_weight,
      FIRST_VALUE(weight) OVER (PARTITION BY name ORDER BY date DESC) as last_weight,
      SUM(volume) as total_volume,
      SUM(sets) as total_sets
    FROM exercise_data
    GROUP BY name, date, weight
  )
  SELECT DISTINCT
    name,
    first_weight,
    last_weight,
    ROUND(((last_weight - first_weight) / first_weight * 100)::numeric, 1),
    SUM(total_volume) OVER (PARTITION BY name),
    SUM(total_sets) OVER (PARTITION BY name)
  FROM first_last_weights
  ORDER BY name;
END;
$$;