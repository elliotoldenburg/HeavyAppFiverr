/*
  # Update Börtys pansarschema with 5x5 exercises

  1. Changes
    - Clear existing exercises for Börtys pansarschema
    - Add new exercises with 5x5 rep scheme:
      - Bänkpress
      - Marklyft
      - Knäböj
    - Update program description to reflect 5x5 focus

  2. Security
    - No changes to RLS policies (using existing)
*/

-- Update program description
UPDATE program 
SET description = 'Klassiskt 5x5 program med fokus på de tre stora lyften'
WHERE name = 'Börtys pansarschema';

-- Remove existing exercises from the program's sessions
DELETE FROM pass_ovningar 
WHERE pass_id IN (
  SELECT p.id 
  FROM pass p
  JOIN program pr ON p.program_id = pr.id
  WHERE pr.name = 'Börtys pansarschema'
);

-- Get program and pass IDs
WITH program_data AS (
  SELECT 
    p.id as program_id,
    pa.id as pass_id,
    pa.name as pass_name
  FROM program p
  JOIN pass pa ON pa.program_id = p.id
  WHERE p.name = 'Börtys pansarschema'
),
exercise_data AS (
  SELECT id, name
  FROM ovningar
  WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj')
)
-- Insert new exercises with 5x5 scheme
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  pd.pass_id,
  e.id,
  5 as sets,
  '5' as reps,
  180 as rest_time,
  ROW_NUMBER() OVER (PARTITION BY pd.pass_name ORDER BY e.name) as "order"
FROM program_data pd
CROSS JOIN exercise_data e
WHERE 
  (pd.pass_name = 'De Stora Lyften A' AND e.name IN ('Bänkpress', 'Marklyft')) OR
  (pd.pass_name = 'De Stora Lyften B' AND e.name IN ('Knäböj', 'Bänkpress')) OR
  (pd.pass_name = 'De Stora Lyften C' AND e.name IN ('Marklyft', 'Knäböj'));