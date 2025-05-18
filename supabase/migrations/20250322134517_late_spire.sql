/*
  # Add workout management functionality

  1. Changes
    - Add policies for updating and deleting workouts
    - Add cascading deletes for related records
    - Add proper constraints and triggers
*/

-- First ensure we have proper cascading deletes
ALTER TABLE exercise_logs
DROP CONSTRAINT IF EXISTS exercise_logs_workout_id_fkey,
ADD CONSTRAINT exercise_logs_workout_id_fkey
  FOREIGN KEY (workout_id)
  REFERENCES workout_logs(id)
  ON DELETE CASCADE;

ALTER TABLE set_logs
DROP CONSTRAINT IF EXISTS set_logs_exercise_log_id_fkey,
ADD CONSTRAINT set_logs_exercise_log_id_fkey
  FOREIGN KEY (exercise_log_id)
  REFERENCES exercise_logs(id)
  ON DELETE CASCADE;

-- Add policies for workout management
DROP POLICY IF EXISTS "Users can delete own workout logs" ON workout_logs;
CREATE POLICY "Users can delete own workout logs"
  ON workout_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workout logs" ON workout_logs;
CREATE POLICY "Users can update own workout logs"
  ON workout_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add policies for exercise logs
DROP POLICY IF EXISTS "Users can delete own exercise logs" ON exercise_logs;
CREATE POLICY "Users can delete own exercise logs"
  ON exercise_logs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

DROP POLICY IF EXISTS "Users can update own exercise logs" ON exercise_logs;
CREATE POLICY "Users can update own exercise logs"
  ON exercise_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

-- Add policies for set logs
DROP POLICY IF EXISTS "Users can delete own set logs" ON set_logs;
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

DROP POLICY IF EXISTS "Users can update own set logs" ON set_logs;
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

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';