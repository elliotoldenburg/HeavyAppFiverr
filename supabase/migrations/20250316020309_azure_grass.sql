/*
  # Create progress tracking logs table

  1. New Tables
    - `progress_tracking_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `workout_id` (uuid, references workout_logs)
      - `exercise_id` (uuid, references ovningar)
      - `reps` (integer)
      - `weight` (decimal)
      - `workout_date` (date)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Set up proper constraints and indexes

  3. Triggers
    - Add trigger to automatically track best sets
*/

-- Create the progress tracking logs table
CREATE TABLE public.progress_tracking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES ovningar(id) ON DELETE CASCADE,
  reps integer NOT NULL CHECK (reps > 0),
  weight decimal NOT NULL CHECK (weight > 0),
  workout_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- Ensure only one record per workout per exercise
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

-- Create function to update progress tracking logs
CREATE OR REPLACE FUNCTION update_progress_tracking_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update the best set for this workout and exercise
  INSERT INTO progress_tracking_logs (
    user_id,
    workout_id,
    exercise_id,
    reps,
    weight,
    workout_date
  )
  SELECT 
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
    s.exercise_log_id = NEW.exercise_log_id
    AND s.completed = true
    AND s.weight > 0
  ORDER BY s.weight DESC
  LIMIT 1
  ON CONFLICT (workout_id, exercise_id) 
  DO UPDATE SET
    reps = EXCLUDED.reps,
    weight = EXCLUDED.weight;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update progress tracking
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Backfill existing data
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
  s.weight DESC;