/*
  # Add name column to workout_logs table

  1. Changes
    - Add name column to workout_logs table
    - Make it nullable since existing workouts won't have names
    - Update workout display to show custom names
*/

-- Add name column to workout_logs table
ALTER TABLE workout_logs
ADD COLUMN IF NOT EXISTS name text;

-- Create index for faster name searches
CREATE INDEX IF NOT EXISTS idx_workout_logs_name 
ON workout_logs(name);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';