/*
  # Update training tracking tables

  1. Changes to existing tables
    - Modify workout_logs table
    - Modify progress_tracking table
    - Add new tables for custom exercises and exercise logs

  2. Security
    - Enable RLS on new tables
    - Add appropriate policies for authenticated users

  3. Data Preservation
    - Use ALTER TABLE for existing tables
    - Maintain existing data where possible
*/

-- Update workout_logs table
ALTER TABLE workout_logs
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS total_weight_lifted DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reps INTEGER DEFAULT 0;

-- Create custom_exercises table
CREATE TABLE IF NOT EXISTS custom_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  equipment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create exercise_logs table
CREATE TABLE IF NOT EXISTS exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES ovningar(id) ON DELETE SET NULL,
  custom_exercise_name text,
  sets integer NOT NULL,
  reps text NOT NULL,
  weight decimal,
  rest_time integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_exercise_source CHECK (
    (exercise_id IS NOT NULL AND custom_exercise_name IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_name IS NOT NULL)
  )
);

-- Update progress_tracking table
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

-- Enable RLS on new tables
ALTER TABLE custom_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

-- Policies for custom_exercises
CREATE POLICY "Users can insert own custom exercises"
  ON custom_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own custom exercises"
  ON custom_exercises
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own custom exercises"
  ON custom_exercises
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom exercises"
  ON custom_exercises
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for exercise_logs
CREATE POLICY "Users can insert own exercise logs"
  ON exercise_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

CREATE POLICY "Users can view own exercise logs"
  ON exercise_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

CREATE POLICY "Users can update own exercise logs"
  ON exercise_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );

CREATE POLICY "Users can delete own exercise logs"
  ON exercise_logs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs 
      WHERE id = workout_id
    )
  );