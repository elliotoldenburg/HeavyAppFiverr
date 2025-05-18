/*
  # Add profile tracking tables and update existing tables

  1. Changes to existing tables
    - Update training_profiles with new fields:
      - profile_picture
      - height_cm
      - weight_kg (rename from weight)

  2. New Tables
    - progress_tracking (For tracking various metrics)
    - workout_logs (For logging workout details)

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for authenticated users
*/

-- Update training_profiles table
ALTER TABLE training_profiles
RENAME COLUMN weight TO weight_kg;

ALTER TABLE training_profiles
ALTER COLUMN weight_kg TYPE DECIMAL;

ALTER TABLE training_profiles
RENAME COLUMN height TO height_cm;

ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Create progress_tracking table
CREATE TABLE IF NOT EXISTS progress_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  value DECIMAL NOT NULL,
  unit TEXT NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_metric CHECK (metric IN ('weight', 'muscle_mass', 'strength', 'body_fat'))
);

-- Create workout_logs table
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_id uuid REFERENCES pass(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES ovningar(id) ON DELETE CASCADE,
  sets INTEGER NOT NULL,
  reps TEXT NOT NULL,
  weight DECIMAL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for progress_tracking
CREATE POLICY "Users can insert own progress tracking"
  ON progress_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own progress tracking"
  ON progress_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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