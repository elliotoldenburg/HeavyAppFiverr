/*
  # Update workout tracking tables

  1. Changes to existing tables
    - Add new columns to workout_logs for better tracking
    - Update progress_tracking table structure
    - Remove constraints that are no longer needed

  2. Data Preservation
    - Use ALTER TABLE for existing tables
    - Maintain existing data
*/

-- Update workout_logs table with new columns
ALTER TABLE workout_logs
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS total_weight_lifted DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reps INTEGER DEFAULT 0;

-- Update progress_tracking table structure
ALTER TABLE progress_tracking
ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES ovningar(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS custom_exercise_name text,
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS max_weight DECIMAL,
ADD COLUMN IF NOT EXISTS total_reps INTEGER,
ALTER COLUMN metric DROP NOT NULL,
ALTER COLUMN value DROP NOT NULL,
ALTER COLUMN unit DROP NOT NULL,
DROP CONSTRAINT IF EXISTS valid_metric;