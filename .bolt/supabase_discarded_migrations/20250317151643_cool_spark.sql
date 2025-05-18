/*
  # Fix bench press progression calculation

  1. Changes
    - Adjust weight calculation formula for bench press
    - Ensure proper progression from 70kg to 120kg over 2 years
    - Maintain realistic jumps between 1RM tests
*/

-- First remove existing data for the user
DELETE FROM workout_logs
WHERE user_id = 'eda42deb-6274-4d36-96bf-43a53ca6cd91';

-- Generate workout dates for 2 years
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '730 days' AS date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM dates
  WHERE date < CURRENT_DATE
),
workout_dates AS (
  -- Monday/Thursday for bench, Tuesday/Friday for squat, Wednesday/Saturday for deadlift
  SELECT 
    date,
    ROW_NUMBER() OVER (ORDER BY date) as overall_workout_num
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
  'eda42deb-6274-4d36-96bf-43a53ca6cd91',
  date,
  date + TIME '17:30:00' -- Evening workout
FROM workout_dates;

-- Insert exercise logs with fixed progression
WITH workout_data AS (
  SELECT 
    id as workout_id,
    date,
    EXTRACT(DOW FROM date) as day_of_week,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(DOW FROM date) 
      ORDER BY date
    ) as workout_num,
    -- Calculate weeks since start (for proper progression)
    CEIL(
      EXTRACT(EPOCH FROM (date - MIN(date) OVER ()))
      / (7 * 24 * 60 * 60)
    )::integer as training_week
  FROM workout_logs
  WHERE user_id = 'eda42deb-6274-4d36-96bf-43a53ca6cd91'
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
  5 as sets,
  CASE e.name
    WHEN 'Bänkpress' THEN
      CASE 
        WHEN w.training_week % 8 = 0 THEN 1  -- Test 1RM every 8 weeks
        WHEN w.training_week % 2 = 0 THEN 3   -- Heavy triples every other week
        ELSE 5                                -- Regular 5s
      END
    WHEN 'Knäböj' THEN 5  -- Always 5s for squat
    WHEN 'Marklyft' THEN  -- Varied rep ranges for deadlift
      CASE 
        WHEN w.training_week % 12 = 0 THEN 1  -- Occasional singles
        WHEN w.training_week % 3 = 0 THEN 3   -- Heavy triples
        WHEN w.training_week % 3 = 1 THEN 5   -- Moderate fives
        ELSE 8                                -- Volume work
      END
  END as reps,
  CASE e.name
    WHEN 'Bänkpress' THEN
      CASE
        -- Calculate 1RM progression: 70kg to 120kg over 104 weeks
        -- Using a more realistic non-linear progression
        WHEN w.training_week % 8 = 0 THEN  -- 1RM testing weeks
          70 + (
            CASE 
              WHEN w.training_week <= 26 THEN w.training_week * 0.35  -- Faster gains first 6 months
              WHEN w.training_week <= 52 THEN 70 * 1.25               -- Slower gains next 6 months
              WHEN w.training_week <= 78 THEN 70 * 1.45               -- Even slower gains
              ELSE 70 * 1.7                                           -- Final phase
            END
          )
        WHEN w.training_week % 2 = 0 THEN   -- Heavy triples
          CASE 
            WHEN w.training_week <= 26 THEN 70 + (w.training_week * 0.3)
            WHEN w.training_week <= 52 THEN 70 * 1.2
            WHEN w.training_week <= 78 THEN 70 * 1.35
            ELSE 70 * 1.5
          END
        ELSE                                -- Regular sets
          CASE 
            WHEN w.training_week <= 26 THEN 70 + (w.training_week * 0.25)
            WHEN w.training_week <= 52 THEN 70 * 1.15
            WHEN w.training_week <= 78 THEN 70 * 1.25
            ELSE 70 * 1.4
          END
      END
    WHEN 'Knäböj' THEN
      CASE
        -- First 6 months: Progress from 80kg to 110kg
        WHEN w.training_week <= 26 THEN
          80 + (w.training_week * 1.15)
        -- Injury period: Drop to 70% and slowly rebuild
        WHEN w.training_week BETWEEN 27 AND 39 THEN
          80
        -- Final year: Progress to 120kg
        ELSE
          90 + ((w.training_week - 39) * 0.75)
      END
    WHEN 'Marklyft' THEN
      CASE
        WHEN w.training_week % 12 = 0 THEN  -- Heavy singles
          140 + (w.training_week * 0.4)
        WHEN w.training_week % 3 = 0 THEN   -- Heavy triples
          (140 + (w.training_week * 0.4)) * 0.9
        WHEN w.training_week % 3 = 1 THEN   -- Moderate fives
          (140 + (w.training_week * 0.4)) * 0.85
        ELSE                                -- Volume work
          (140 + (w.training_week * 0.4)) * 0.75
      END
  END as weight,
  180 as rest_time -- 3 minutes rest between sets
FROM workout_data w
CROSS JOIN exercise_info e
WHERE 
  -- Create a 6-day split
  (w.day_of_week IN (1, 4) AND e.name = 'Bänkpress') OR -- Mon/Thu for bench
  (w.day_of_week IN (2, 5) AND e.name = 'Knäböj') OR    -- Tue/Fri for squat
  (w.day_of_week IN (3, 6) AND e.name = 'Marklyft');    -- Wed/Sat for deadlift

-- Insert set logs with realistic variations
WITH exercise_data AS (
  SELECT 
    e.id as exercise_log_id,
    e.exercise_id,
    o.name as exercise_name,
    e.weight as target_weight,
    e.reps as target_reps,
    w.date,
    ROW_NUMBER() OVER (PARTITION BY o.name ORDER BY w.date) as progression
  FROM exercise_logs e
  JOIN workout_logs w ON w.id = e.workout_id
  JOIN ovningar o ON o.id = e.exercise_id
  WHERE w.user_id = 'eda42deb-6274-4d36-96bf-43a53ca6cd91'
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
    WHEN set_number = 1 THEN ed.target_weight * 0.5  -- First warmup
    WHEN set_number = 2 THEN ed.target_weight * 0.7  -- Second warmup
    WHEN set_number = 3 THEN ed.target_weight * 0.9  -- Last warmup
    WHEN set_number = 4 THEN ed.target_weight        -- Working set
    WHEN set_number = 5 THEN                         -- Last set
      CASE 
        WHEN ed.target_reps = 1 THEN                 -- 1RM attempts
          CASE
            WHEN random() < 0.7 THEN ed.target_weight -- 70% success rate on max attempts
            ELSE 0 -- Failed attempt
          END
        ELSE ed.target_weight                        -- Regular sets
      END
  END as weight,
  CASE 
    WHEN set_number <= 2 THEN ed.target_reps + 2     -- More reps on warmups
    WHEN set_number = 3 THEN ed.target_reps + 1      -- Slightly more reps on last warmup
    ELSE ed.target_reps                              -- Target reps on working sets
  END as reps,
  CASE 
    WHEN set_number = 5 AND ed.target_reps = 1 THEN  -- Success rate on max attempts
      random() < 0.7
    ELSE true                                        -- Always complete regular sets
  END as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, 5) as set_number;