/*
  # Simplify progress tracking table

  1. Changes
    - Remove strength zone related columns
    - Keep basic tracking functionality
    - Maintain data integrity
*/

-- First drop the strength_zone enum type and related columns
DROP TYPE IF EXISTS strength_zone CASCADE;

-- Drop and recreate the table with simpler schema
DROP TABLE IF EXISTS progress_tracking_logs CASCADE;

CREATE TABLE progress_tracking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES ovningar(id) ON DELETE CASCADE,
  reps integer NOT NULL CHECK (reps > 0),
  weight decimal NOT NULL CHECK (weight > 0),
  workout_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- Make unique constraint simpler
  UNIQUE(workout_id, exercise_id)
);

-- Create index for faster queries
CREATE INDEX idx_progress_tracking_logs_user_date 
ON progress_tracking_logs(user_id, workout_date);

-- Enable RLS
ALTER TABLE progress_tracking_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own progress logs"
  ON progress_tracking_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update the progress tracking function
CREATE OR REPLACE FUNCTION update_progress_tracking_logs()
RETURNS TRIGGER AS $$
DECLARE
  workout_user_id uuid;
  workout_date date;
  exercise_id uuid;
  best_set record;
BEGIN
  -- Get workout info
  SELECT 
    wl.user_id,
    wl.date,
    el.exercise_id
  INTO 
    workout_user_id,
    workout_date,
    exercise_id
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  JOIN workout_logs wl ON wl.id = el.workout_id
  WHERE s.id = NEW.id
  LIMIT 1;

  -- Find the best set (heaviest weight for given reps)
  SELECT 
    s.reps,
    s.weight
  INTO best_set
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  WHERE 
    el.workout_id = (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id)
    AND el.exercise_id = exercise_id
    AND s.completed = true
    AND s.weight > 0
  ORDER BY s.weight DESC, s.reps DESC
  LIMIT 1;

  -- Update progress tracking if we found a valid set
  IF best_set IS NOT NULL THEN
    INSERT INTO progress_tracking_logs (
      user_id,
      workout_id,
      exercise_id,
      reps,
      weight,
      workout_date
    )
    VALUES (
      workout_user_id,
      (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id),
      exercise_id,
      best_set.reps,
      best_set.weight,
      workout_date
    )
    ON CONFLICT (workout_id, exercise_id) 
    DO UPDATE SET
      reps = EXCLUDED.reps,
      weight = EXCLUDED.weight;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Reinsert data from existing logs
INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date
)
SELECT DISTINCT ON (el.workout_id, el.exercise_id)
  wl.user_id,
  el.workout_id,
  el.exercise_id,
  s.reps,
  s.weight,
  wl.date
FROM set_logs s
JOIN exercise_logs el ON el.id = s.exercise_log_id
JOIN workout_logs wl ON wl.id = el.workout_id
WHERE 
  s.completed = true 
  AND s.weight > 0
ORDER BY 
  el.workout_id, 
  el.exercise_id,
  s.weight DESC,
  s.reps DESC;