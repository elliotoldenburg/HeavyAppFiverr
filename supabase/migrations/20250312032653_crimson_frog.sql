/*
  # Fix workout_logs schema

  1. Changes
    - Remove not-null constraint from sets column in workout_logs
    - This column is redundant since we track sets in exercise_logs
    - Update existing records to prevent constraint violations
*/

-- First set a default value for any existing NULL sets
UPDATE workout_logs
SET sets = total_sets
WHERE sets IS NULL;

-- Then modify the column to allow NULL values
ALTER TABLE workout_logs
ALTER COLUMN sets DROP NOT NULL;