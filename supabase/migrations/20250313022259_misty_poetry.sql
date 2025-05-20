/*
  # Final fix for training profiles

  1. Changes
    - Drop and recreate training_profiles table with correct schema
    - Set up proper column names and types
    - Ensure all constraints and policies are in place
*/

-- Drop existing table and recreate from scratch
DROP TABLE IF EXISTS training_profiles CASCADE;

-- Create table with correct schema
CREATE TABLE training_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  age integer NOT NULL,
  gender text NOT NULL,
  height_cm integer NOT NULL,
  weight_kg decimal NOT NULL,
  training_goal text NOT NULL,
  experience_level text NOT NULL,
  equipment_access text NOT NULL,
  injuries text,
  fitness_goal text,
  profile_picture text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE training_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own training profile"
  ON training_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own training profile"
  ON training_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own training profile"
  ON training_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_training_profiles_updated_at
  BEFORE UPDATE ON training_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';