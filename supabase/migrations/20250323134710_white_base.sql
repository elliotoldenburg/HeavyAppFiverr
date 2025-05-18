-- First ensure we have a clean slate for this user
DELETE FROM progress_tracking_logs
WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da';

DELETE FROM set_logs
WHERE exercise_log_id IN (
  SELECT id FROM exercise_logs
  WHERE workout_id IN (
    SELECT id FROM workout_logs
    WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
  )
);

DELETE FROM exercise_logs
WHERE workout_id IN (
  SELECT id FROM workout_logs
  WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
);

DELETE FROM workout_logs
WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da';

-- Generate workout dates for the past year
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '365 days' AS date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM dates
  WHERE date < CURRENT_DATE
),
workout_dates AS (
  -- Select Monday/Thursday for bench, Tuesday/Friday for squat, Wednesday/Saturday for deadlift
  SELECT date
  FROM dates
  WHERE EXTRACT(DOW FROM date) IN (1, 2, 3, 4, 5, 6) -- Mon-Sat
)
-- Create workout logs
INSERT INTO workout_logs (
  id,
  user_id,
  date,
  created_at
)
SELECT 
  gen_random_uuid(),
  'e5acf328-fe80-465d-8e37-e7caaabeb8da',
  date,
  date + TIME '18:30:00' -- Evening workout time
FROM workout_dates;

-- Insert exercise logs with progressive overload
WITH workout_data AS (
  SELECT 
    id as workout_id,
    date,
    EXTRACT(DOW FROM date) as day_of_week,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(DOW FROM date) 
      ORDER BY date
    ) as workout_num
  FROM workout_logs
  WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
),
exercise_info AS (
  SELECT id, name 
  FROM ovningar 
  WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
)
INSERT INTO exercise_logs (
  workout_id,
  exercise_id,
  rest_time
)
SELECT 
  w.workout_id,
  e.id as exercise_id,
  180 as rest_time -- 3 minutes rest between sets
FROM workout_data w
CROSS JOIN exercise_info e
WHERE 
  -- Create a 6-day split
  (w.day_of_week IN (1, 4) AND e.name = 'Bänkpress') OR -- Mon/Thu for bench
  (w.day_of_week IN (2, 5) AND e.name = 'Knäböj') OR    -- Tue/Fri for squat
  (w.day_of_week IN (3, 6) AND e.name = 'Marklyft');    -- Wed/Sat for deadlift

-- Insert set logs with realistic progression
WITH exercise_data AS (
  SELECT 
    e.id as exercise_log_id,
    e.exercise_id,
    o.name as exercise_name,
    w.date,
    ROW_NUMBER() OVER (PARTITION BY o.name ORDER BY w.date) as progression
  FROM exercise_logs e
  JOIN workout_logs w ON w.id = e.workout_id
  JOIN ovningar o ON o.id = e.exercise_id
  WHERE w.user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
)
INSERT INTO set_logs (
  exercise_log_id,
  set_number,
  weight,
  reps,
  completed,
  created_at
)
SELECT 
  ed.exercise_log_id,
  set_number,
  CASE 
    -- Progressive warm-up and working sets
    WHEN set_number = 1 THEN 
      CASE ed.exercise_name
        WHEN 'Bänkpress' THEN 40 + (ed.progression * 0.1) -- Warm-up
        WHEN 'Marklyft' THEN 60 + (ed.progression * 0.2)
        WHEN 'Knäböj' THEN 50 + (ed.progression * 0.15)
      END
    WHEN set_number = 2 THEN
      CASE ed.exercise_name
        WHEN 'Bänkpress' THEN 60 + (ed.progression * 0.15)
        WHEN 'Marklyft' THEN 100 + (ed.progression * 0.25)
        WHEN 'Knäböj' THEN 80 + (ed.progression * 0.2)
      END
    WHEN set_number = 3 THEN
      CASE ed.exercise_name
        WHEN 'Bänkpress' THEN 80 + (ed.progression * 0.2)
        WHEN 'Marklyft' THEN 140 + (ed.progression * 0.3)
        WHEN 'Knäböj' THEN 100 + (ed.progression * 0.25)
      END
    WHEN set_number = 4 THEN
      CASE ed.exercise_name
        WHEN 'Bänkpress' THEN 90 + (ed.progression * 0.25)
        WHEN 'Marklyft' THEN 160 + (ed.progression * 0.35)
        WHEN 'Knäböj' THEN 120 + (ed.progression * 0.3)
      END
    WHEN set_number = 5 THEN
      CASE ed.exercise_name
        WHEN 'Bänkpress' THEN 
          CASE 
            WHEN ed.progression % 4 = 0 THEN 100 + (ed.progression * 0.3) -- PR attempt
            ELSE 85 + (ed.progression * 0.25) -- Back-off set
          END
        WHEN 'Marklyft' THEN
          CASE 
            WHEN ed.progression % 4 = 0 THEN 180 + (ed.progression * 0.4)
            ELSE 150 + (ed.progression * 0.35)
          END
        WHEN 'Knäböj' THEN
          CASE 
            WHEN ed.progression % 4 = 0 THEN 140 + (ed.progression * 0.35)
            ELSE 110 + (ed.progression * 0.3)
          END
      END
  END as weight,
  CASE 
    WHEN set_number <= 2 THEN 
      CASE 
        WHEN ed.progression % 4 = 0 THEN 5  -- Lower reps on PR days
        ELSE 8                              -- Normal warm-up
      END
    ELSE
      CASE 
        WHEN ed.progression % 4 = 0 THEN 
          CASE set_number
            WHEN 5 THEN 1  -- Single rep PR attempt
            ELSE 3        -- Heavy triples
          END
        WHEN ed.progression % 4 = 1 THEN 5  -- Fives
        WHEN ed.progression % 4 = 2 THEN 8  -- Volume
        ELSE 6                              -- Moderate
      END
  END as reps,
  CASE 
    WHEN ed.progression % 8 = 7 AND set_number = 5 THEN false -- Occasional failed PR
    ELSE true
  END as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, 5) as set_number;

-- Insert progress tracking data (will be handled automatically by the trigger)
INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  weight,
  reps,
  workout_date
)
SELECT DISTINCT ON (w.id, e.exercise_id)
  w.user_id,
  w.id as workout_id,
  e.exercise_id,
  s.weight,
  s.reps,
  w.date
FROM workout_logs w
JOIN exercise_logs e ON e.workout_id = w.id
JOIN set_logs s ON s.exercise_log_id = e.id
WHERE 
  w.user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
  AND s.completed = true
ORDER BY 
  w.id,
  e.exercise_id,
  s.weight DESC;