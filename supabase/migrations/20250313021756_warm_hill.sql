/*
  # Fix training profiles table schema

  1. Changes
    - Safely backup and restore training profiles data
    - Ensure correct column names and types
    - Maintain all constraints and policies
    - Handle data migration safely

  2. Security
    - Maintain RLS policies
    - Preserve user data integrity
*/

-- First create a backup of existing data
CREATE TEMP TABLE temp_profiles AS 
SELECT * FROM training_profiles;

-- Drop existing table
DROP TABLE IF EXISTS training_profiles CASCADE;

-- Recreate table with correct schema
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

-- Recreate policies
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

-- Recreate trigger for updated_at
CREATE TRIGGER update_training_profiles_updated_at
  BEFORE UPDATE ON training_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Restore data from backup
INSERT INTO training_profiles (
  id,
  user_id,
  full_name,
  age,
  gender,
  height_cm,
  weight_kg,
  training_goal,
  experience_level,
  equipment_access,
  injuries,
  fitness_goal,
  profile_picture,
  created_at,
  updated_at
)
SELECT 
  id,
  user_id,
  full_name,
  age,
  gender,
  height_cm,
  weight_kg,
  training_goal,
  experience_level,
  equipment_access,
  injuries,
  fitness_goal,
  profile_picture,
  created_at,
  updated_at
FROM temp_profiles;

-- Drop temporary table
DROP TABLE temp_profiles;