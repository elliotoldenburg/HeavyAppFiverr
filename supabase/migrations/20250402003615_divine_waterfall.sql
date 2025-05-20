/*
  # Create macrotracker tables

  1. New Tables
    - `food_logs` for tracking user meal entries
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure proper data access control
*/

-- Create meals table
CREATE TABLE meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_calories integer NOT NULL DEFAULT 0,
  total_protein integer NOT NULL DEFAULT 0,
  total_carbs integer NOT NULL DEFAULT 0,
  total_fat integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure calories and macros are positive
  CONSTRAINT positive_total_calories CHECK (total_calories >= 0),
  CONSTRAINT positive_total_protein CHECK (total_protein >= 0),
  CONSTRAINT positive_total_carbs CHECK (total_carbs >= 0),
  CONSTRAINT positive_total_fat CHECK (total_fat >= 0)
);

-- Create meal_items table
CREATE TABLE meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  brand text,
  quantity_grams integer NOT NULL,
  energy_kcal_100g numeric NOT NULL,
  protein_100g numeric NOT NULL,
  fat_100g numeric NOT NULL,
  carbs_100g numeric NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure quantity and macros are positive
  CONSTRAINT positive_quantity CHECK (quantity_grams > 0),
  CONSTRAINT positive_energy CHECK (energy_kcal_100g >= 0),
  CONSTRAINT positive_protein CHECK (protein_100g >= 0),
  CONSTRAINT positive_fat CHECK (fat_100g >= 0),
  CONSTRAINT positive_carbs CHECK (carbs_100g >= 0)
);

-- Enable RLS on all tables
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;

-- Create policies for meals
CREATE POLICY "Users can insert own meals"
  ON meals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own meals"
  ON meals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
  ON meals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
  ON meals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for meal_items
CREATE POLICY "Users can insert own meal items"
  ON meal_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM meals 
      WHERE id = meal_id
    )
  );

CREATE POLICY "Users can read own meal items"
  ON meal_items
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM meals 
      WHERE id = meal_id
    )
  );

CREATE POLICY "Users can update own meal items"
  ON meal_items
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM meals 
      WHERE id = meal_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM meals 
      WHERE id = meal_id
    )
  );

CREATE POLICY "Users can delete own meal items"
  ON meal_items
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM meals 
      WHERE id = meal_id
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_meals_user_date 
ON meals(user_id, created_at);

CREATE INDEX idx_meal_items_meal 
ON meal_items(meal_id);

-- Create function to update meal totals when items are added/updated/deleted
CREATE OR REPLACE FUNCTION update_meal_totals()
RETURNS TRIGGER AS $$
DECLARE
  meal_user_id uuid;
BEGIN
  -- Get the meal's user_id
  SELECT user_id INTO meal_user_id
  FROM meals
  WHERE id = COALESCE(NEW.meal_id, OLD.meal_id);
  
  -- Update meal totals
  UPDATE meals
  SET 
    total_calories = COALESCE((
      SELECT SUM(ROUND((energy_kcal_100g * quantity_grams) / 100))
      FROM meal_items
      WHERE meal_id = COALESCE(NEW.meal_id, OLD.meal_id)
    ), 0),
    total_protein = COALESCE((
      SELECT SUM(ROUND((protein_100g * quantity_grams) / 100))
      FROM meal_items
      WHERE meal_id = COALESCE(NEW.meal_id, OLD.meal_id)
    ), 0),
    total_carbs = COALESCE((
      SELECT SUM(ROUND((carbs_100g * quantity_grams) / 100))
      FROM meal_items
      WHERE meal_id = COALESCE(NEW.meal_id, OLD.meal_id)
    ), 0),
    total_fat = COALESCE((
      SELECT SUM(ROUND((fat_100g * quantity_grams) / 100))
      FROM meal_items
      WHERE meal_id = COALESCE(NEW.meal_id, OLD.meal_id)
    ), 0)
  WHERE id = COALESCE(NEW.meal_id, OLD.meal_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for meal_items
CREATE TRIGGER update_meal_totals_insert_update
  AFTER INSERT OR UPDATE ON meal_items
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_totals();

CREATE TRIGGER update_meal_totals_delete
  AFTER DELETE ON meal_items
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_totals();

-- Create function to get daily nutrition summary with unique name
CREATE OR REPLACE FUNCTION get_daily_nutrition_summary_meals(p_date date DEFAULT CURRENT_DATE)
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
    'total_calories', COALESCE(SUM(total_calories), 0),
    'total_protein', COALESCE(SUM(total_protein), 0),
    'total_carbs', COALESCE(SUM(total_carbs), 0),
    'total_fat', COALESCE(SUM(total_fat), 0),
    'meals', COALESCE(
      json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'total_calories', total_calories,
          'total_protein', total_protein,
          'total_carbs', total_carbs,
          'total_fat', total_fat,
          'created_at', created_at
        )
        ORDER BY created_at DESC
      ),
      '[]'::json
    )
  )
  INTO v_result
  FROM meals
  WHERE 
    user_id = v_user_id AND
    DATE(created_at) = p_date
  GROUP BY DATE(created_at);
  
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

-- Create function to get meal details with items
CREATE OR REPLACE FUNCTION get_meal_with_items(p_meal_id uuid)
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
  
  -- Get meal with items
  SELECT json_build_object(
    'id', m.id,
    'name', m.name,
    'total_calories', m.total_calories,
    'total_protein', m.total_protein,
    'total_carbs', m.total_carbs,
    'total_fat', m.total_fat,
    'created_at', m.created_at,
    'items', COALESCE(
      json_agg(
        json_build_object(
          'id', mi.id,
          'product_name', mi.product_name,
          'brand', mi.brand,
          'quantity_grams', mi.quantity_grams,
          'energy_kcal_100g', mi.energy_kcal_100g,
          'protein_100g', mi.protein_100g,
          'fat_100g', mi.fat_100g,
          'carbs_100g', mi.carbs_100g,
          'image_url', mi.image_url,
          'created_at', mi.created_at,
          'calories', ROUND((mi.energy_kcal_100g * mi.quantity_grams) / 100),
          'protein', ROUND((mi.protein_100g * mi.quantity_grams) / 100),
          'carbs', ROUND((mi.carbs_100g * mi.quantity_grams) / 100),
          'fat', ROUND((mi.fat_100g * mi.quantity_grams) / 100)
        )
        ORDER BY mi.created_at DESC
      ),
      '[]'::json
    )
  )
  INTO v_result
  FROM meals m
  LEFT JOIN meal_items mi ON mi.meal_id = m.id
  WHERE 
    m.id = p_meal_id AND
    m.user_id = v_user_id
  GROUP BY m.id;
  
  RETURN v_result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_daily_nutrition_summary_meals TO authenticated;
GRANT EXECUTE ON FUNCTION get_meal_with_items TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';