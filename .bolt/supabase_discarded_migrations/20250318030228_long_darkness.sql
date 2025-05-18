-- Drop and recreate progress_tracking_logs with new schema
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
  -- Make unique constraint simpler to avoid duplicates
  UNIQUE(workout_id, exercise_id, reps)
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

-- Update the progress tracking function to only track working sets
CREATE OR REPLACE FUNCTION update_progress_tracking_logs()
RETURNS TRIGGER AS $$
DECLARE
  workout_user_id uuid;
  workout_date date;
  exercise_id uuid;
  workout_id uuid;
  target_weight decimal;
BEGIN
  -- Get workout info
  SELECT 
    wl.user_id,
    wl.date,
    el.exercise_id,
    wl.id,
    el.weight
  INTO 
    workout_user_id,
    workout_date,
    exercise_id,
    workout_id,
    target_weight
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  JOIN workout_logs wl ON wl.id = el.workout_id
  WHERE s.id = NEW.id
  LIMIT 1;

  -- Insert or update best working set for each unique rep count
  -- Only consider sets that are at least 85% of the target weight
  INSERT INTO progress_tracking_logs (
    user_id,
    workout_id,
    exercise_id,
    reps,
    weight,
    workout_date
  )
  SELECT DISTINCT ON (s.reps)
    workout_user_id,
    workout_id,
    exercise_id,
    s.reps,
    s.weight,
    workout_date
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  WHERE 
    el.workout_id = workout_id
    AND el.exercise_id = exercise_id
    AND s.completed = true
    AND s.weight > 0
    AND s.weight >= (target_weight * 0.85) -- Only include working sets
  ORDER BY 
    s.reps,
    s.weight DESC
  ON CONFLICT (workout_id, exercise_id, reps) 
  DO UPDATE SET
    weight = EXCLUDED.weight
  WHERE EXCLUDED.weight > progress_tracking_logs.weight;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Insert initial data, only including working sets
WITH best_working_sets AS (
  SELECT DISTINCT ON (wl.id, el.exercise_id, s.reps)
    wl.user_id,
    wl.id as workout_id,
    el.exercise_id,
    s.reps,
    s.weight,
    wl.date as workout_date
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  JOIN workout_logs wl ON wl.id = el.workout_id
  WHERE 
    s.completed = true 
    AND s.weight > 0
    AND s.weight >= (el.weight * 0.85) -- Only include working sets
  ORDER BY 
    wl.id,
    el.exercise_id,
    s.reps,
    s.weight DESC
)
INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date
)
SELECT 
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date
FROM best_working_sets;