-- First ensure the progress_tracking_logs table has proper constraints
ALTER TABLE progress_tracking_logs
DROP CONSTRAINT IF EXISTS progress_tracking_logs_workout_exercise_key;

-- Recreate the table with proper constraints
CREATE TABLE IF NOT EXISTS progress_tracking_logs_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES ovningar(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  reps integer NOT NULL,
  workout_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workout_id, exercise_id)
);

-- Copy data if any exists
INSERT INTO progress_tracking_logs_new (
  id, user_id, workout_id, exercise_id, weight, reps, workout_date, created_at
)
SELECT 
  id, user_id, workout_id, exercise_id, weight, 
  COALESCE(reps, 1), -- Default to 1 rep if null
  workout_date, created_at
FROM progress_tracking_logs
ON CONFLICT DO NOTHING;

-- Drop old table and rename new one
DROP TABLE progress_tracking_logs;
ALTER TABLE progress_tracking_logs_new RENAME TO progress_tracking_logs;

-- Recreate the logging function with better error handling
CREATE OR REPLACE FUNCTION log_exercise_with_sets(
  p_workout_id uuid,
  p_exercise_id uuid,
  p_rest_time int,
  p_custom_name text,
  p_sets json
)
RETURNS exercise_log_result
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_exercise_log_id uuid;
  top_set record;
  workout_date date;
  workout_user_id uuid;
  result exercise_log_result;
  set_record json;
  set_number int;
BEGIN
  -- Get workout info
  SELECT date, user_id INTO workout_date, workout_user_id
  FROM workout_logs
  WHERE id = p_workout_id;

  IF workout_date IS NULL OR workout_user_id IS NULL THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;

  -- Create exercise log
  INSERT INTO exercise_logs (
    workout_id,
    exercise_id,
    custom_exercise_name,
    rest_time
  ) VALUES (
    p_workout_id,
    p_exercise_id,
    p_custom_name,
    p_rest_time
  )
  RETURNING id INTO new_exercise_log_id;

  -- Find top set (highest weight)
  SELECT (elem->>'weight')::numeric as weight, (elem->>'reps')::int as reps
  INTO top_set
  FROM json_array_elements(p_sets) elem
  WHERE 
    (elem->>'weight')::numeric > 0 AND
    (elem->>'reps')::int > 0
  ORDER BY (elem->>'weight')::numeric DESC
  LIMIT 1;

  -- Insert sets
  set_number := 1;
  FOR set_record IN SELECT * FROM json_array_elements(p_sets)
  LOOP
    -- Only insert valid sets
    IF (set_record->>'weight')::numeric > 0 AND (set_record->>'reps')::int > 0 THEN
      INSERT INTO set_logs (
        exercise_log_id,
        set_number,
        weight,
        reps,
        completed
      ) VALUES (
        new_exercise_log_id,
        set_number,
        (set_record->>'weight')::numeric,
        (set_record->>'reps')::int,
        true
      );
      set_number := set_number + 1;
    END IF;
  END LOOP;

  -- Log progress (top set) only if we found a valid set
  IF top_set.weight IS NOT NULL AND top_set.reps IS NOT NULL THEN
    INSERT INTO progress_tracking_logs (
      user_id,
      workout_id,
      exercise_id,
      weight,
      reps,
      workout_date
    ) VALUES (
      workout_user_id,
      p_workout_id,
      p_exercise_id,
      top_set.weight,
      top_set.reps,
      workout_date
    )
    ON CONFLICT (workout_id, exercise_id) 
    DO UPDATE SET
      weight = EXCLUDED.weight,
      reps = EXCLUDED.reps;
  END IF;

  -- Prepare return value
  SELECT 
    row_to_json(e.*),
    COALESCE(json_agg(row_to_json(s.*)), '[]'::json)
  INTO 
    result.exercise_log,
    result.set_logs
  FROM exercise_logs e
  LEFT JOIN set_logs s ON s.exercise_log_id = e.id
  WHERE e.id = new_exercise_log_id
  GROUP BY e.id;

  RETURN result;
EXCEPTION
  WHEN others THEN
    -- Log error details
    RAISE NOTICE 'Error in log_exercise_with_sets: %', SQLERRM;
    -- Re-raise the error
    RAISE;
END;
$$;