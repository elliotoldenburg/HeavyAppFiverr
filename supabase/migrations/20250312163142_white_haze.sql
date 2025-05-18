/*
  # Add weight tracking functionality

  1. New Tables
    - `weight_tracking`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `date` (date)
      - `weight_kg` (decimal)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on weight_tracking table
    - Add policies for authenticated users to:
      - Insert their own weight records
      - Read their own weight records
      - Update their own weight records
      - Delete their own weight records
*/

-- Create weight_tracking table
CREATE TABLE IF NOT EXISTS weight_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg decimal NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- Add unique constraint to prevent multiple entries for same date
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE weight_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert own weight records"
  ON weight_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own weight records"
  ON weight_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own weight records"
  ON weight_tracking
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight records"
  ON weight_tracking
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);