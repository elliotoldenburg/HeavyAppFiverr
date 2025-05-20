/*
  # Add custom exercises table and policies (idempotent)

  1. Changes
    - Create custom_exercises table if it doesn't exist
    - Drop existing policies before recreating them
    - Enable RLS
    - Add policies for user-specific access

  2. Security
    - Enable RLS on custom_exercises table
    - Add policies for authenticated users to:
      - Create their own exercises
      - Read only their own exercises
      - Update their own exercises
      - Delete their own exercises
*/

-- Create custom_exercises table if it doesn't exist
CREATE TABLE IF NOT EXISTS custom_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  equipment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE custom_exercises ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own custom exercises" ON custom_exercises;
DROP POLICY IF EXISTS "Users can view own custom exercises" ON custom_exercises;
DROP POLICY IF EXISTS "Users can update own custom exercises" ON custom_exercises;
DROP POLICY IF EXISTS "Users can delete own custom exercises" ON custom_exercises;

-- Create policies
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