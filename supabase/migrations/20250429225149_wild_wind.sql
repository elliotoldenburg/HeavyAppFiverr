/*
  # Create meal logging system
  
  1. New Tables
    - `daily_meal_logs` for tracking daily meal summaries
    - `meal_entries` for tracking individual food items in meals
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure proper data access control
    
  3. RPC Functions
    - `get_meal_log` for retrieving meal data by date
    - `get_daily_totals` for retrieving daily nutrition totals
*/

-- Create daily_meal_logs table
CREATE TABLE IF NOT EXISTS daily_meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('frukost', 'lunch', 'middag', 'mellanmål')),
  total_calories integer NOT NULL DEFAULT 0,
  total_carbs integer NOT NULL DEFAULT 0,
  total_protein integer NOT NULL DEFAULT 0,
  total_fat integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique combination of user, date, and meal type
  UNIQUE(user_id, log_date, meal_type)
);

-- Create meal_entries table
CREATE TABLE IF NOT EXISTS meal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES daily_meal_logs(id) ON DELETE CASCADE,
  food_id uuid REFERENCES food_database(id) ON DELETE SET NULL,
  food_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  calories integer NOT NULL CHECK (calories >= 0),
  carbs integer NOT NULL CHECK (carbs >= 0),
  protein integer NOT NULL CHECK (protein >= 0),
  fat integer NOT NULL CHECK (fat >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE daily_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_meal_logs
CREATE POLICY "Users can insert own daily meal logs"
  ON daily_meal_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own daily meal logs"
  ON daily_meal_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own daily meal logs"
  ON daily_meal_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily meal logs"
  ON daily_meal_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for meal_entries
CREATE POLICY "Users can insert own meal entries"
  ON meal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM daily_meal_logs 
      WHERE id = daily_log_id
    )
  );

CREATE POLICY "Users can read own meal entries"
  ON meal_entries
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM daily_meal_logs 
      WHERE id = daily_log_id
    )
  );

CREATE POLICY "Users can update own meal entries"
  ON meal_entries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM daily_meal_logs 
      WHERE id = daily_log_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM daily_meal_logs 
      WHERE id = daily_log_id
    )
  );

CREATE POLICY "Users can delete own meal entries"
  ON meal_entries
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM daily_meal_logs 
      WHERE id = daily_log_id
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_daily_meal_logs_user_date 
ON daily_meal_logs(user_id, log_date);

CREATE INDEX idx_meal_entries_daily_log 
ON meal_entries(daily_log_id);

-- Create function to update meal log totals when entries are added/updated/deleted
CREATE OR REPLACE FUNCTION update_meal_log_totals()
RETURNS TRIGGER AS $$
DECLARE
  log_user_id uuid;
BEGIN
  -- Get the meal log's user_id
  SELECT user_id INTO log_user_id
  FROM daily_meal_logs
  WHERE id = COALESCE(NEW.daily_log_id, OLD.daily_log_id);
  
  -- Update meal log totals
  UPDATE daily_meal_logs
  SET 
    total_calories = COALESCE((
      SELECT SUM(calories)
      FROM meal_entries
      WHERE daily_log_id = COALESCE(NEW.daily_log_id, OLD.daily_log_id)
    ), 0),
    total_protein = COALESCE((
      SELECT SUM(protein)
      FROM meal_entries
      WHERE daily_log_id = COALESCE(NEW.daily_log_id, OLD.daily_log_id)
    ), 0),
    total_carbs = COALESCE((
      SELECT SUM(carbs)
      FROM meal_entries
      WHERE daily_log_id = COALESCE(NEW.daily_log_id, OLD.daily_log_id)
    ), 0),
    total_fat = COALESCE((
      SELECT SUM(fat)
      FROM meal_entries
      WHERE daily_log_id = COALESCE(NEW.daily_log_id, OLD.daily_log_id)
    ), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.daily_log_id, OLD.daily_log_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for meal_entries
CREATE TRIGGER update_meal_log_totals_insert_update
  AFTER INSERT OR UPDATE ON meal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_log_totals();

CREATE TRIGGER update_meal_log_totals_delete
  AFTER DELETE ON meal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_log_totals();

-- Create function to get meal log for a specific date
CREATE OR REPLACE FUNCTION get_meal_log(p_user_id uuid, p_date date)
RETURNS TABLE (
  meal_type text,
  total_calories integer,
  total_protein integer,
  total_carbs integer,
  total_fat integer,
  entries jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dml.meal_type,
    dml.total_calories,
    dml.total_protein,
    dml.total_carbs,
    dml.total_fat,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', me.id,
          'food_name', me.food_name,
          'quantity', me.quantity,
          'calories', me.calories,
          'protein', me.protein,
          'carbs', me.carbs,
          'fat', me.fat
        )
      ) FILTER (WHERE me.id IS NOT NULL),
      '[]'::jsonb
    ) as entries
  FROM daily_meal_logs dml
  LEFT JOIN meal_entries me ON me.daily_log_id = dml.id
  WHERE 
    dml.user_id = p_user_id AND
    dml.log_date = p_date
  GROUP BY 
    dml.id,
    dml.meal_type,
    dml.total_calories,
    dml.total_protein,
    dml.total_carbs,
    dml.total_fat
  ORDER BY 
    CASE 
      WHEN dml.meal_type = 'frukost' THEN 1
      WHEN dml.meal_type = 'lunch' THEN 2
      WHEN dml.meal_type = 'middag' THEN 3
      WHEN dml.meal_type = 'mellanmål' THEN 4
      ELSE 5
    END;
END;
$$;

-- Create function to get daily totals for a specific date
CREATE OR REPLACE FUNCTION get_daily_totals(p_user_id uuid, p_date date)
RETURNS TABLE (
  total_calories integer,
  total_protein integer,
  total_carbs integer,
  total_fat integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(dml.total_calories), 0) as total_calories,
    COALESCE(SUM(dml.total_protein), 0) as total_protein,
    COALESCE(SUM(dml.total_carbs), 0) as total_carbs,
    COALESCE(SUM(dml.total_fat), 0) as total_fat
  FROM daily_meal_logs dml
  WHERE 
    dml.user_id = p_user_id AND
    dml.log_date = p_date;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_meal_log(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_totals(uuid, date) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';