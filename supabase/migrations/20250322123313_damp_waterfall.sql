/*
  # Update 1RM calculation to handle all rep ranges

  1. Changes
    - Remove rep range limitation for 1RM calculation
    - Keep using same formula but apply to all sets
    - Update progress tracking table
*/

-- First update the progress_tracking_logs table
ALTER TABLE progress_tracking_logs
DROP COLUMN IF EXISTS estimated_1rm CASCADE;

-- Add back the column without the rep limitation
ALTER TABLE progress_tracking_logs
ADD COLUMN estimated_1rm decimal GENERATED ALWAYS AS (
  -- Brzycki formula: weight × (36 / (37 - reps))
  weight * (36.0 / (37.0 - reps))
) STORED;

-- Create index for faster querying
DROP INDEX IF EXISTS idx_progress_tracking_1rm;
CREATE INDEX idx_progress_tracking_1rm 
ON progress_tracking_logs(user_id, exercise_id, estimated_1rm);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';