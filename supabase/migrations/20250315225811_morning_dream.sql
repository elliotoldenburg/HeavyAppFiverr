-- First remove existing workout data for the user
DELETE FROM workout_logs
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';

-- Insert workout logs with progressive overload
WITH RECURSIVE workout_dates AS (
  SELECT CURRENT_DATE - INTERVAL '180 days' AS date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM workout_dates
  WHERE date < CURRENT_DATE
),
training_days AS (
  SELECT date
  FROM workout_dates
  WHERE EXTRACT(DOW FROM date) IN (1, 3, 5) -- Monday, Wednesday, Friday
)
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
  date + TIME '18:30:00'
FROM training_days;

-- Insert exercise logs showing progression
WITH workout_data AS (
  SELECT 
    id as workout_id,
    date,
    ROW_NUMBER() OVER (ORDER BY date) as workout_num
  FROM workout_logs
  WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
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
  3 as sets, -- Always 3 sets
  CASE 
    WHEN w.workout_num % 4 = 0 THEN '3-5' -- Heavy day
    WHEN w.workout_num % 4 = 1 THEN '8-10' -- Volume day
    ELSE '5-7' -- Normal day
  END as reps,
  CASE e.name
    WHEN 'Bänkpress' THEN 
      -- Progressive overload from 60kg to 85kg
      60 + (w.workout_num * 0.3)
    WHEN 'Marklyft' THEN 
      -- Progressive overload from 100kg to 140kg
      100 + (w.workout_num * 0.5)
    WHEN 'Knäböj' THEN 
      -- Progressive overload from 80kg to 110kg
      80 + (w.workout_num * 0.4)
  END as weight,
  180 as rest_time -- 3 minutes rest between sets
FROM workout_data w
CROSS JOIN (
  SELECT id, name 
  FROM ovningar 
  WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
) e
WHERE 
  -- Create a push/pull/legs split
  (EXTRACT(DOW FROM w.date) = 1 AND e.name IN ('Bänkpress')) OR -- Push day
  (EXTRACT(DOW FROM w.date) = 3 AND e.name IN ('Marklyft')) OR -- Pull day
  (EXTRACT(DOW FROM w.date) = 5 AND e.name IN ('Knäböj')); -- Legs day

-- Insert set logs for each exercise (3 working sets only)
WITH exercise_data AS (
  SELECT 
    e.id as exercise_log_id,
    e.exercise_id,
    o.name as exercise_name,
    e.weight as target_weight,
    w.date,
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
  CASE set_number
    WHEN 3 THEN 
      CASE 
        WHEN ed.progression % 4 = 0 THEN ed.target_weight * 1.05 -- PR attempt on last set every 4th session
        ELSE ed.target_weight
      END
    ELSE ed.target_weight
  END as weight,
  CASE 
    WHEN ed.progression % 4 = 0 THEN -- Heavy day
      CASE set_number
        WHEN 3 THEN 3 -- Last set is heaviest with fewer reps
        ELSE 5
      END
    WHEN ed.progression % 4 = 1 THEN -- Volume day
      8
    ELSE -- Normal day
      5
  END as reps,
  CASE 
    WHEN ed.progression % 8 = 7 AND set_number = 3 THEN false -- Occasional failed PR attempt
    ELSE true
  END as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, 3) as set_number; -- Only 3 sets

-- Insert progress tracking data for main lifts
WITH workout_data AS (
  SELECT 
    date,
    ROW_NUMBER() OVER (ORDER BY date) as training_week
  FROM workout_logs
  WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
  AND EXTRACT(DOW FROM date) = 1 -- Track progress on Mondays
)
INSERT INTO progress_tracking (
  user_id,
  date,
  exercise_id,
  max_weight,
  total_reps,
  created_at
)
SELECT 
  '16a68fe7-f215-49cb-9a40-fd928966feb6',
  w.date,
  e.id,
  CASE e.name
    WHEN 'Bänkpress' THEN 60 + (w.training_week * 0.5) -- Progressive increase
    WHEN 'Marklyft' THEN 100 + (w.training_week * 0.75)
    WHEN 'Knäböj' THEN 80 + (w.training_week * 0.6)
  END as max_weight,
  CASE 
    WHEN w.training_week % 4 = 0 THEN 3 -- Testing max
    ELSE 5 -- Normal training
  END as total_reps,
  w.date + TIME '18:30:00'
FROM workout_data w
CROSS JOIN (
  SELECT id, name 
  FROM ovningar 
  WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
) e;