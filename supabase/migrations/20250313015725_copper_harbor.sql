/*
  # Restore workout history tables

  1. Changes
    - Recreate exercise_logs table
    - Restore original workout_logs structure
    - Migrate data to preserve workout history
    - Maintain relationships between tables
*/

-- First create the new tables with the original structure
CREATE TABLE IF NOT EXISTS new_workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS new_exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid REFERENCES new_workout_logs(id) ON DELETE CASCADE,
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

-- Migrate data from the current workout_logs to the new structure
INSERT INTO new_workout_logs (user_id, date, created_at)
SELECT DISTINCT user_id, date, created_at
FROM workout_logs;

-- Migrate exercise data
INSERT INTO new_exercise_logs (
  workout_id,
  exercise_id,
  custom_exercise_name,
  sets,
  reps,
  weight,
  rest_time,
  created_at
)
SELECT 
  nw.id,
  w.exercise_id,
  w.custom_exercise_name,
  w.sets,
  w.reps,
  w.weight,
  w.rest_time,
  w.created_at
FROM workout_logs w
JOIN new_workout_logs nw ON 
  nw.user_id = w.user_id AND 
  nw.date = w.date AND 
  nw.created_at = w.created_at;

-- Drop the old table
DROP TABLE workout_logs CASCADE;

-- Rename the new tables
ALTER TABLE new_workout_logs RENAME TO workout_logs;
ALTER TABLE new_exercise_logs RENAME TO exercise_logs;

-- Enable RLS on the new tables
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

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