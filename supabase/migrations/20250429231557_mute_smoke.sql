-- Step 1: Alter existing tables to add new columns
ALTER TABLE meals
ADD COLUMN IF NOT EXISTS log_date DATE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE meal_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill log_date from created_at for existing meals
UPDATE meals
SET log_date = DATE(created_at)
WHERE log_date IS NULL;

-- Make log_date NOT NULL after backfill
ALTER TABLE meals
ALTER COLUMN log_date SET NOT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at on UPDATE
DROP TRIGGER IF EXISTS update_meals_updated_at ON meals;
CREATE TRIGGER update_meals_updated_at
BEFORE UPDATE ON meals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_items_updated_at ON meal_items;
CREATE TRIGGER update_meal_items_updated_at
BEFORE UPDATE ON meal_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Step 2: Create daily_meal_logs table if it doesn't exist
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

-- Create meal_entries table if it doesn't exist
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own daily meal logs" ON daily_meal_logs;
DROP POLICY IF EXISTS "Users can read own daily meal logs" ON daily_meal_logs;
DROP POLICY IF EXISTS "Users can update own daily meal logs" ON daily_meal_logs;
DROP POLICY IF EXISTS "Users can delete own daily meal logs" ON daily_meal_logs;

DROP POLICY IF EXISTS "Users can insert own meal entries" ON meal_entries;
DROP POLICY IF EXISTS "Users can read own meal entries" ON meal_entries;
DROP POLICY IF EXISTS "Users can update own meal entries" ON meal_entries;
DROP POLICY IF EXISTS "Users can delete own meal entries" ON meal_entries;

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
CREATE INDEX IF NOT EXISTS idx_daily_meal_logs_user_date 
ON daily_meal_logs(user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_meal_entries_daily_log 
ON meal_entries(daily_log_id);

-- Step 3: Backfill data from existing tables to new structure
-- First, create daily_meal_logs entries for each unique (user_id, log_date, meal_name) combination
INSERT INTO daily_meal_logs (user_id, log_date, meal_type, total_calories, total_protein, total_carbs, total_fat)
SELECT 
  m.user_id,
  m.log_date,
  LOWER(m.name) as meal_type,
  SUM(m.total_calories) as total_calories,
  SUM(m.total_protein) as total_protein,
  SUM(m.total_carbs) as total_carbs,
  SUM(m.total_fat) as total_fat
FROM meals m
WHERE 
  LOWER(m.name) IN ('frukost', 'lunch', 'middag', 'mellanmål')
GROUP BY 
  m.user_id, 
  m.log_date, 
  LOWER(m.name)
ON CONFLICT (user_id, log_date, meal_type) 
DO UPDATE SET
  total_calories = EXCLUDED.total_calories,
  total_protein = EXCLUDED.total_protein,
  total_carbs = EXCLUDED.total_carbs,
  total_fat = EXCLUDED.total_fat,
  updated_at = now();

-- Then, create meal_entries for each meal_item
WITH meal_data AS (
  SELECT 
    m.id as meal_id,
    m.user_id,
    m.log_date,
    LOWER(m.name) as meal_type,
    mi.id as meal_item_id,
    mi.product_name,
    mi.quantity_grams,
    ROUND((mi.energy_kcal_100g * mi.quantity_grams) / 100) as calories,
    ROUND((mi.protein_100g * mi.quantity_grams) / 100) as protein,
    ROUND((mi.carbs_100g * mi.quantity_grams) / 100) as carbs,
    ROUND((mi.fat_100g * mi.quantity_grams) / 100) as fat
  FROM meals m
  JOIN meal_items mi ON mi.meal_id = m.id
  WHERE LOWER(m.name) IN ('frukost', 'lunch', 'middag', 'mellanmål')
),
daily_logs AS (
  SELECT 
    dml.id as daily_log_id,
    dml.user_id,
    dml.log_date,
    dml.meal_type
  FROM daily_meal_logs dml
)
INSERT INTO meal_entries (
  daily_log_id,
  food_name,
  quantity,
  calories,
  protein,
  carbs,
  fat
)
SELECT 
  dl.daily_log_id,
  md.product_name,
  md.quantity_grams,
  md.calories,
  md.protein,
  md.carbs,
  md.fat
FROM meal_data md
JOIN daily_logs dl ON 
  dl.user_id = md.user_id AND 
  dl.log_date = md.log_date AND 
  dl.meal_type = md.meal_type;

-- Step 4: Create function to update meal log totals when entries are added/updated/deleted
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_meal_log_totals_insert_update ON meal_entries;
DROP TRIGGER IF EXISTS update_meal_log_totals_delete ON meal_entries;

-- Create triggers for meal_entries
CREATE TRIGGER update_meal_log_totals_insert_update
  AFTER INSERT OR UPDATE ON meal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_log_totals();

CREATE TRIGGER update_meal_log_totals_delete
  AFTER DELETE ON meal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_log_totals();

-- Step 5: Create functions to sync between old and new tables
-- Function to sync from meals/meal_items to daily_meal_logs/meal_entries
CREATE OR REPLACE FUNCTION sync_from_meals_to_daily_logs()
RETURNS TRIGGER AS $$
DECLARE
  v_daily_log_id uuid;
  v_meal_type text;
BEGIN
  -- Only process meals with valid meal types
  IF LOWER(NEW.name) NOT IN ('frukost', 'lunch', 'middag', 'mellanmål') THEN
    RETURN NEW;
  END IF;
  
  v_meal_type := LOWER(NEW.name);
  
  -- Insert or update daily_meal_logs
  INSERT INTO daily_meal_logs (
    user_id,
    log_date,
    meal_type,
    total_calories,
    total_protein,
    total_carbs,
    total_fat
  ) VALUES (
    NEW.user_id,
    NEW.log_date,
    v_meal_type,
    NEW.total_calories,
    NEW.total_protein,
    NEW.total_carbs,
    NEW.total_fat
  )
  ON CONFLICT (user_id, log_date, meal_type) 
  DO UPDATE SET
    total_calories = NEW.total_calories,
    total_protein = NEW.total_protein,
    total_carbs = NEW.total_carbs,
    total_fat = NEW.total_fat,
    updated_at = now()
  RETURNING id INTO v_daily_log_id;
  
  -- If this is a DELETE operation, we don't need to sync meal items
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync from meal_items to meal_entries
CREATE OR REPLACE FUNCTION sync_meal_item_to_meal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_meal_type text;
  v_log_date date;
  v_user_id uuid;
  v_daily_log_id uuid;
  v_calories integer;
  v_protein integer;
  v_carbs integer;
  v_fat integer;
BEGIN
  -- Get meal info
  SELECT 
    LOWER(m.name),
    m.log_date,
    m.user_id
  INTO 
    v_meal_type,
    v_log_date,
    v_user_id
  FROM meals m
  WHERE m.id = NEW.meal_id;
  
  -- Only process meals with valid meal types
  IF v_meal_type NOT IN ('frukost', 'lunch', 'middag', 'mellanmål') THEN
    RETURN NEW;
  END IF;
  
  -- Calculate nutrition values
  v_calories := ROUND((NEW.energy_kcal_100g * NEW.quantity_grams) / 100);
  v_protein := ROUND((NEW.protein_100g * NEW.quantity_grams) / 100);
  v_carbs := ROUND((NEW.carbs_100g * NEW.quantity_grams) / 100);
  v_fat := ROUND((NEW.fat_100g * NEW.quantity_grams) / 100);
  
  -- Get daily_log_id
  SELECT id INTO v_daily_log_id
  FROM daily_meal_logs
  WHERE 
    user_id = v_user_id AND
    log_date = v_log_date AND
    meal_type = v_meal_type;
    
  -- If no daily log exists, create one
  IF v_daily_log_id IS NULL THEN
    INSERT INTO daily_meal_logs (
      user_id,
      log_date,
      meal_type,
      total_calories,
      total_protein,
      total_carbs,
      total_fat
    ) VALUES (
      v_user_id,
      v_log_date,
      v_meal_type,
      v_calories,
      v_protein,
      v_carbs,
      v_fat
    )
    RETURNING id INTO v_daily_log_id;
  END IF;
  
  -- Insert meal entry
  INSERT INTO meal_entries (
    daily_log_id,
    food_name,
    quantity,
    calories,
    protein,
    carbs,
    fat
  ) VALUES (
    v_daily_log_id,
    NEW.product_name,
    NEW.quantity_grams,
    v_calories,
    v_protein,
    v_carbs,
    v_fat
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle meal_item deletion
CREATE OR REPLACE FUNCTION handle_meal_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_meal_type text;
  v_log_date date;
  v_user_id uuid;
  v_daily_log_id uuid;
BEGIN
  -- Get meal info
  SELECT 
    LOWER(m.name),
    m.log_date,
    m.user_id
  INTO 
    v_meal_type,
    v_log_date,
    v_user_id
  FROM meals m
  WHERE m.id = OLD.meal_id;
  
  -- Only process meals with valid meal types
  IF v_meal_type NOT IN ('frukost', 'lunch', 'middag', 'mellanmål') THEN
    RETURN OLD;
  END IF;
  
  -- Get daily_log_id
  SELECT id INTO v_daily_log_id
  FROM daily_meal_logs
  WHERE 
    user_id = v_user_id AND
    log_date = v_log_date AND
    meal_type = v_meal_type;
    
  -- If daily log exists, update its totals
  IF v_daily_log_id IS NOT NULL THEN
    -- The update_meal_log_totals trigger will handle recalculating totals
    -- We just need to ensure the daily log exists
    NULL;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_meals_to_daily_logs ON meals;
DROP TRIGGER IF EXISTS sync_meal_item_to_meal_entry ON meal_items;
DROP TRIGGER IF EXISTS handle_meal_item_delete_trigger ON meal_items;

-- Create triggers for syncing
CREATE TRIGGER sync_meals_to_daily_logs
  AFTER INSERT OR UPDATE ON meals
  FOR EACH ROW
  EXECUTE FUNCTION sync_from_meals_to_daily_logs();

CREATE TRIGGER sync_meal_item_to_meal_entry
  AFTER INSERT OR UPDATE ON meal_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_meal_item_to_meal_entry();

CREATE TRIGGER handle_meal_item_delete_trigger
  AFTER DELETE ON meal_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_meal_item_delete();

-- Step 6: Create functions for the API
-- Function to get meal log for a specific date
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

-- Function to get daily totals for a specific date
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