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

-- Generate workout dates for 6 months
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '180 days' AS date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM dates
  WHERE date < CURRENT_DATE
),
workout_dates AS (
  SELECT date
  FROM dates
  WHERE EXTRACT(DOW FROM date) IN (1, 3, 5) -- Monday, Wednesday, Friday
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
  date + TIME '17:30:00'
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
  180 as rest_time
FROM workout_data w
CROSS JOIN exercise_info e
WHERE 
  (w.day_of_week = 1 AND e.name = 'Bänkpress') OR  -- Monday: Bench
  (w.day_of_week = 3 AND e.name = 'Marklyft') OR   -- Wednesday: Deadlift
  (w.day_of_week = 5 AND e.name = 'Knäböj');       -- Friday: Squat

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
  CASE ed.exercise_name
    WHEN 'Bänkpress' THEN
      CASE set_number
        WHEN 1 THEN 60  -- Warm-up
        WHEN 2 THEN 80  -- Second warm-up
        WHEN 3 THEN 100 + (ed.progression * 0.5)  -- Working set
        WHEN 4 THEN 100 + (ed.progression * 0.5)  -- Working set
        WHEN 5 THEN 100 + (ed.progression * 0.5)  -- Working set
      END
    WHEN 'Marklyft' THEN
      CASE set_number
        WHEN 1 THEN 100  -- Warm-up
        WHEN 2 THEN 140  -- Second warm-up
        WHEN 3 THEN 180 + (ed.progression * 0.75)  -- Working set
        WHEN 4 THEN 180 + (ed.progression * 0.75)  -- Working set
        WHEN 5 THEN 180 + (ed.progression * 0.75)  -- Working set
      END
    WHEN 'Knäböj' THEN
      CASE set_number
        WHEN 1 THEN 80   -- Warm-up
        WHEN 2 THEN 100  -- Second warm-up
        WHEN 3 THEN 140 + (ed.progression * 0.6)  -- Working set
        WHEN 4 THEN 140 + (ed.progression * 0.6)  -- Working set
        WHEN 5 THEN 140 + (ed.progression * 0.6)  -- Working set
      END
  END as weight,
  CASE 
    WHEN set_number <= 2 THEN 10  -- Warm-up sets
    ELSE 
      CASE 
        WHEN ed.progression % 4 = 0 THEN 5  -- Strength focus
        WHEN ed.progression % 4 = 1 THEN 8  -- Volume focus
        WHEN ed.progression % 4 = 2 THEN 3  -- Heavy day
        ELSE 6                              -- Moderate day
      END
  END as reps,
  true as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, 5) as set_number;