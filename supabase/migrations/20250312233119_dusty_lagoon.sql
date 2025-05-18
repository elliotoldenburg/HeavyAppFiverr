/*
  # Add set-by-set tracking to workout logs

  1. Changes
    - Add new table for tracking individual sets
    - Update exercise_logs schema
    - Migrate existing data to new structure

  2. Data Structure
    - Each set can have unique weight and reps
    - Maintain connection to exercise logs
    - Track set order within exercise
*/

-- Create set_logs table for tracking individual sets
CREATE TABLE IF NOT EXISTS set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_log_id uuid REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_number integer NOT NULL,
  weight decimal,
  reps integer NOT NULL,
  completed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(exercise_log_id, set_number)
);

-- Enable RLS
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own set logs"
  ON set_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );

CREATE POLICY "Users can insert own set logs"
  ON set_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );

CREATE POLICY "Users can update own set logs"
  ON set_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );

CREATE POLICY "Users can delete own set logs"
  ON set_logs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );