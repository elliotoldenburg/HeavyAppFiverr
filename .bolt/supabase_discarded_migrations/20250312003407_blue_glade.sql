/*
  # Add Börtys pansarschema training program

  1. Changes
    - Insert new program "Börtys pansarschema"
    - Add training sessions with compound lifts
    - Link exercises to sessions with 5x5 rep scheme
*/

-- Insert the program
INSERT INTO program (name, description, category, difficulty, sessions_per_week, image_url) VALUES
(
  'Börtys pansarschema',
  'Fokus på de tre stora lyften med 5x5 progression',
  'Styrka',
  'Medel-Avancerad',
  3,
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2940&auto=format&fit=crop'
);

-- Insert training sessions
WITH bortys_program AS (
  SELECT id FROM program WHERE name = 'Börtys pansarschema'
)
INSERT INTO pass (program_id, day, name, description)
SELECT 
  bortys_program.id,
  day,
  name,
  description
FROM bortys_program,
(VALUES
  (1, 'De Stora Lyften A', 'Fokus på bänkpress och marklyft'),
  (3, 'De Stora Lyften B', 'Fokus på knäböj och bänkpress'),
  (5, 'De Stora Lyften C', 'Fokus på marklyft och knäböj')
) AS workouts(day, name, description);

-- Make sure the exercises exist
INSERT INTO ovningar (name, category, equipment) VALUES
('Bänkpress', 'Bröst', 'Skivstång'),
('Marklyft', 'Rygg', 'Skivstång'),
('Knäböj', 'Ben', 'Skivstång')
ON CONFLICT (name) DO NOTHING;

-- Link exercises to sessions
WITH bortys_program AS (
  SELECT p.id AS program_id, pa.id AS pass_id, pa.name AS pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Börtys pansarschema'
),
exercise_ids AS (
  SELECT id, name FROM ovningar 
  WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  bp.pass_id,
  e.id AS exercise_id,
  5 AS sets,
  '5' AS reps,
  180 AS rest_time,
  ROW_NUMBER() OVER (PARTITION BY bp.pass_name ORDER BY e.name) AS "order"
FROM bortys_program bp
CROSS JOIN exercise_ids e
WHERE 
  (bp.pass_name = 'De Stora Lyften A' AND e.name IN ('Bänkpress', 'Marklyft')) OR
  (bp.pass_name = 'De Stora Lyften B' AND e.name IN ('Knäböj', 'Bänkpress')) OR
  (bp.pass_name = 'De Stora Lyften C' AND e.name IN ('Marklyft', 'Knäböj'));