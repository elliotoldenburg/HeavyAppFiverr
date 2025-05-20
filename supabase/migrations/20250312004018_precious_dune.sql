/*
  # Link exercises to Börtys pansarschema

  1. Changes
    - Ensure exercises exist in ovningar table
    - Link exercises to program sessions
    - Set up 5x5 scheme with proper rest times

  2. Exercise Details
    - Bänkpress (Bench Press)
    - Marklyft (Deadlift)
    - Knäböj (Squat)
    - All exercises: 5 sets, 5 reps, 180s rest
*/

-- First ensure the exercises exist in ovningar table
DO $$
BEGIN
  -- Insert Bänkpress if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM ovningar WHERE name = 'Bänkpress') THEN
    INSERT INTO ovningar (name, category, equipment)
    VALUES ('Bänkpress', 'Bröst', 'Skivstång');
  END IF;

  -- Insert Marklyft if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM ovningar WHERE name = 'Marklyft') THEN
    INSERT INTO ovningar (name, category, equipment)
    VALUES ('Marklyft', 'Rygg', 'Skivstång');
  END IF;

  -- Insert Knäböj if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM ovningar WHERE name = 'Knäböj') THEN
    INSERT INTO ovningar (name, category, equipment)
    VALUES ('Knäböj', 'Ben', 'Skivstång');
  END IF;
END $$;

-- Remove any existing exercises from Börtys program sessions
DELETE FROM pass_ovningar 
WHERE pass_id IN (
  SELECT p.id 
  FROM pass p
  JOIN program pr ON p.program_id = pr.id
  WHERE pr.name = 'Börtys pansarschema'
);

-- Link exercises to sessions with proper 5x5 scheme
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