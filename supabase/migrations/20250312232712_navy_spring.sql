/*
  # Add realistic workout history for user

  1. Changes
    - Add 6 months of workout logs with progressive overload
    - Add weight tracking data showing gradual improvement
    - Add progress tracking data for key exercises
    - Show realistic progression in strength and volume

  2. Data Structure
    - 3-4 workouts per week
    - Progressive overload on main lifts
    - Realistic weight and rep ranges
    - Weight tracking showing body composition changes
*/

-- Insert weight tracking data showing progress over 6 months
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '180 days' AS date
  UNION ALL
  SELECT date + INTERVAL '7 days'
  FROM dates
  WHERE date < CURRENT_DATE
)
INSERT INTO weight_tracking (user_id, date, weight_kg)
SELECT 
  '16a68fe7-f215-49cb-9a40-fd928966feb6',
  date,
  -- Start at 85kg, gradually decrease to 80kg while building muscle
  85 - (ROW_NUMBER() OVER (ORDER BY date) * 0.15)
FROM dates;

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
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 5
    ELSE 4
  END as sets,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 
      CASE 
        WHEN w.workout_num % 4 = 0 THEN '3-5' -- Heavy day
        WHEN w.workout_num % 4 = 1 THEN '8-10' -- Volume day
        ELSE '5-7' -- Normal day
      END
    ELSE '8-12'
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
    WHEN 'Axelpress' THEN
      -- Progressive overload from 40kg to 55kg
      40 + (w.workout_num * 0.2)
    ELSE 
      -- Accessory exercises with slower progression
      20 + (w.workout_num * 0.1)
  END as weight,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 180
    ELSE 90
  END as rest_time
FROM workout_data w
CROSS JOIN (
  SELECT id, name 
  FROM ovningar 
  WHERE name IN (
    'Bänkpress', 'Marklyft', 'Knäböj', 
    'Axelpress', 'Hantelcurl', 'Triceps pushdown',
    'Latsdrag', 'Rodd'
  )
) e
WHERE 
  -- Create a push/pull/legs split
  (EXTRACT(DOW FROM w.date) = 1 AND e.name IN ('Bänkpress', 'Axelpress', 'Triceps pushdown')) OR -- Push day
  (EXTRACT(DOW FROM w.date) = 3 AND e.name IN ('Marklyft', 'Latsdrag', 'Rodd', 'Hantelcurl')) OR -- Pull day
  (EXTRACT(DOW FROM w.date) = 5 AND e.name IN ('Knäböj', 'Bänkpress', 'Marklyft')); -- Legs + compounds

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