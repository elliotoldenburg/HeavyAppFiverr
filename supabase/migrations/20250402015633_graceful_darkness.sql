/*
  # Create macro_goals table for nutrition tracking

  1. New Tables
    - `macro_goals` for storing user nutrition goals
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure proper data access control
*/

-- Create macro_goals table
CREATE TABLE IF NOT EXISTS macro_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg decimal NOT NULL,
  height_cm decimal NOT NULL,
  gender text NOT NULL,
  age integer NOT NULL,
  activity_level text NOT NULL,
  goal text NOT NULL,
  calculated_calories integer NOT NULL,
  calculated_protein decimal NOT NULL,
  calculated_carbs decimal NOT NULL,
  calculated_fat decimal NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE macro_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert own macro goals"
  ON macro_goals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own macro goals"
  ON macro_goals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own macro goals"
  ON macro_goals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_macro_goals_user_id 
ON macro_goals(user_id);

-- Create function to get latest macro goals for a user
CREATE OR REPLACE FUNCTION get_latest_macro_goals()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get the latest macro goals
  SELECT json_build_object(
    'id', id,
    'weight_kg', weight_kg,
    'height_cm', height_cm,
    'gender', gender,
    'age', age,
    'activity_level', activity_level,
    'goal', goal,
    'calculated_calories', calculated_calories,
    'calculated_protein', calculated_protein,
    'calculated_carbs', calculated_carbs,
    'calculated_fat', calculated_fat,
    'created_at', created_at
  )
  INTO v_result
  FROM macro_goals
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_latest_macro_goals TO authenticated;