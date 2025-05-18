/*
  # Fix progress tracking to only show best sets

  1. Changes
    - Update progress tracking function to only track best sets
    - Ensure correct weight values in graphs
    - Handle multiple sets with same reps correctly
    - Fix duplicate key violations
*/

-- Update the progress tracking function to handle best sets properly
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
      weight = EXCLUDED.weight
    WHERE EXCLUDED.weight >= progress_tracking_logs.weight;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reprocess all existing data with the new logic
DELETE FROM progress_tracking_logs;

-- Insert best sets for each workout/exercise combination
WITH ranked_sets AS (
  SELECT 
    wl.user_id,
    wl.id as workout_id,
    el.exercise_id,
    s.reps,
    s.weight,
    wl.date as workout_date,
    ROW_NUMBER() OVER (
      PARTITION BY wl.id, el.exercise_id 
      ORDER BY s.weight DESC, s.reps DESC
    ) as rn
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  JOIN workout_logs wl ON wl.id = el.workout_id
  WHERE 
    s.completed = true 
    AND s.weight > 0
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
FROM ranked_sets
WHERE rn = 1;