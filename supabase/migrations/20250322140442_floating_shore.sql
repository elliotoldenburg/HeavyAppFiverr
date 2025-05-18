-- First clean up existing data
DELETE FROM progress_tracking_logs;
DELETE FROM set_logs;
DELETE FROM exercise_logs;
DELETE FROM workout_logs;

-- Drop existing constraints and triggers
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
DROP TRIGGER IF EXISTS handle_exercise_changes ON exercise_logs;
DROP FUNCTION IF EXISTS update_progress_tracking_logs CASCADE;
DROP FUNCTION IF EXISTS handle_exercise_log_changes CASCADE;

-- Update exercise_logs structure
ALTER TABLE exercise_logs
DROP CONSTRAINT IF EXISTS valid_exercise_source,
ADD CONSTRAINT valid_exercise_source CHECK (
  (exercise_id IS NOT NULL AND custom_exercise_name IS NULL) OR
  (exercise_id IS NULL AND custom_exercise_name IS NOT NULL)
);

-- Update set_logs structure
ALTER TABLE set_logs
DROP CONSTRAINT IF EXISTS set_logs_reps_check,
ADD CONSTRAINT set_logs_reps_check CHECK (reps > 0);

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout 
ON exercise_logs(workout_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise 
ON set_logs(exercise_log_id);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';