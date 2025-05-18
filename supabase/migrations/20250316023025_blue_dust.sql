/*
  # Fix ambiguous column reference in progress tracking

  1. Changes
    - Update progress tracking function to use explicit table references
    - Fix ambiguous exercise_id reference
    - Maintain all existing functionality
*/

-- Update the progress tracking function with explicit column references
CREATE OR REPLACE FUNCTION update_progress_tracking_logs()
RETURNS TRIGGER AS $$
DECLARE
  workout_user_id uuid;
  workout_date date;
  best_set record;
BEGIN
  -- Get workout info with explicit table references
  SELECT 
    wl.user_id,
    wl.date
  INTO 
    workout_user_id,
    workout_date
  FROM set_logs s
  JOIN exercise_logs el ON el.id = s.exercise_log_id
  JOIN workout_logs wl ON wl.id = el.workout_id
  WHERE s.id = NEW.id
  LIMIT 1;

  -- Find the best set (prioritizing common rep ranges)
  best_set := NULL;
  
  -- Try 1-5 reps (strength)
  IF best_set IS NULL THEN
    SELECT * INTO best_set FROM get_best_set_in_range(NEW.exercise_log_id, 1, 5);
  END IF;
  
  -- Try 6-8 reps (strength/hypertrophy)
  IF best_set IS NULL THEN
    SELECT * INTO best_set FROM get_best_set_in_range(NEW.exercise_log_id, 6, 8);
  END IF;
  
  -- Try 8-12 reps (hypertrophy)
  IF best_set IS NULL THEN
    SELECT * INTO best_set FROM get_best_set_in_range(NEW.exercise_log_id, 8, 12);
  END IF;
  
  -- If no sets in common ranges, get the heaviest set overall
  IF best_set IS NULL THEN
    SELECT * INTO best_set FROM get_best_set_in_range(NEW.exercise_log_id);
  END IF;

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
      (SELECT exercise_id FROM exercise_logs WHERE id = NEW.exercise_log_id), -- Fixed ambiguous reference
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