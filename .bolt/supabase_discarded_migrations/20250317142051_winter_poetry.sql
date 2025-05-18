-- First, clear any existing workout data for the user
DELETE FROM workout_logs
WHERE user_id = 'eda42deb-6274-4d36-96bf-43a53ca6cd91';

-- Get exercise IDs
DO $$ 
BEGIN
  -- Ensure exercises exist
  IF NOT EXISTS (SELECT 1 FROM ovningar WHERE name = 'Bänkpress') THEN
    INSERT INTO ovningar (name, category, equipment)
    VALUES ('Bänkpress', 'Bröst', 'Skivstång');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ovningar WHERE name = 'Marklyft') THEN
    INSERT INTO ovningar (name, category, equipment)
    VALUES ('Marklyft', 'Rygg', 'Skivstång');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ovningar WHERE name = 'Knäböj') THEN
    INSERT INTO ovningar (name, category, equipment)
    VALUES ('Knäböj', 'Ben', 'Skivstång');
  END IF;
END $$;

-- Insert workout logs and related data
WITH RECURSIVE dates(date) AS (
  SELECT '2023-03-01'::date as date
  UNION ALL
  SELECT date + interval '1 day'
  FROM dates
  WHERE date < '2025-03-01'::date
),
workout_dates AS (
  SELECT 
    date as workout_date,
    ((date - '2023-03-01'::date)::integer / 7) as training_week
  FROM dates
  WHERE EXTRACT(DOW FROM date) IN (1, 2, 3) -- Monday, Tuesday, Wednesday
),
workout_logs_inserted AS (
  INSERT INTO workout_logs (
    id,
    user_id,
    date,
    created_at
  )
  SELECT 
    gen_random_uuid(),
    'eda42deb-6274-4d36-96bf-43a53ca6cd91',
    workout_date,
    workout_date + interval '18 hours 30 minutes'
  FROM workout_dates
  RETURNING id, date, training_week
),
exercise_logs_inserted AS (
  INSERT INTO exercise_logs (
    workout_id,
    exercise_id,
    sets,
    reps,
    weight,
    rest_time
  )
  SELECT 
    w.id,
    e.id,
    3, -- Always 3 sets
    CASE 
      WHEN e.name = 'Bänkpress' THEN 1  -- 1RM for bench
      WHEN e.name = 'Knäböj' THEN 5     -- 5RM for squat
      ELSE 5                            -- 5 reps for deadlift
    END,
    CASE 
      WHEN e.name = 'Bänkpress' THEN 
        70.2 + (w.training_week * 0.3) -- Progressive increase
      WHEN e.name = 'Knäböj' THEN 
        CASE 
          WHEN w.date >= '2024-04-26' THEN
            90.0 + (((w.date - '2024-04-26'::date)::integer / 7) * 0.5) -- Starts increasing after April 2024
          ELSE 90.0
        END
      WHEN e.name = 'Marklyft' THEN 
        140.0 + (random() * 60) -- Random variation between 140-200kg
    END,
    180 -- 3 minutes rest
  FROM workout_logs_inserted w
  CROSS JOIN (
    SELECT id, name 
    FROM ovningar 
    WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
  ) e
  WHERE 
    (EXTRACT(DOW FROM w.date) = 1 AND e.name = 'Bänkpress') OR -- Monday for bench
    (EXTRACT(DOW FROM w.date) = 2 AND e.name = 'Knäböj') OR    -- Tuesday for squat
    (EXTRACT(DOW FROM w.date) = 3 AND e.name = 'Marklyft')     -- Wednesday for deadlift
  RETURNING id, exercise_id, weight, reps
)
-- Insert set logs
INSERT INTO set_logs (
  exercise_log_id,
  set_number,
  weight,
  reps,
  completed,
  created_at
)
SELECT 
  e.id,
  s.set_number,
  CASE s.set_number
    WHEN 1 THEN round((e.weight * 0.8)::numeric, 1)  -- Warm-up
    WHEN 2 THEN round((e.weight * 0.9)::numeric, 1)  -- Build-up
    WHEN 3 THEN round(e.weight::numeric, 1)          -- Working set
  END,
  e.reps,
  true,
  now() + (s.set_number * interval '5 minutes')
FROM exercise_logs_inserted e
CROSS JOIN (
  SELECT generate_series(1, 3) as set_number
) s;