/*
  # Integrate training cycles with workout tracking

  1. Changes
    - Add cycle_id to workout_logs
    - Add cycle_id to progress_tracking_logs
    - Add indexes for performance
    - Update functions to handle cycle relationships
*/

-- Add cycle_id to workout_logs
ALTER TABLE workout_logs
ADD COLUMN cycle_id uuid REFERENCES training_cycles(id) ON DELETE SET NULL;

-- Create index for faster cycle queries
CREATE INDEX idx_workout_logs_cycle 
ON workout_logs(cycle_id);

-- Create function to automatically set cycle_id on workout creation
CREATE OR REPLACE FUNCTION set_workout_cycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the active cycle for this user
  SELECT id INTO NEW.cycle_id
  FROM training_cycles
  WHERE user_id = NEW.user_id
    AND active = true
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set cycle_id automatically
CREATE TRIGGER set_workout_cycle_trigger
  BEFORE INSERT ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_workout_cycle();

-- Update existing workouts with cycle_id
WITH active_cycles AS (
  SELECT id, user_id, start_date, end_date
  FROM training_cycles
  WHERE active = true
)
UPDATE workout_logs w
SET cycle_id = c.id
FROM active_cycles c
WHERE w.user_id = c.user_id
  AND w.date >= c.start_date
  AND (c.end_date IS NULL OR w.date <= c.end_date);

-- Create function to calculate cycle progress
CREATE OR REPLACE FUNCTION calculate_cycle_progress(
  p_cycle_id uuid,
  p_exercise_id uuid
)
RETURNS TABLE (
  start_value decimal,
  current_value decimal,
  percentage_change decimal,
  volume_change decimal
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
  WITH first_workout AS (
    SELECT 
      ptl.weight,
      ptl.reps,
      (ptl.weight * ptl.reps) as volume
    FROM progress_tracking_logs ptl
    JOIN workout_logs w ON w.id = ptl.workout_id
    WHERE w.cycle_id = p_cycle_id
      AND ptl.exercise_id = p_exercise_id
    ORDER BY w.date ASC
    LIMIT 1
  ),
  latest_workout AS (
    SELECT 
      ptl.weight,
      ptl.reps,
      (ptl.weight * ptl.reps) as volume
    FROM progress_tracking_logs ptl
    JOIN workout_logs w ON w.id = ptl.workout_id
    WHERE w.cycle_id = p_cycle_id
      AND ptl.exercise_id = p_exercise_id
    ORDER BY w.date DESC
    LIMIT 1
  )
  SELECT 
    f.weight as start_value,
    l.weight as current_value,
    CASE 
      WHEN f.weight > 0 THEN
        ROUND(((l.weight - f.weight) / f.weight * 100)::numeric, 1)
      ELSE
        0
    END as percentage_change,
    CASE 
      WHEN f.volume > 0 THEN
        ROUND(((l.volume - f.volume) / f.volume * 100)::numeric, 1)
      ELSE
        0
    END as volume_change
  FROM first_workout f
  CROSS JOIN latest_workout l;
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
    cp.*
  FROM cycle_exercises ce
  CROSS JOIN LATERAL calculate_cycle_progress(ce.cycle_id, ce.exercise_id) cp
)
SELECT 
  tc.id as cycle_id,
  tc.goal,
  tc.start_date,
  tc.end_date,
  json_agg(
    json_build_object(
      'exercise_id', ep.exercise_id,
      'start_value', ep.start_value,
      'current_value', ep.current_value,
      'percentage_change', ep.percentage_change,
      'volume_change', ep.volume_change
    )
  ) as exercises_progress
FROM training_cycles tc
LEFT JOIN exercise_progress ep ON ep.cycle_id = tc.id
GROUP BY tc.id, tc.goal, tc.start_date, tc.end_date;