/*
  # Update progress tracking with volume and 1RM calculations

  1. Changes
    - Add estimated 1RM calculation if not exists
    - Update volume calculation if needed
    - Add indexes for performance
    - Add volume calculation function
*/

-- First check if columns exist and add them if they don't
DO $$ 
BEGIN
  -- Add volume column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'progress_tracking_logs' 
    AND column_name = 'volume'
  ) THEN
    ALTER TABLE progress_tracking_logs
    ADD COLUMN volume decimal GENERATED ALWAYS AS (weight * reps) STORED;
  END IF;

  -- Add estimated_1rm column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'progress_tracking_logs' 
    AND column_name = 'estimated_1rm'
  ) THEN
    ALTER TABLE progress_tracking_logs
    ADD COLUMN estimated_1rm decimal GENERATED ALWAYS AS (
      CASE 
        WHEN reps <= 10 THEN -- Only calculate for sets with 10 or fewer reps
          weight * (1 + (reps::decimal / 30.0))
        ELSE NULL 
      END
    ) STORED;
  END IF;
END $$;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_progress_tracking_volume;
DROP INDEX IF EXISTS idx_progress_tracking_1rm;

-- Create new indexes
CREATE INDEX idx_progress_tracking_volume 
ON progress_tracking_logs(user_id, exercise_id, volume);

CREATE INDEX idx_progress_tracking_1rm 
ON progress_tracking_logs(user_id, exercise_id, reps) 
WHERE reps = 1;

-- Create or replace function to get best volume set
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