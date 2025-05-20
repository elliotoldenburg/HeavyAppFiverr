/*
  # Fix progress tracking data calculation

  1. Changes
    - Update progress tracking to only show best set per workout
    - Fix volume calculation
    - Ensure proper data filtering
*/

-- First, let's clear existing progress tracking data
DELETE FROM progress_tracking_logs;

-- Create a function to get the best set for a workout
CREATE OR REPLACE FUNCTION get_best_set(
  p_workout_id uuid,
  p_exercise_id uuid
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
  WITH ranked_sets AS (
    SELECT 
      s.reps,
      s.weight,
      (s.weight * s.reps) as volume,
      ROW_NUMBER() OVER (
        ORDER BY (s.weight * s.reps) DESC
      ) as rn
    FROM set_logs s
    JOIN exercise_logs el ON el.id = s.exercise_log_id
    WHERE 
      el.workout_id = p_workout_id
      AND el.exercise_id = p_exercise_id
      AND s.completed = true
      AND s.weight > 0
  )
  SELECT 
    rs.reps,
    rs.weight,
    rs.volume
  FROM ranked_sets rs
  WHERE rs.rn = 1;
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

  -- Get the best set for this workout
  SELECT * INTO best_set 
  FROM get_best_set(
    (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id),
    exercise_id
  );

  -- Only insert if we found a valid set
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
    WHERE (EXCLUDED.weight * EXCLUDED.reps) > (progress_tracking_logs.weight * progress_tracking_logs.reps);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reprocess all existing data
WITH best_sets AS (
  SELECT DISTINCT ON (wl.id, el.exercise_id)
    wl.user_id,
    wl.id as workout_id,
    el.exercise_id,
    s.reps,
    s.weight,
    wl.date as workout_date,
    (s.weight * s.reps) as volume
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN set_logs s ON s.exercise_log_id = el.id
  WHERE 
    s.completed = true 
    AND s.weight > 0
  ORDER BY 
    wl.id,
    el.exercise_id,
    (s.weight * s.reps) DESC
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
FROM best_sets;