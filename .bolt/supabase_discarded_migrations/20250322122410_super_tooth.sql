-- First remove any existing data for the user
DELETE FROM workout_logs
WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da';

-- Generate workout dates for 2 years
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '730 days' AS date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM dates
  WHERE date < CURRENT_DATE
),
workout_dates AS (
  -- Monday/Thursday for push, Tuesday/Friday for legs, Wednesday/Saturday for pull
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
  date + TIME '17:30:00' -- Evening workout
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
  WHERE name IN (
    'Bänkpress', 'Axelpress', 'Knäböj',
    'Latsdrag', 'Rodd', 'Marklyft',
    'Triceps pushdown', 'Hantelcurl'
  )
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
  CASE e.name
    WHEN 'Bänkpress' THEN 5
    WHEN 'Knäböj' THEN 5
    WHEN 'Axelpress' THEN 4
    ELSE 3 -- Accessory exercises
  END as sets,
  CASE e.name
    WHEN 'Bänkpress' THEN
      CASE 
        WHEN w.workout_num % 16 = 0 THEN 1  -- Test 1RM every 8 weeks
        WHEN w.workout_num % 4 = 0 THEN 3   -- Heavy triples every 2 weeks
        ELSE 5                              -- Regular 5s
      END
    WHEN 'Knäböj' THEN
      CASE 
        WHEN w.workout_num % 12 = 0 THEN 1  -- Test 1RM every 6 weeks
        WHEN w.workout_num % 3 = 0 THEN 3   -- Heavy triples
        ELSE 5                              -- Regular 5s
      END
    WHEN 'Axelpress' THEN  -- More volume for shoulder work
      CASE 
        WHEN w.workout_num % 8 = 0 THEN 3   -- Heavy triples occasionally
        WHEN w.workout_num % 2 = 0 THEN 8   -- Volume work
        ELSE 5                              -- Regular 5s
      END
    ELSE 10 -- Higher reps for accessories
  END as reps,
  CASE e.name
    WHEN 'Bänkpress' THEN
      CASE
        WHEN w.workout_num % 16 = 0 THEN  -- 1RM testing
          70 + (w.workout_num * 0.068)    -- Progress from 70kg to 120kg over 2 years
        WHEN w.workout_num % 4 = 0 THEN   -- Heavy triples
          (70 + (w.workout_num * 0.068)) * 0.9
        ELSE                              -- Regular sets
          (70 + (w.workout_num * 0.068)) * 0.8
      END
    WHEN 'Knäböj' THEN
      CASE
        WHEN w.workout_num % 12 = 0 THEN  -- 1RM testing
          100 + (w.workout_num * 0.1)     -- Progress from 100kg to 170kg over 2 years
        WHEN w.workout_num % 3 = 0 THEN   -- Heavy triples
          (100 + (w.workout_num * 0.1)) * 0.9
        ELSE                              -- Regular sets
          (100 + (w.workout_num * 0.1)) * 0.8
      END
    WHEN 'Axelpress' THEN
      CASE
        WHEN w.workout_num % 8 = 0 THEN   -- Heavy triples
          40 + (w.workout_num * 0.03)     -- Progress from 40kg to 65kg over 2 years
        WHEN w.workout_num % 2 = 0 THEN   -- Volume work
          (40 + (w.workout_num * 0.03)) * 0.8
        ELSE                              -- Regular sets
          (40 + (w.workout_num * 0.03)) * 0.85
      END
    WHEN 'Latsdrag' THEN
      60 + (w.workout_num * 0.02)         -- Progress from 60kg to 75kg
    WHEN 'Rodd' THEN
      70 + (w.workout_num * 0.02)         -- Progress from 70kg to 85kg
    WHEN 'Marklyft' THEN
      140 + (w.workout_num * 0.08)        -- Progress from 140kg to 200kg
    ELSE
      20 + (w.workout_num * 0.01)         -- Slow progression for accessories
  END as weight,
  CASE e.name
    WHEN 'Bänkpress' THEN 180
    WHEN 'Knäböj' THEN 180
    WHEN 'Axelpress' THEN 120
    ELSE 90
  END as rest_time
FROM workout_data w
CROSS JOIN exercise_info e
WHERE 
  -- Create a PPL split
  (w.day_of_week IN (1, 4) AND e.name IN ('Bänkpress', 'Axelpress', 'Triceps pushdown')) OR -- Push
  (w.day_of_week IN (2, 5) AND e.name IN ('Knäböj', 'Marklyft')) OR                         -- Legs
  (w.day_of_week IN (3, 6) AND e.name IN ('Latsdrag', 'Rodd', 'Hantelcurl'));              -- Pull

-- Insert set logs with realistic variations
WITH exercise_data AS (
  SELECT 
    e.id as exercise_log_id,
    e.exercise_id,
    o.name as exercise_name,
    e.weight as target_weight,
    e.reps as target_reps,
    e.sets as target_sets,
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
    WHEN ed.exercise_name IN ('Bänkpress', 'Knäböj', 'Axelpress', 'Marklyft') THEN
      CASE
        WHEN set_number = 1 THEN ed.target_weight * 0.5  -- First warmup
        WHEN set_number = 2 THEN ed.target_weight * 0.7  -- Second warmup
        WHEN set_number = 3 THEN ed.target_weight * 0.9  -- Last warmup
        WHEN set_number = ed.target_sets THEN            -- Last working set
          CASE 
            WHEN ed.target_reps = 1 THEN                 -- 1RM attempts
              CASE
                WHEN random() < 0.8 THEN ed.target_weight -- 80% success rate
                ELSE 0 -- Failed attempt
              END
            ELSE ed.target_weight * 0.95                 -- Slight drop in weight
          END
        ELSE ed.target_weight                           -- Regular working sets
      END
    ELSE -- Accessory exercises
      CASE
        WHEN set_number = 1 THEN ed.target_weight * 0.9  -- First set slightly lighter
        ELSE ed.target_weight                            -- Full weight for remaining sets
      END
  END as weight,
  CASE 
    WHEN ed.exercise_name IN ('Bänkpress', 'Knäböj', 'Axelpress', 'Marklyft') THEN
      CASE 
        WHEN set_number <= 2 THEN ed.target_reps + 2     -- More reps on warmups
        WHEN set_number = 3 THEN ed.target_reps + 1      -- Slightly more reps on last warmup
        ELSE ed.target_reps                              -- Target reps on working sets
      END
    ELSE -- Accessory exercises
      CASE
        WHEN set_number = ed.target_sets THEN ed.target_reps - 2  -- Drop in reps on last set
        ELSE ed.target_reps                                       -- Target reps for other sets
      END
  END as reps,
  CASE 
    WHEN set_number = ed.target_sets AND ed.target_reps = 1 THEN  -- Success rate on max attempts
      random() < 0.8
    ELSE true                                                     -- Always complete regular sets
  END as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, ed.target_sets) as set_number;

-- Update progress tracking logs
WITH best_sets AS (
  SELECT DISTINCT ON (el.workout_id, el.exercise_id)
    wl.user_id,
    wl.id as workout_id,
    el.exercise_id,
    s.reps,
    s.weight,
    wl.date as workout_date,
    (s.weight * s.reps) as volume
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN set_logs s ON s.exercise_log_id = el.id
  WHERE 
    wl.user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
    AND s.completed = true 
    AND s.weight > 0
  ORDER BY 
    el.workout_id, 
    el.exercise_id,
    s.weight DESC,
    s.reps DESC
)
INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date
)
SELECT 
  user_id,
  workout_id,
  exercise_id,
  reps,
  weight,
  workout_date
FROM best_sets;