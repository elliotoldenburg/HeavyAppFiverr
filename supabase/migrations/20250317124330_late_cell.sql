/*
  # Update progress tracking to only show working sets

  1. Changes
    - Modify progress tracking function to exclude warm-up sets
    - Only track sets with weight >= 85% of target weight
    - Maintain data integrity and relationships
*/

-- Update the get_best_set_in_range function to exclude warm-up sets
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
  WITH exercise_info AS (
    SELECT 
      el.weight as target_weight
    FROM exercise_logs el
    WHERE el.id = p_exercise_log_id
  ),
  ranked_sets AS (
    SELECT 
      s.reps,
      s.weight,
      -- Rank sets by weight within rep range, only for working sets
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN p_min_reps IS NOT NULL AND p_max_reps IS NOT NULL THEN
              CASE WHEN s.reps BETWEEN p_min_reps AND p_max_reps THEN 1 ELSE 0 END
            ELSE 1
          END
        ORDER BY s.weight DESC
      ) as weight_rank
    FROM set_logs s, exercise_info ei
    WHERE 
      s.exercise_log_id = p_exercise_log_id
      AND s.completed = true
      AND s.weight > 0
      -- Only include sets that are at least 85% of target weight (working sets)
      AND s.weight >= (ei.target_weight * 0.85)
  )
  SELECT 
    rs.reps,
    rs.weight
  FROM ranked_sets rs
  WHERE rs.weight_rank = 1
  LIMIT 1;
END;
$$;

-- Update the progress tracking function to use the modified get_best_set_in_range
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
  
  -- If no sets in common ranges, get the heaviest working set overall
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
      (SELECT exercise_id FROM exercise_logs WHERE id = NEW.exercise_log_id),
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

-- Reprocess existing data with new logic
DELETE FROM progress_tracking_logs;

INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date
)
SELECT DISTINCT ON (el.workout_id, el.exercise_id)
  wl.user_id,
  el.workout_id,
  el.exercise_id,
  s.reps,
  s.weight,
  wl.date
FROM set_logs s
JOIN exercise_logs el ON el.id = s.exercise_log_id
JOIN workout_logs wl ON wl.id = el.workout_id
WHERE 
  s.completed = true 
  AND s.weight > 0
  AND s.weight >= (el.weight * 0.85) -- Only include working sets
ORDER BY 
  el.workout_id, 
  el.exercise_id, 
  s.weight DESC;