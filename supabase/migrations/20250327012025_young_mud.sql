/*
  # Add cycle-based progress tracking

  1. Changes
    - Add functions to get progress within a cycle
    - Add views for cycle-based progress summaries
    - Optimize queries for cycle filtering
*/

-- Create function to get weight progress for a cycle
CREATE OR REPLACE FUNCTION get_cycle_weight_progress(
  p_cycle_id uuid
)
RETURNS TABLE (
  start_weight decimal,
  current_weight decimal,
  total_change decimal,
  percentage_change decimal
) AS $$
DECLARE
  cycle_start_date date;
  cycle_end_date date;
BEGIN
  -- Get cycle dates
  SELECT start_date, COALESCE(end_date, CURRENT_DATE)
  INTO cycle_start_date, cycle_end_date
  FROM training_cycles
  WHERE id = p_cycle_id;

  RETURN QUERY
  WITH first_weight AS (
    SELECT weight_kg
    FROM weight_tracking wt
    JOIN training_cycles tc ON tc.user_id = wt.user_id
    WHERE tc.id = p_cycle_id
      AND wt.date >= cycle_start_date
      AND wt.date <= cycle_end_date
    ORDER BY wt.date ASC
    LIMIT 1
  ),
  latest_weight AS (
    SELECT weight_kg
    FROM weight_tracking wt
    JOIN training_cycles tc ON tc.user_id = wt.user_id
    WHERE tc.id = p_cycle_id
      AND wt.date >= cycle_start_date
      AND wt.date <= cycle_end_date
    ORDER BY wt.date DESC
    LIMIT 1
  )
  SELECT 
    f.weight_kg as start_weight,
    l.weight_kg as current_weight,
    (l.weight_kg - f.weight_kg) as total_change,
    CASE 
      WHEN f.weight_kg > 0 THEN
        ROUND(((l.weight_kg - f.weight_kg) / f.weight_kg * 100)::numeric, 1)
      ELSE 0
    END as percentage_change
  FROM first_weight f
  CROSS JOIN latest_weight l;
END;
$$ LANGUAGE plpgsql;

-- Create function to get exercise progress for a cycle
CREATE OR REPLACE FUNCTION get_cycle_exercise_progress(
  p_cycle_id uuid,
  p_exercise_id uuid
)
RETURNS TABLE (
  start_date date,
  end_date date,
  weight_progress decimal,
  volume_progress decimal,
  best_weight decimal,
  best_volume decimal,
  total_workouts integer
) AS $$
DECLARE
  cycle_start_date date;
  cycle_end_date date;
BEGIN
  -- Get cycle dates
  SELECT start_date, COALESCE(end_date, CURRENT_DATE)
  INTO cycle_start_date, cycle_end_date
  FROM training_cycles
  WHERE id = p_cycle_id;

  RETURN QUERY
  WITH cycle_workouts AS (
    SELECT 
      w.date,
      ptl.weight,
      ptl.reps,
      (ptl.weight * ptl.reps) as volume
    FROM workout_logs w
    JOIN progress_tracking_logs ptl ON ptl.workout_id = w.id
    WHERE w.cycle_id = p_cycle_id
      AND ptl.exercise_id = p_exercise_id
      AND w.date >= cycle_start_date
      AND w.date <= cycle_end_date
    ORDER BY w.date
  ),
  first_workout AS (
    SELECT weight, volume
    FROM cycle_workouts
    ORDER BY date ASC
    LIMIT 1
  ),
  latest_workout AS (
    SELECT weight, volume
    FROM cycle_workouts
    ORDER BY date DESC
    LIMIT 1
  ),
  best_stats AS (
    SELECT 
      MAX(weight) as max_weight,
      MAX(volume) as max_volume,
      COUNT(*) as workout_count
    FROM cycle_workouts
  )
  SELECT 
    cycle_start_date,
    cycle_end_date,
    CASE 
      WHEN f.weight > 0 THEN
        ROUND(((l.weight - f.weight) / f.weight * 100)::numeric, 1)
      ELSE 0
    END as weight_progress,
    CASE 
      WHEN f.volume > 0 THEN
        ROUND(((l.volume - f.volume) / f.volume * 100)::numeric, 1)
      ELSE 0
    END as volume_progress,
    b.max_weight,
    b.max_volume,
    b.workout_count
  FROM first_workout f
  CROSS JOIN latest_workout l
  CROSS JOIN best_stats b;
END;
$$ LANGUAGE plpgsql;

-- Create view for cycle progress summary
CREATE OR REPLACE VIEW cycle_progress_summary AS
WITH cycle_exercises AS (
  SELECT DISTINCT
    w.cycle_id,
    ptl.exercise_id
  FROM workout_logs w
  JOIN progress_tracking_logs ptl ON ptl.workout_id = w.id
  WHERE w.cycle_id IS NOT NULL
),
exercise_progress AS (
  SELECT 
    ce.cycle_id,
    ce.exercise_id,
    gp.*
  FROM cycle_exercises ce
  CROSS JOIN LATERAL get_cycle_exercise_progress(ce.cycle_id, ce.exercise_id) gp
)
SELECT 
  tc.id as cycle_id,
  tc.goal,
  tc.start_date,
  tc.end_date,
  json_agg(
    json_build_object(
      'exercise_id', ep.exercise_id,
      'weight_progress', ep.weight_progress,
      'volume_progress', ep.volume_progress,
      'best_weight', ep.best_weight,
      'best_volume', ep.best_volume,
      'total_workouts', ep.total_workouts
    )
  ) as exercises_progress
FROM training_cycles tc
LEFT JOIN exercise_progress ep ON ep.cycle_id = tc.id
GROUP BY tc.id, tc.goal, tc.start_date, tc.end_date;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workout_logs_cycle_date 
ON workout_logs(cycle_id, date);

CREATE INDEX IF NOT EXISTS idx_weight_tracking_user_date 
ON weight_tracking(user_id, date);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';