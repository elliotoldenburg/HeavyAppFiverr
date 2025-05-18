/*
  # Update progress tracking with volume and 1RM calculations

  1. Changes
    - Add volume tracking
    - Add estimated 1RM calculation
    - Add actual 1RM tracking
    - Optimize queries for graph display
*/

-- First update the progress_tracking_logs table
ALTER TABLE progress_tracking_logs
ADD COLUMN volume decimal GENERATED ALWAYS AS (weight * reps) STORED,
ADD COLUMN estimated_1rm decimal GENERATED ALWAYS AS (
  CASE 
    WHEN reps <= 10 THEN -- Only calculate for sets with 10 or fewer reps
      weight * (1 + (reps::decimal / 30.0))
    ELSE NULL 
  END
) STORED;

-- Create indexes for faster querying
CREATE INDEX idx_progress_tracking_volume 
ON progress_tracking_logs(user_id, exercise_id, volume);

CREATE INDEX idx_progress_tracking_1rm 
ON progress_tracking_logs(user_id, exercise_id, reps) 
WHERE reps = 1;

-- Create function to get best volume set for a workout
CREATE OR REPLACE FUNCTION get_best_volume_set(
  p_workout_id uuid,
  p_exercise_id uuid
)
RETURNS TABLE (
  reps integer,
  weight decimal,
  volume decimal
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.reps,
    s.weight,
    (s.reps * s.weight) as volume
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  WHERE 
    el.workout_id = p_workout_id
    AND el.exercise_id = p_exercise_id
    AND s.completed = true
  ORDER BY (s.reps * s.weight) DESC
  LIMIT 1;
END;
$$;