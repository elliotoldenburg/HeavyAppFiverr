/*
  # Update progress tracking system with strength zones

  1. Changes
    - Add strength zone categorization
    - Track best sets per zone
    - Improve data querying for visualization
    - Maintain historical data integrity
*/

-- First create an enum for strength zones
CREATE TYPE strength_zone AS ENUM (
  'max_strength',    -- 1 rep
  'power',          -- 2-3 reps
  'strength',       -- 4-6 reps
  'volume'          -- 7+ reps
);

-- Create a function to calculate estimated 1RM using Brzycki formula
CREATE OR REPLACE FUNCTION calculate_one_rm(weight decimal, reps integer)
RETURNS decimal AS $$
BEGIN
  -- Brzycki formula: 1RM = weight × (36 / (37 - reps))
  -- Only calculate for reps <= 10 (formula becomes less accurate beyond this)
  IF reps <= 10 THEN
    RETURN ROUND((weight * (36.0 / (37.0 - reps)))::numeric, 1);
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to determine strength zone
CREATE OR REPLACE FUNCTION get_strength_zone(reps integer)
RETURNS strength_zone AS $$
BEGIN
  RETURN CASE
    WHEN reps = 1 THEN 'max_strength'::strength_zone
    WHEN reps BETWEEN 2 AND 3 THEN 'power'::strength_zone
    WHEN reps BETWEEN 4 AND 6 THEN 'strength'::strength_zone
    ELSE 'volume'::strength_zone
  END;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate progress_tracking_logs table with updated schema
DROP TABLE IF EXISTS progress_tracking_logs CASCADE;

CREATE TABLE progress_tracking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES ovningar(id) ON DELETE CASCADE,
  reps integer NOT NULL CHECK (reps > 0),
  weight decimal NOT NULL CHECK (weight > 0),
  workout_date date NOT NULL,
  strength_zone strength_zone NOT NULL,
  estimated_1rm decimal,
  is_pr boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  -- Make unique constraint include strength_zone
  UNIQUE(workout_id, exercise_id, strength_zone)
);

-- Create index for faster queries
CREATE INDEX idx_progress_tracking_logs_user_date 
ON progress_tracking_logs(user_id, workout_date);

-- Create a function to determine if a set is a PR
CREATE OR REPLACE FUNCTION is_personal_record(
  p_user_id uuid,
  p_exercise_id uuid,
  p_weight decimal,
  p_reps integer,
  p_date date
)
RETURNS boolean AS $$
DECLARE
  v_zone strength_zone;
  v_previous_max decimal;
BEGIN
  -- Get the strength zone for these reps
  v_zone := get_strength_zone(p_reps);
  
  -- Get the previous max weight for this zone
  SELECT weight INTO v_previous_max
  FROM progress_tracking_logs
  WHERE user_id = p_user_id
    AND exercise_id = p_exercise_id
    AND strength_zone = v_zone
    AND workout_date < p_date
  ORDER BY weight DESC
  LIMIT 1;
  
  -- It's a PR if there's no previous record or the weight is higher
  RETURN v_previous_max IS NULL OR p_weight > v_previous_max;
END;
$$ LANGUAGE plpgsql;

-- Update the progress tracking function
CREATE OR REPLACE FUNCTION update_progress_tracking_logs()
RETURNS TRIGGER AS $$
DECLARE
  workout_user_id uuid;
  workout_date date;
  exercise_id uuid;
  best_set record;
  v_zone strength_zone;
  v_estimated_1rm decimal;
  v_is_pr boolean;
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

  -- Find the best set (heaviest weight per strength zone)
  FOR v_zone IN SELECT unnest(enum_range(NULL::strength_zone)) LOOP
    -- Get the best set for this zone
    SELECT 
      s.weight,
      s.reps
    INTO best_set
    FROM set_logs s
    JOIN exercise_logs el ON el.id = s.exercise_log_id
    WHERE 
      el.workout_id = (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id)
      AND el.exercise_id = exercise_id
      AND s.completed = true
      AND s.weight > 0
      AND get_strength_zone(s.reps) = v_zone
    ORDER BY s.weight DESC, s.reps DESC
    LIMIT 1;

    -- If we found a set for this zone, record it
    IF best_set IS NOT NULL THEN
      -- Calculate estimated 1RM
      v_estimated_1rm := calculate_one_rm(best_set.weight, best_set.reps);
      
      -- Check if this is a PR
      v_is_pr := is_personal_record(
        workout_user_id,
        exercise_id,
        best_set.weight,
        best_set.reps,
        workout_date
      );

      -- Insert or update the progress log for this zone
      INSERT INTO progress_tracking_logs (
        user_id,
        workout_id,
        exercise_id,
        reps,
        weight,
        workout_date,
        strength_zone,
        estimated_1rm,
        is_pr
      )
      VALUES (
        workout_user_id,
        (SELECT workout_id FROM exercise_logs WHERE id = NEW.exercise_log_id),
        exercise_id,
        best_set.reps,
        best_set.weight,
        workout_date,
        v_zone,
        v_estimated_1rm,
        v_is_pr
      )
      ON CONFLICT (workout_id, exercise_id, strength_zone) 
      DO UPDATE SET
        reps = EXCLUDED.reps,
        weight = EXCLUDED.weight,
        estimated_1rm = EXCLUDED.estimated_1rm,
        is_pr = EXCLUDED.is_pr;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for set_logs
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Insert initial data
INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date,
  strength_zone,
  estimated_1rm,
  is_pr
)
SELECT DISTINCT ON (el.workout_id, el.exercise_id, get_strength_zone(s.reps))
  wl.user_id,
  el.workout_id,
  el.exercise_id,
  s.reps,
  s.weight,
  wl.date,
  get_strength_zone(s.reps),
  calculate_one_rm(s.weight, s.reps),
  is_personal_record(wl.user_id, el.exercise_id, s.weight, s.reps, wl.date)
FROM set_logs s
JOIN exercise_logs el ON el.id = s.exercise_log_id
JOIN workout_logs wl ON wl.id = el.workout_id
WHERE 
  s.completed = true 
  AND s.weight > 0
ORDER BY 
  el.workout_id, 
  el.exercise_id,
  get_strength_zone(s.reps),
  s.weight DESC,
  s.reps DESC;