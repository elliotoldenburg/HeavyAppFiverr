-- First clean up any existing data
DELETE FROM progress_tracking_logs;
DELETE FROM set_logs;
DELETE FROM exercise_logs;
DELETE FROM workout_logs;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS track_exercise_progress ON set_logs;
DROP TRIGGER IF EXISTS handle_exercise_changes ON exercise_logs;
DROP FUNCTION IF EXISTS update_progress_tracking_logs CASCADE;
DROP FUNCTION IF EXISTS handle_exercise_log_changes CASCADE;
DROP FUNCTION IF EXISTS log_exercise_with_sets CASCADE;
DROP TYPE IF EXISTS exercise_log_result CASCADE;

-- Create type for function return
CREATE TYPE exercise_log_result AS (
  exercise_log json,
  set_logs json
);

-- Create the main logging function
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
  top_set json;
  workout_date date;
  workout_user_id uuid;
  result exercise_log_result;
  set_record json;
  set_number int;
BEGIN
  -- Start transaction
  BEGIN
    -- Get workout info
    SELECT date, user_id INTO workout_date, workout_user_id
    FROM workout_logs
    WHERE id = p_workout_id;

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
    SELECT json_agg(s)
    INTO top_set
    FROM (
      SELECT (elem->>'weight')::numeric as weight, (elem->>'reps')::int as reps
      FROM json_array_elements(p_sets) elem
      ORDER BY (elem->>'weight')::numeric DESC
      LIMIT 1
    ) s;

    -- Insert sets
    set_number := 1;
    FOR set_record IN SELECT * FROM json_array_elements(p_sets)
    LOOP
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
    END LOOP;

    -- Log progress (top set)
    IF top_set IS NOT NULL THEN
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
        (top_set->>'weight')::numeric,
        (top_set->>'reps')::int,
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
      -- Rollback on any error
      RAISE;
  END;
END;
$$;