/*
  # Fix workout logging constraints

  1. Changes
    - Remove unique exercise constraint that's causing issues
    - Keep data integrity with proper foreign keys
    - Allow multiple sets of same exercise
*/

-- First drop the problematic trigger and function
DROP TRIGGER IF EXISTS ensure_unique_exercise_per_workout ON exercise_logs;
DROP FUNCTION IF EXISTS check_unique_exercise_per_workout CASCADE;

-- Drop and recreate exercise_logs constraints
ALTER TABLE exercise_logs
DROP CONSTRAINT IF EXISTS valid_exercise_source,
ADD CONSTRAINT valid_exercise_source CHECK (
  (exercise_id IS NOT NULL AND custom_exercise_name IS NULL) OR
  (exercise_id IS NULL AND custom_exercise_name IS NOT NULL)
);

-- Update set_logs constraints
ALTER TABLE set_logs
DROP CONSTRAINT IF EXISTS set_logs_reps_check,
ADD CONSTRAINT set_logs_reps_check CHECK (reps > 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout 
ON exercise_logs(workout_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise 
ON set_logs(exercise_log_id);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';