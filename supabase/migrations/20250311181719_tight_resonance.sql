/*
  # Insert training programs and workout data

  1. Changes
    - Insert programs with their details
    - Insert training sessions (pass) for each program
    - Insert exercises (ovningar)
    - Link exercises to sessions (pass_ovningar)

  2. Data Structure
    - Three complete training programs
    - Multiple training sessions per program
    - Exercises with sets, reps, and rest times
*/

-- Insert programs with proper categories and image URLs
INSERT INTO program (name, description, category, difficulty, sessions_per_week, image_url) VALUES
(
  'Muscle Building Pro',
  'Optimerat program för maximal muskeltillväxt',
  'Bygg Muskelmassa',
  'Medel-Avancerad',
  4,
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=2940&auto=format&fit=crop'
),
(
  'Power & Styrka',
  'Fokus på grundövningar och progressiv överbelastning',
  'Öka Styrka',
  'Alla nivåer',
  3,
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2940&auto=format&fit=crop'
),
(
  'Lean Transformation',
  'Effektiv fettförbränning med bibehållen muskelmassa',
  'Viktminskning',
  'Nybörjare-Medel',
  5,
  'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=2940&auto=format&fit=crop'
);

-- Insert exercises
INSERT INTO ovningar (name, category, equipment) VALUES
-- Bröst & Triceps
('Bänkpress', 'Bröst', 'Skivstång'),
('Lutande hantelpress', 'Bröst', 'Hantlar'),
('Dips', 'Bröst/Triceps', 'Kroppsvikt'),
('Triceps pushdown', 'Triceps', 'Kabel'),
('French press', 'Triceps', 'Hantel'),

-- Rygg & Biceps
('Marklyft', 'Rygg', 'Skivstång'),
('Pull-ups', 'Rygg', 'Kroppsvikt'),
('Skivstångsrodd', 'Rygg', 'Skivstång'),
('Hantelcurl', 'Biceps', 'Hantlar'),
('Preacher curl', 'Biceps', 'EZ-stång'),

-- Ben & Axlar
('Knäböj', 'Ben', 'Skivstång'),
('Raka marklyft', 'Ben/Rygg', 'Skivstång'),
('Axelpress', 'Axlar', 'Skivstång'),
('Sidolyft', 'Axlar', 'Hantlar'),
('Vadpress', 'Ben', 'Benpress'),

-- Funktionella övningar
('Burpees', 'Helkropp', 'Kroppsvikt'),
('Mountain climbers', 'Core', 'Kroppsvikt'),
('Russian twists', 'Core', 'Vikt/Kroppsvikt'),
('Box jumps', 'Ben', 'Box'),
('Wall balls', 'Helkropp', 'Medicinboll');

-- Insert training sessions for Muscle Building Pro
WITH muscle_program AS (
  SELECT id FROM program WHERE name = 'Muscle Building Pro'
)
INSERT INTO pass (program_id, day, name, description)
SELECT 
  muscle_program.id,
  day,
  name,
  description
FROM muscle_program,
(VALUES
  (1, 'Bröst & Triceps', 'Fokus på överkroppens pressande muskler'),
  (2, 'Rygg & Biceps', 'Dragövningar för rygg och armar'),
  (4, 'Ben & Axlar', 'Tunga basövningar för underkropp och axlar'),
  (5, 'Armar & Core', 'Isolationsövningar för armar och bålstabilitet')
) AS workouts(day, name, description);

-- Insert training sessions for Power & Styrka
WITH power_program AS (
  SELECT id FROM program WHERE name = 'Power & Styrka'
)
INSERT INTO pass (program_id, day, name, description)
SELECT 
  power_program.id,
  day,
  name,
  description
FROM power_program,
(VALUES
  (1, 'Styrkelyft Fokus', 'De tre stora lyften med fokus på kraft'),
  (3, 'Explosiv Kraft', 'Explosiva övningar och atletisk utveckling'),
  (5, 'Maxstyrka', 'Tunga lyft med låga repetitioner')
) AS workouts(day, name, description);

-- Insert training sessions for Lean Transformation
WITH lean_program AS (
  SELECT id FROM program WHERE name = 'Lean Transformation'
)
INSERT INTO pass (program_id, day, name, description)
SELECT 
  lean_program.id,
  day,
  name,
  description
FROM lean_program,
(VALUES
  (1, 'HIIT & Styrka', 'Högintensiv intervallträning kombinerat med styrka'),
  (2, 'Cardio & Core', 'Uthållighet och bålstabilitet'),
  (3, 'Metabolisk Kondition', 'Cirkelträning för maximal kaloriförbränning'),
  (5, 'Funktionell Fitness', 'Helkroppspass med fokus på rörlighet och styrka')
) AS workouts(day, name, description);

-- Link exercises to Muscle Building Pro sessions
WITH muscle_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Muscle Building Pro'
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  mp.pass_id,
  e.id AS exercise_id,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 4
    ELSE 3
  END AS sets,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN '8-10'
    WHEN e.category IN ('Triceps', 'Biceps') THEN '12-15'
    ELSE '10-12'
  END AS reps,
  CASE 
    WHEN e.name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 120
    ELSE 90
  END AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY mp.pass_name ORDER BY e.name) AS "order"
FROM muscle_program mp
JOIN ovningar e ON 
  (mp.pass_name = 'Bröst & Triceps' AND e.name IN ('Bänkpress', 'Lutande hantelpress', 'Dips', 'Triceps pushdown', 'French press')) OR
  (mp.pass_name = 'Rygg & Biceps' AND e.name IN ('Marklyft', 'Pull-ups', 'Skivstångsrodd', 'Hantelcurl', 'Preacher curl')) OR
  (mp.pass_name = 'Ben & Axlar' AND e.name IN ('Knäböj', 'Raka marklyft', 'Axelpress', 'Sidolyft', 'Vadpress')) OR
  (mp.pass_name = 'Armar & Core' AND e.name IN ('Hantelcurl', 'Triceps pushdown', 'Russian twists', 'Mountain climbers'));

-- Link exercises to Power & Styrka sessions
WITH power_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Power & Styrka'
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  pp.pass_id,
  e.id AS exercise_id,
  5 AS sets,
  '5' AS reps,
  180 AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY pp.pass_name ORDER BY e.name) AS "order"
FROM power_program pp
JOIN ovningar e ON 
  (pp.pass_name = 'Styrkelyft Fokus' AND e.name IN ('Knäböj', 'Bänkpress', 'Marklyft', 'Pull-ups')) OR
  (pp.pass_name = 'Explosiv Kraft' AND e.name IN ('Box jumps', 'Axelpress', 'Wall balls')) OR
  (pp.pass_name = 'Maxstyrka' AND e.name IN ('Knäböj', 'Bänkpress', 'Marklyft', 'Dips'));

-- Link exercises to Lean Transformation sessions
WITH lean_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Lean Transformation'
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  lp.pass_id,
  e.id AS exercise_id,
  3 AS sets,
  CASE 
    WHEN e.category = 'Helkropp' THEN '15'
    ELSE '20'
  END AS reps,
  60 AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY lp.pass_name ORDER BY e.name) AS "order"
FROM lean_program lp
JOIN ovningar e ON 
  (lp.pass_name = 'HIIT & Styrka' AND e.name IN ('Burpees', 'Knäböj', 'Mountain climbers')) OR
  (lp.pass_name = 'Cardio & Core' AND e.name IN ('Russian twists', 'Mountain climbers')) OR
  (lp.pass_name = 'Metabolisk Kondition' AND e.name IN ('Burpees', 'Box jumps', 'Wall balls')) OR
  (lp.pass_name = 'Funktionell Fitness' AND e.name IN ('Wall balls', 'Box jumps', 'Russian twists'));