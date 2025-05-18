/*
  # Restore original database schema

  1. Changes
    - Drop new simplified tables
    - Recreate original table structure
    - Restore relationships and constraints
    - Maintain data integrity
*/

-- First drop the simplified tables
DROP TABLE IF EXISTS workout_logs CASCADE;
DROP TABLE IF EXISTS exercise_logs CASCADE;
DROP TABLE IF EXISTS set_logs CASCADE;

-- Recreate workout_logs with original structure
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Recreate exercise_logs with original structure
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

-- Recreate set_logs with original structure
CREATE TABLE IF NOT EXISTS set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_log_id uuid REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_number integer NOT NULL,
  weight decimal,
  reps integer NOT NULL,
  completed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(exercise_log_id, set_number)
);

-- Enable RLS on all tables
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Recreate policies for workout_logs
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

-- Recreate policies for exercise_logs
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

CREATE POLICY "Users can read own exercise logs"
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

-- Recreate policies for set_logs
CREATE POLICY "Users can view own set logs"
  ON set_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );

CREATE POLICY "Users can insert own set logs"
  ON set_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );

CREATE POLICY "Users can update own set logs"
  ON set_logs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );

CREATE POLICY "Users can delete own set logs"
  ON set_logs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM workout_logs w
      JOIN exercise_logs e ON e.workout_id = w.id
      WHERE e.id = set_logs.exercise_log_id
    )
  );