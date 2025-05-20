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

-- Reset exercise_logs structure
ALTER TABLE exercise_logs 
DROP COLUMN IF EXISTS sets,
DROP COLUMN IF EXISTS reps,
DROP COLUMN IF EXISTS weight;

-- Ensure exercise_logs has rest_time
ALTER TABLE exercise_logs
ADD COLUMN IF NOT EXISTS rest_time integer;

-- Reset set_logs structure
ALTER TABLE set_logs
DROP CONSTRAINT IF EXISTS set_logs_reps_check,
DROP CONSTRAINT IF EXISTS unique_set_number_per_exercise,
ALTER COLUMN weight TYPE decimal,
ALTER COLUMN weight SET NOT NULL,
ALTER COLUMN reps SET NOT NULL,
ALTER COLUMN set_number SET NOT NULL,
ADD CONSTRAINT set_logs_reps_check CHECK (reps > 0),
ADD CONSTRAINT unique_set_number_per_exercise UNIQUE (exercise_log_id, set_number);

-- Ensure proper foreign key relationships
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout 
ON exercise_logs(workout_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise 
ON set_logs(exercise_log_id);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can read own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can update own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can delete own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can insert own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can read own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can update own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can delete own set logs" ON set_logs;

-- Enable RLS
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for exercise_logs
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

-- Create policies for set_logs
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

CREATE POLICY "Users can update own set logs"
  ON set_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = exercise_log_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = exercise_log_id
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
      WHERE e.id = exercise_log_id
    )
  );

-- Create function to handle exercise logging
CREATE OR REPLACE FUNCTION handle_exercise_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- If exercise was deleted, remove its progress tracking
  IF TG_OP = 'DELETE' THEN
    DELETE FROM progress_tracking_logs
    WHERE workout_id = OLD.workout_id AND exercise_id = OLD.exercise_id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for exercise_logs
CREATE TRIGGER handle_exercise_changes
  AFTER DELETE ON exercise_logs
  FOR EACH ROW
  EXECUTE FUNCTION handle_exercise_log_changes();

-- Create function to update progress tracking based on sets
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

  -- Find the best set for this workout/exercise
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

-- Create trigger for set_logs
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';