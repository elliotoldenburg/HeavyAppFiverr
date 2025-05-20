/*
  # Add food logging functionality
  
  1. New Tables
    - `food_logs` for tracking user meal entries
    - `user_settings` for storing API keys and preferences
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure proper data access control
*/

-- Create food_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_name text NOT NULL,
  food_name text NOT NULL,
  source text NOT NULL,
  energy_kcal integer NOT NULL,
  protein_g integer NOT NULL,
  fat_g integer NOT NULL,
  carbs_g integer NOT NULL,
  quantity integer NOT NULL,
  logged_at timestamptz DEFAULT now(),
  
  -- Ensure calories and macros are positive
  CONSTRAINT positive_energy CHECK (energy_kcal >= 0),
  CONSTRAINT positive_protein CHECK (protein_g >= 0),
  CONSTRAINT positive_carbs CHECK (carbs_g >= 0),
  CONSTRAINT positive_fat CHECK (fat_g >= 0),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Create user_settings table for API keys if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  livsmedelsverket_api_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one settings record per user
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own food logs" ON food_logs;
DROP POLICY IF EXISTS "Users can read own food logs" ON food_logs;
DROP POLICY IF EXISTS "Users can update own food logs" ON food_logs;
DROP POLICY IF EXISTS "Users can delete own food logs" ON food_logs;

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

-- Create policies for food_logs
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

-- Create policies for user_settings
CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
DROP INDEX IF EXISTS idx_food_logs_user_date;
CREATE INDEX idx_food_logs_user_date 
ON food_logs(user_id, logged_at);

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_daily_nutrition_summary;
DROP FUNCTION IF EXISTS update_user_settings;

-- Create function to get daily nutrition summary
CREATE OR REPLACE FUNCTION get_daily_nutrition_summary(
  p_date date DEFAULT CURRENT_DATE
)
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
  
  -- Get daily nutrition summary
  SELECT json_build_object(
    'total_calories', COALESCE(SUM(energy_kcal), 0),
    'total_protein', COALESCE(SUM(protein_g), 0),
    'total_carbs', COALESCE(SUM(carbs_g), 0),
    'total_fat', COALESCE(SUM(fat_g), 0),
    'meals', COALESCE(
      json_agg(
        json_build_object(
          'id', id,
          'meal_name', meal_name,
          'food_name', food_name,
          'energy_kcal', energy_kcal,
          'protein_g', protein_g,
          'carbs_g', carbs_g,
          'fat_g', fat_g,
          'quantity', quantity,
          'logged_at', logged_at
        )
        ORDER BY logged_at DESC
      ),
      '[]'::json
    )
  )
  INTO v_result
  FROM food_logs
  WHERE 
    user_id = v_user_id AND
    DATE(logged_at) = p_date
  GROUP BY DATE(logged_at);
  
  -- Handle case when no meals are found
  IF v_result IS NULL THEN
    v_result := json_build_object(
      'total_calories', 0,
      'total_protein', 0,
      'total_carbs', 0,
      'total_fat', 0,
      'meals', '[]'::json
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Create function to update user settings
CREATE OR REPLACE FUNCTION update_user_settings(
  p_livsmedelsverket_api_key text
)
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
  
  -- Update user settings
  INSERT INTO user_settings (
    user_id,
    livsmedelsverket_api_key,
    updated_at
  )
  VALUES (
    v_user_id,
    p_livsmedelsverket_api_key,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    livsmedelsverket_api_key = p_livsmedelsverket_api_key,
    updated_at = now()
  RETURNING to_json(*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_daily_nutrition_summary TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_settings TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';