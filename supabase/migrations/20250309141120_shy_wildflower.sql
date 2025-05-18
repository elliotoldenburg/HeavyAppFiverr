/*
  # Create training profiles table

  1. New Tables
    - `training_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `full_name` (text)
      - `age` (integer)
      - `gender` (text)
      - `height` (integer)
      - `weight` (integer)
      - `training_goal` (text)
      - `experience_level` (text)
      - `equipment_access` (text)
      - `injuries` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `training_profiles` table
    - Add policies for authenticated users to:
      - Read their own profile
      - Update their own profile
*/

CREATE TABLE IF NOT EXISTS training_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  age integer NOT NULL,
  gender text NOT NULL,
  height integer NOT NULL,
  weight integer NOT NULL,
  training_goal text NOT NULL,
  experience_level text NOT NULL,
  equipment_access text NOT NULL,
  injuries text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

ALTER TABLE training_profiles ENABLE ROW LEVEL SECURITY;

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

-- Create trigger to update updated_at timestamp
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