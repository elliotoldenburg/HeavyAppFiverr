-- First clean up existing data
DELETE FROM progress_tracking_logs;
DELETE FROM set_logs;
DELETE FROM exercise_logs;
DELETE FROM workout_logs;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
DROP TRIGGER IF EXISTS handle_exercise_changes ON exercise_logs;
DROP FUNCTION IF EXISTS update_progress_tracking_logs CASCADE;
DROP FUNCTION IF EXISTS handle_exercise_log_changes CASCADE;

-- Remove columns from exercise_logs that should be in set_logs
ALTER TABLE exercise_logs 
DROP COLUMN IF EXISTS sets,
DROP COLUMN IF EXISTS reps,
DROP COLUMN IF EXISTS weight,
DROP COLUMN IF EXISTS rest_time;

-- Add rest_time to exercise_logs (since it's per exercise, not per set)
ALTER TABLE exercise_logs
ADD COLUMN rest_time integer;

-- Update set_logs to ensure it has all needed columns
ALTER TABLE set_logs
DROP CONSTRAINT IF EXISTS set_logs_reps_check,
ADD CONSTRAINT set_logs_reps_check CHECK (reps > 0),
ALTER COLUMN weight TYPE decimal,
ALTER COLUMN weight SET NOT NULL,
ALTER COLUMN reps SET NOT NULL,
ALTER COLUMN set_number SET NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout 
ON exercise_logs(workout_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise 
ON set_logs(exercise_log_id);

-- Drop existing policies before creating new ones
DROP POLICY IF EXISTS "Users can insert own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can read own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can insert own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can read own set logs" ON set_logs;

-- Add RLS policies
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Policies for exercise_logs
CREATE POLICY "Users can insert own exercise logs"
  ON exercise_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

CREATE POLICY "Users can read own exercise logs"
  ON exercise_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

-- Policies for set_logs
CREATE POLICY "Users can insert own set logs"
  ON set_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = exercise_log_id
    )
  );

CREATE POLICY "Users can read own set logs"
  ON set_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = exercise_log_id
    )
  );

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';