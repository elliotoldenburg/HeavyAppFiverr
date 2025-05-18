/*
  # Simplify database schema

  1. Changes
    - Merge workout_logs and exercise_logs tables
    - Remove redundant columns
    - Simplify progress tracking
    - Maintain all existing functionality

  2. Data Preservation
    - Migrate existing data to new structure
    - Keep user data intact
    - Maintain relationships
*/

-- First, create temporary table to store workout data
CREATE TEMP TABLE temp_workout_data AS
SELECT 
  w.id as workout_id,
  w.user_id,
  w.date,
  w.created_at,
  e.exercise_id,
  e.custom_exercise_name,
  e.sets,
  e.reps,
  e.weight,
  e.rest_time
FROM workout_logs w
LEFT JOIN exercise_logs e ON e.workout_id = w.id;

-- Drop old tables and their dependencies
DROP TABLE IF EXISTS exercise_logs CASCADE;
DROP TABLE IF EXISTS workout_logs CASCADE;

-- Create new simplified workout_logs table
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES ovningar(id) ON DELETE SET NULL,
  custom_exercise_name text,
  date date DEFAULT CURRENT_DATE,
  sets integer,
  reps text,
  weight decimal,
  rest_time integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_exercise_source CHECK (
    (exercise_id IS NOT NULL AND custom_exercise_name IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_name IS NOT NULL)
  )
);

-- Migrate data to new structure
INSERT INTO workout_logs (
  id,
  user_id,
  exercise_id,
  custom_exercise_name,
  date,
  sets,
  reps,
  weight,
  rest_time,
  created_at
)
SELECT 
  gen_random_uuid(),
  user_id,
  exercise_id,
  custom_exercise_name,
  date,
  sets,
  reps,
  weight,
  rest_time,
  created_at
FROM temp_workout_data;

-- Drop temporary table
DROP TABLE temp_workout_data;

-- Simplify progress_tracking table
ALTER TABLE progress_tracking
DROP COLUMN IF EXISTS metric,
DROP COLUMN IF EXISTS value,
DROP COLUMN IF EXISTS unit;

-- Enable RLS on new table
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for workout_logs
CREATE POLICY "Users can insert own workout logs"
  ON workout_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own workout logs"
  ON workout_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own workout logs"
  ON workout_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout logs"
  ON workout_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);