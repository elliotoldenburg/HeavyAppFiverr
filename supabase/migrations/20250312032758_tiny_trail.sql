/*
  # Fix workout_logs reps constraint

  1. Changes
    - Remove not-null constraint from reps column in workout_logs
    - This column is redundant since we track reps in exercise_logs
    - Update existing records to prevent constraint violations
*/

-- First set a default value for any existing NULL reps
UPDATE workout_logs
SET reps = '0'
WHERE reps IS NULL;

-- Then modify the column to allow NULL values
ALTER TABLE workout_logs
ALTER COLUMN reps DROP NOT NULL;