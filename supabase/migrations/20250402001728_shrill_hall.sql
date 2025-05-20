/*
  # Add food logging functionality
  
  1. New Tables
    - `food_logs` for tracking user meal entries
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure proper data access control
*/

-- Create food_logs table
CREATE TABLE food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_name text NOT NULL,
  calories integer NOT NULL,
  protein integer NOT NULL,
  carbs integer NOT NULL,
  fat integer NOT NULL,
  logged_at timestamptz DEFAULT now(),
  
  -- Ensure calories and macros are positive
  CONSTRAINT positive_calories CHECK (calories >= 0),
  CONSTRAINT positive_protein CHECK (protein >= 0),
  CONSTRAINT positive_carbs CHECK (carbs >= 0),
  CONSTRAINT positive_fat CHECK (fat >= 0)
);

-- Enable RLS
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert own food logs"
  ON food_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own food logs"
  ON food_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs"
  ON food_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs"
  ON food_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_food_logs_user_date 
ON food_logs(user_id, logged_at);

-- Create function to get daily nutrition summary
CREATE OR REPLACE FUNCTION get_daily_nutrition_summary(
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_calories', COALESCE(SUM(calories), 0),
    'total_protein', COALESCE(SUM(protein), 0),
    'total_carbs', COALESCE(SUM(carbs), 0),
    'total_fat', COALESCE(SUM(fat), 0),
    'meals', json_agg(
      json_build_object(
        'id', id,
        'meal_name', meal_name,
        'calories', calories,
        'protein', protein,
        'carbs', carbs,
        'fat', fat,
        'logged_at', logged_at
      )
      ORDER BY logged_at DESC
    )
  )
  INTO v_result
  FROM food_logs
  WHERE 
    user_id = p_user_id AND
    DATE(logged_at) = p_date;
  
  -- Handle case when no meals are found
  IF v_result IS NULL OR v_result->>'meals' = 'null' THEN
    v_result := json_build_object(
      'total_calories', 0,
      'total_protein', 0,
      'total_carbs', 0,
      'total_fat', 0,
      'meals', '[]'
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_daily_nutrition_summary TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';