/*
  # Update progress tracking with rep range support

  1. Changes
    - Add rep range support to progress tracking
    - Improve update trigger to handle rep ranges
    - Add function to find best set within rep range
    - Ensure proper handling of workout edits

  2. Data Preservation
    - Keep existing data intact
    - Add new functionality without breaking existing
*/

-- First create a helper function to find the best set within a rep range
CREATE OR REPLACE FUNCTION get_best_set_in_range(
  p_exercise_log_id uuid,
  p_min_reps integer DEFAULT NULL,
  p_max_reps integer DEFAULT NULL
)
RETURNS TABLE (
  reps integer,
  weight decimal
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_sets AS (
    SELECT 
      s.reps,
      s.weight,
      -- Rank sets by weight within rep range
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN p_min_reps IS NOT NULL AND p_max_reps IS NOT NULL THEN
              CASE WHEN s.reps BETWEEN p_min_reps AND p_max_reps THEN 1 ELSE 0 END
            ELSE 1
          END
        ORDER BY s.weight DESC
      ) as weight_rank
    FROM set_logs s
    WHERE 
      s.exercise_log_id = p_exercise_log_id
      AND s.completed = true
      AND s.weight > 0
  )
  SELECT 
    rs.reps,
    rs.weight
  FROM ranked_sets rs
  WHERE rs.weight_rank = 1
  LIMIT 1;
END;
$$;

-- Update the progress tracking function to use rep ranges
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

-- Drop existing trigger
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;

-- Create new trigger that handles both inserts and updates
CREATE TRIGGER track_exercise_progress
  AFTER INSERT OR UPDATE OR DELETE ON set_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_tracking_logs();

-- Add trigger for exercise_logs changes to ensure progress is updated
CREATE OR REPLACE FUNCTION handle_exercise_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- If exercise was deleted, remove its progress tracking
  IF TG_OP = 'DELETE' THEN
    DELETE FROM progress_tracking_logs
    WHERE workout_id = OLD.workout_id AND exercise_id = OLD.exercise_id;
    RETURN OLD;
  END IF;

  -- For updates, recalculate the best set
  IF TG_OP = 'UPDATE' THEN
    -- Trigger progress recalculation by updating a set
    UPDATE set_logs
    SET updated_at = now()
    WHERE exercise_log_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for exercise_logs
CREATE TRIGGER handle_exercise_changes
  AFTER UPDATE OR DELETE ON exercise_logs
  FOR EACH ROW
  EXECUTE FUNCTION handle_exercise_log_changes();

-- Add index for rep range queries
CREATE INDEX idx_set_logs_reps_weight
ON set_logs(exercise_log_id, reps, weight)
WHERE completed = true AND weight > 0;