/*
  # Fix duplicate exercises in all workouts

  1. Changes
    - Remove duplicate exercises from all workouts
    - Ensure each exercise appears only once in each pass
    - Maintain the correct exercise parameters for each program
*/

-- Fix Power & Styrka program passes
WITH power_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Power & Styrka'
)
-- First remove existing exercises
DELETE FROM pass_ovningar 
WHERE pass_id IN (SELECT pass_id FROM power_program);

-- Re-insert exercises without duplicates
WITH power_program AS (
  SELECT DISTINCT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Power & Styrka'
),
exercise_data AS (
  SELECT DISTINCT id, name
  FROM ovningar
  WHERE name IN ('Knäböj', 'Bänkpress', 'Marklyft', 'Pull-ups', 'Box jumps', 'Axelpress', 'Wall balls', 'Dips')
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT DISTINCT
  pp.pass_id,
  e.id AS exercise_id,
  5 AS sets,
  '5' AS reps,
  180 AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY pp.pass_name ORDER BY e.name) AS "order"
FROM power_program pp
CROSS JOIN exercise_data e
WHERE 
  (pp.pass_name = 'Styrkelyft Fokus' AND e.name IN ('Knäböj', 'Bänkpress', 'Marklyft', 'Pull-ups')) OR
  (pp.pass_name = 'Explosiv Kraft' AND e.name IN ('Box jumps', 'Axelpress', 'Wall balls')) OR
  (pp.pass_name = 'Maxstyrka' AND e.name IN ('Knäböj', 'Bänkpress', 'Marklyft', 'Dips'));

-- Fix Muscle Building Pro program passes
WITH muscle_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Muscle Building Pro'
)
-- First remove existing exercises
DELETE FROM pass_ovningar 
WHERE pass_id IN (SELECT pass_id FROM muscle_program);

-- Re-insert exercises without duplicates
WITH muscle_program AS (
  SELECT DISTINCT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Muscle Building Pro'
),
exercise_data AS (
  SELECT DISTINCT id, name
  FROM ovningar
  WHERE name IN (
    'Bänkpress', 'Lutande hantelpress', 'Dips', 'Triceps pushdown', 'French press',
    'Marklyft', 'Pull-ups', 'Skivstångsrodd', 'Hantelcurl', 'Preacher curl',
    'Knäböj', 'Raka marklyft', 'Axelpress', 'Sidolyft', 'Vadpress',
    'Russian twists', 'Mountain climbers'
  )
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT DISTINCT
  mp.pass_id,
  e.id AS exercise_id,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 4
    ELSE 3
  END AS sets,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN '8-10'
    WHEN e.name IN ('Triceps pushdown', 'French press', 'Hantelcurl', 'Preacher curl') THEN '12-15'
    ELSE '10-12'
  END AS reps,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 120
    ELSE 90
  END AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY mp.pass_name ORDER BY e.name) AS "order"
FROM muscle_program mp
CROSS JOIN exercise_data e
WHERE 
  (mp.pass_name = 'Bröst & Triceps' AND e.name IN ('Bänkpress', 'Lutande hantelpress', 'Dips', 'Triceps pushdown', 'French press')) OR
  (mp.pass_name = 'Rygg & Biceps' AND e.name IN ('Marklyft', 'Pull-ups', 'Skivstångsrodd', 'Hantelcurl', 'Preacher curl')) OR
  (mp.pass_name = 'Ben & Axlar' AND e.name IN ('Knäböj', 'Raka marklyft', 'Axelpress', 'Sidolyft', 'Vadpress')) OR
  (mp.pass_name = 'Armar & Core' AND e.name IN ('Hantelcurl', 'Triceps pushdown', 'Russian twists', 'Mountain climbers'));

-- Fix Lean Transformation program passes
WITH lean_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Lean Transformation'
)
-- First remove existing exercises
DELETE FROM pass_ovningar 
WHERE pass_id IN (SELECT pass_id FROM lean_program);

-- Re-insert exercises without duplicates
WITH lean_program AS (
  SELECT DISTINCT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Lean Transformation'
),
exercise_data AS (
  SELECT DISTINCT id, name
  FROM ovningar
  WHERE name IN ('Burpees', 'Knäböj', 'Mountain climbers', 'Russian twists', 'Box jumps', 'Wall balls')
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT DISTINCT
  lp.pass_id,
  e.id AS exercise_id,
  3 AS sets,
  CASE 
    WHEN e.name IN ('Burpees', 'Wall balls') THEN '15'
    ELSE '20'
  END AS reps,
  60 AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY lp.pass_name ORDER BY e.name) AS "order"
FROM lean_program lp
CROSS JOIN exercise_data e
WHERE 
  (lp.pass_name = 'HIIT & Styrka' AND e.name IN ('Burpees', 'Knäböj', 'Mountain climbers')) OR
  (lp.pass_name = 'Cardio & Core' AND e.name IN ('Russian twists', 'Mountain climbers')) OR
  (lp.pass_name = 'Metabolisk Kondition' AND e.name IN ('Burpees', 'Box jumps', 'Wall balls')) OR
  (lp.pass_name = 'Funktionell Fitness' AND e.name IN ('Wall balls', 'Box jumps', 'Russian twists'));