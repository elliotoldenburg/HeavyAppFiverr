/*
  # Update Maxstyrka workout exercises

  1. Changes
    - Remove duplicate exercises from Maxstyrka workout
    - Add progressive overload structure with varying sets/reps
    - Keep core compound movements but with different training parameters

  2. Exercise Details
    - Knäböj: Heavy sets focusing on strength
    - Bänkpress: Volume work for hypertrophy
    - Marklyft: Technical work with moderate weight
*/

-- First, remove existing exercises from Maxstyrka pass
DELETE FROM pass_ovningar 
WHERE pass_id IN (
  SELECT p.id 
  FROM pass p
  JOIN program pr ON p.program_id = pr.id
  WHERE p.name = 'Maxstyrka'
);

-- Insert updated exercise structure
WITH maxstyrka_pass AS (
  SELECT p.id as pass_id
  FROM pass p
  WHERE p.name = 'Maxstyrka'
)
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  mp.pass_id,
  e.id as exercise_id,
  CASE e.name
    WHEN 'Knäböj' THEN 5  -- Strength focus
    WHEN 'Bänkpress' THEN 4  -- Volume focus
    WHEN 'Marklyft' THEN 3  -- Technical focus
  END as sets,
  CASE e.name
    WHEN 'Knäböj' THEN '3-5'  -- Heavy weight, lower reps
    WHEN 'Bänkpress' THEN '8-10'  -- Moderate weight, higher reps
    WHEN 'Marklyft' THEN '5-6'  -- Moderate-heavy weight, medium reps
  END as reps,
  CASE e.name
    WHEN 'Knäböj' THEN 180  -- Longer rest for heavy sets
    WHEN 'Bänkpress' THEN 120  -- Moderate rest for volume
    WHEN 'Marklyft' THEN 150  -- Medium-long rest for technical work
  END as rest_time,
  ROW_NUMBER() OVER (ORDER BY e.name) as "order"
FROM maxstyrka_pass mp
CROSS JOIN ovningar e
WHERE e.name IN ('Knäböj', 'Bänkpress', 'Marklyft');