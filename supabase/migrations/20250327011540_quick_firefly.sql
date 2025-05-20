-- Create function to log exercise with sets and cycle tracking
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
  workout_cycle_id uuid;
  result exercise_log_result;
  set_record json;
  set_number int;
BEGIN
  -- Get workout info including cycle_id
  SELECT 
    date, 
    user_id,
    cycle_id
  INTO 
    workout_date,
    workout_user_id,
    workout_cycle_id
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

  -- Find top set (highest volume = weight * reps)
  SELECT 
    (elem->>'weight')::numeric as weight,
    (elem->>'reps')::int as reps
  INTO top_set
  FROM json_array_elements(p_sets) elem
  WHERE 
    (elem->>'weight')::numeric > 0 AND 
    (elem->>'reps')::int > 0
  ORDER BY 
    (elem->>'weight')::numeric * (elem->>'reps')::int DESC
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

  -- Log progress (top volume set)
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
END;
$$;