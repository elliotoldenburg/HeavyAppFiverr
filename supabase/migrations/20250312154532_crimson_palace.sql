/*
  # Add sample workout and progress data for testing

  1. Changes
    - Add workout logs spanning the last month
    - Add exercise logs with varying weights and reps
    - Add progress tracking data to show improvements
    - Use realistic progression in weights and volumes

  2. Data Structure
    - Multiple workouts per week
    - Various exercises with progressive overload
    - Progress tracking for key metrics
*/

-- Insert workout logs for the past month
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '30 days' AS date
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
INSERT INTO workout_logs (
  id,
  user_id,
  date,
  created_at,
  total_weight_lifted,
  total_sets,
  total_reps
)
SELECT 
  gen_random_uuid(),
  '16a68fe7-f215-49cb-9a40-fd928966feb6',
  date,
  date + INTERVAL '18 hours 30 minutes',
  -- Increase total weight over time
  5000 + (ROW_NUMBER() OVER (ORDER BY date) * 100),
  15, -- Average sets per workout
  150 -- Average total reps
FROM workout_dates;

-- Insert exercise logs for each workout
WITH workout_data AS (
  SELECT id, date, ROW_NUMBER() OVER (ORDER BY date) as workout_num
  FROM workout_logs
  WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
)
INSERT INTO exercise_logs (
  workout_id,
  exercise_id,
  sets,
  reps,
  weight,
  rest_time,
  created_at
)
SELECT 
  w.id,
  e.id,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 5
    ELSE 3
  END as sets,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN '5'
    ELSE '8-12'
  END as reps,
  CASE e.name
    WHEN 'Bänkpress' THEN 80 + (w.workout_num * 0.5) -- Progressive overload
    WHEN 'Marklyft' THEN 120 + (w.workout_num * 0.75)
    WHEN 'Knäböj' THEN 100 + (w.workout_num * 0.6)
    ELSE 20 + (w.workout_num * 0.25)
  END as weight,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 180
    ELSE 90
  END as rest_time,
  w.date + INTERVAL '18 hours 30 minutes' + (ROW_NUMBER() OVER (PARTITION BY w.id ORDER BY e.name) * INTERVAL '10 minutes')
FROM workout_data w
CROSS JOIN ovningar e
WHERE e.name IN ('Bänkpress', 'Marklyft', 'Knäböj', 'Axelpress', 'Hantelcurl');

-- Insert progress tracking data
WITH workout_data AS (
  SELECT 
    date,
    ROW_NUMBER() OVER (ORDER BY date) as day_num
  FROM workout_logs
  WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
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
    WHEN 'Bänkpress' THEN 80 + (w.day_num * 0.5)
    WHEN 'Marklyft' THEN 120 + (w.day_num * 0.75)
    WHEN 'Knäböj' THEN 100 + (w.day_num * 0.6)
    ELSE 20 + (w.day_num * 0.25)
  END as max_weight,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 25
    ELSE 36
  END as total_reps,
  w.date + INTERVAL '18 hours 30 minutes'
FROM workout_data w
CROSS JOIN ovningar e
WHERE e.name IN ('Bänkpress', 'Marklyft', 'Knäböj', 'Axelpress', 'Hantelcurl');

-- Insert body measurements
INSERT INTO progress_tracking (
  user_id,
  date,
  metric,
  value,
  unit,
  created_at
)
SELECT 
  '16a68fe7-f215-49cb-9a40-fd928966feb6',
  date,
  metric,
  CASE metric
    WHEN 'weight' THEN 85 - (ROW_NUMBER() OVER (PARTITION BY metric ORDER BY date) * 0.1) -- Gradual weight loss
    WHEN 'muscle_mass' THEN 65 + (ROW_NUMBER() OVER (PARTITION BY metric ORDER BY date) * 0.05) -- Slight muscle gain
    WHEN 'body_fat' THEN 15 - (ROW_NUMBER() OVER (PARTITION BY metric ORDER BY date) * 0.05) -- Gradual fat loss
  END as value,
  CASE metric
    WHEN 'weight' THEN 'kg'
    WHEN 'muscle_mass' THEN 'kg'
    WHEN 'body_fat' THEN '%'
  END as unit,
  date + INTERVAL '8 hours' -- Morning measurements
FROM workout_logs w
CROSS JOIN (
  SELECT unnest(ARRAY['weight', 'muscle_mass', 'body_fat']) as metric
) m
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';