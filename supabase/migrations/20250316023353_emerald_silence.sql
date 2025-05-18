/*
  # Add realistic workout history data

  1. Changes
    - Add 12 months of workout logs
    - Create exercise logs with progressive overload
    - Add set logs with realistic progression
    - Follow push/pull/legs split with 2x frequency
*/

-- First, generate workout dates for the past 12 months
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
  '16a68fe7-f215-49cb-9a40-fd928966feb6',
  date,
  date + TIME '18:30:00' -- Typical evening workout time
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
  WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
),
exercise_info AS (
  SELECT id, name 
  FROM ovningar 
  WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
)
INSERT INTO exercise_logs (
  workout_id,
  exercise_id,
  sets,
  reps,
  weight,
  rest_time
)
SELECT 
  w.workout_id,
  e.id as exercise_id,
  5 as sets, -- Always 5 sets
  CASE 
    WHEN w.workout_num % 4 = 0 THEN 3  -- Strength focus
    WHEN w.workout_num % 4 = 1 THEN 5  -- Power
    WHEN w.workout_num % 4 = 2 THEN 8  -- Volume
    ELSE 10                            -- Endurance
  END as reps,
  CASE e.name
    WHEN 'Bänkpress' THEN 
      -- Start at 60kg, progress to ~100kg over the year
      60 + (w.workout_num * 0.2)
    WHEN 'Marklyft' THEN 
      -- Start at 100kg, progress to ~160kg
      100 + (w.workout_num * 0.3)
    WHEN 'Knäböj' THEN 
      -- Start at 80kg, progress to ~130kg
      80 + (w.workout_num * 0.25)
  END as weight,
  180 as rest_time -- 3 minutes rest between sets
FROM workout_data w
CROSS JOIN exercise_info e
WHERE 
  (w.day_of_week IN (1, 4) AND e.name = 'Bänkpress') OR -- Mon/Thu for bench
  (w.day_of_week IN (2, 5) AND e.name = 'Knäböj') OR    -- Tue/Fri for squat
  (w.day_of_week IN (3, 6) AND e.name = 'Marklyft');    -- Wed/Sat for deadlift

-- Insert set logs with realistic progression and variation
WITH exercise_data AS (
  SELECT 
    e.id as exercise_log_id,
    e.exercise_id as ex_id, -- Renamed to avoid ambiguity
    o.name as exercise_name,
    e.weight as target_weight,
    w.date,
    w.id as workout_id, -- Added to avoid ambiguity
    ROW_NUMBER() OVER (PARTITION BY o.name ORDER BY w.date) as progression
  FROM exercise_logs e
  JOIN workout_logs w ON w.id = e.workout_id
  JOIN ovningar o ON o.id = e.exercise_id
  WHERE w.user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
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
    WHEN set_number = 1 THEN ed.target_weight * 0.5  -- 50% warm-up
    WHEN set_number = 2 THEN ed.target_weight * 0.7  -- 70% warm-up
    WHEN set_number = 3 THEN ed.target_weight * 0.85 -- 85% working
    WHEN set_number = 4 THEN ed.target_weight        -- 100% working
    WHEN set_number = 5 THEN                         -- Last set variation
      CASE 
        WHEN ed.progression % 4 = 0 THEN ed.target_weight * 1.05 -- PR attempt
        ELSE ed.target_weight * 0.95 -- Slightly lighter for volume
      END
  END as weight,
  CASE 
    -- Rep schemes vary by exercise and set
    WHEN set_number <= 2 THEN 
      CASE ed.exercise_name
        WHEN 'Bänkpress' THEN 12
        WHEN 'Marklyft' THEN 8
        WHEN 'Knäböj' THEN 10
      END
    ELSE
      CASE 
        WHEN ed.progression % 4 = 0 THEN 3  -- Heavy day
        WHEN ed.progression % 4 = 1 THEN 5  -- Moderate day
        WHEN ed.progression % 4 = 2 THEN 8  -- Volume day
        ELSE 10                             -- Light day
      END
  END as reps,
  CASE 
    WHEN ed.progression % 8 = 7 AND set_number = 5 THEN false -- Occasional failed PR
    ELSE true
  END as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, 5) as set_number;