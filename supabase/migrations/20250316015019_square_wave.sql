/*
  # Update exercise_logs reps column

  1. Changes
    - Add new reps_per_set integer column
    - Convert existing reps data to integer format
    - Drop old reps column
    - Rename new column to reps

  2. Data Preservation
    - Safely convert range values to single integers
    - Handle null values appropriately
    - Maintain data integrity
*/

-- First add the new column
ALTER TABLE exercise_logs
ADD COLUMN reps_per_set integer;

-- Update the new column with converted values from the old column
UPDATE exercise_logs
SET reps_per_set = (
  CASE
    -- Handle range format (e.g., "5-7")
    WHEN reps LIKE '%-%' THEN 
      -- Take the higher number from the range as that's typically what was achieved
      CAST(split_part(reps, '-', 2) AS integer)
    -- Handle single number format
    WHEN reps ~ '^\d+$' THEN 
      CAST(reps AS integer)
    -- Default to null if format is unexpected
    ELSE NULL
  END
);

-- Make the new column not null after data migration
ALTER TABLE exercise_logs
ALTER COLUMN reps_per_set SET NOT NULL;

-- Drop the old column
ALTER TABLE exercise_logs
DROP COLUMN reps;

-- Rename the new column to reps
ALTER TABLE exercise_logs
RENAME COLUMN reps_per_set TO reps;

-- Add a check constraint to ensure reps is positive
ALTER TABLE exercise_logs
ADD CONSTRAINT exercise_logs_reps_check CHECK (reps > 0);

-- Update related tables that might reference this
UPDATE set_logs
SET reps = (
  SELECT e.reps 
  FROM exercise_logs e 
  WHERE e.id = set_logs.exercise_log_id
)
WHERE reps IS NULL;