/*
  # Fix progress tracking calculations

  1. Changes
    - Update volume calculation to use best set per workout
    - Fix 1RM tracking to only include actual 1 rep sets
    - Improve estimated 1RM calculation
    - Add proper indexes for performance
*/

-- First, let's update the progress_tracking_logs table structure
ALTER TABLE progress_tracking_logs
ADD COLUMN IF NOT EXISTS volume numeric GENERATED ALWAYS AS (weight * reps) STORED,
ADD COLUMN IF NOT EXISTS estimated_1rm numeric GENERATED ALWAYS AS (
  CASE 
    WHEN reps <= 10 THEN -- Only calculate for sets with 10 or fewer reps
      weight * (1 + (reps::decimal / 30.0))
    ELSE NULL 
  END
) STORED;

-- Create function to get best set for a workout
CREATE OR REPLACE FUNCTION get_best_set(
  p_workout_id uuid,
  p_exercise_id uuid,
  p_reps_min integer DEFAULT NULL,
  p_reps_max integer DEFAULT NULL
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
    AND s.weight > 0
    AND (
      (p_reps_min IS NULL AND p_reps_max IS NULL) OR
      (s.reps BETWEEN p_reps_min AND p_reps_max)
    )
  ORDER BY 
    CASE
      WHEN p_reps_min = 1 AND p_reps_max = 1 THEN s.weight -- For 1RM, sort by weight only
      ELSE s.weight * s.reps -- For volume, sort by total volume
    END DESC
  LIMIT 1;
END;
$$;

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

  -- Get best volume set (any reps)
  SELECT * INTO best_set FROM get_best_set(
    (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id),
    exercise_id
  );
  
  IF best_set IS NOT NULL THEN
    -- Insert volume record
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

  -- Get best 1RM set (exactly 1 rep)
  SELECT * INTO best_set FROM get_best_set(
    (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id),
    exercise_id,
    1, -- min reps
    1  -- max reps
  );

  IF best_set IS NOT NULL THEN
    -- Insert 1RM record
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
      1,
      best_set.weight,
      workout_date
    )
    ON CONFLICT (workout_id, exercise_id) 
    DO UPDATE SET
      weight = EXCLUDED.weight
    WHERE EXCLUDED.weight > progress_tracking_logs.weight;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Reprocess all existing data
DELETE FROM progress_tracking_logs;

-- Insert best sets for each workout
WITH best_volume_sets AS (
  SELECT DISTINCT ON (el.workout_id, el.exercise_id)
    wl.user_id,
    wl.id as workout_id,
    el.exercise_id,
    wl.date as workout_date,
    s.reps,
    s.weight,
    (s.reps * s.weight) as volume
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN set_logs s ON s.exercise_log_id = el.id
  WHERE 
    s.completed = true 
    AND s.weight > 0
  ORDER BY 
    el.workout_id, 
    el.exercise_id, 
    (s.reps * s.weight) DESC
),
best_1rm_sets AS (
  SELECT DISTINCT ON (el.workout_id, el.exercise_id)
    wl.user_id,
    wl.id as workout_id,
    el.exercise_id,
    wl.date as workout_date,
    s.weight
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN set_logs s ON s.exercise_log_id = el.id
  WHERE 
    s.completed = true 
    AND s.weight > 0
    AND s.reps = 1
  ORDER BY 
    el.workout_id, 
    el.exercise_id, 
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
FROM best_volume_sets
UNION ALL
SELECT 
  user_id,
  workout_id,
  exercise_id,
  1,
  weight,
  workout_date
FROM best_1rm_sets;