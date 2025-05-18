-- 1A: Dagliga loggar per datum + måltid
CREATE TABLE daily_meal_logs (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid         NOT NULL REFERENCES auth.users(id),
  log_date   date         NOT NULL,
  meal_type  text         NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  created_at timestamp    NOT NULL DEFAULT now(),
  updated_at timestamp    NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date, meal_type)
);

-- 1B: Enskilda livsmedelsposter
CREATE TABLE meal_entries (
  id               uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id      uuid      NOT NULL REFERENCES daily_meal_logs(id) ON DELETE CASCADE,
  product_id       text      NOT NULL,       -- OFF:s ID
  product_name     text      NOT NULL,
  quantity_grams   numeric   NOT NULL,
  calories_total   numeric   NOT NULL,
  protein_total    numeric   NOT NULL,
  carbs_total      numeric   NOT NULL,
  fat_total        numeric   NOT NULL,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

-- 1C: RLS-policies
ALTER TABLE daily_meal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their logs" ON daily_meal_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their entries" ON meal_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM daily_meal_logs d
      WHERE d.id = meal_log_id AND d.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_meal_logs d
      WHERE d.id = meal_log_id AND d.user_id = auth.uid()
    )
  );

-- Hämta dags-summor (kcal + macros)
CREATE OR REPLACE FUNCTION get_daily_totals(p_user uuid, p_date date)
RETURNS TABLE(
  total_calories numeric,
  total_protein  numeric,
  total_carbs    numeric,
  total_fat      numeric
) LANGUAGE sql SECURITY DEFINER AS $$
SELECT
  COALESCE(sum(calories_total), 0),
  COALESCE(sum(protein_total), 0),
  COALESCE(sum(carbs_total), 0),
  COALESCE(sum(fat_total), 0)
FROM meal_entries e
JOIN daily_meal_logs d ON d.id = e.meal_log_id
WHERE d.user_id = p_user AND d.log_date = p_date;
$$;

-- Hämta alla poster för en specifik måltid
CREATE OR REPLACE FUNCTION get_meal_entries(p_user uuid, p_date date, p_meal text)
RETURNS SETOF meal_entries LANGUAGE sql SECURITY DEFINER AS $$
SELECT e.* FROM meal_entries e
JOIN daily_meal_logs d ON d.id = e.meal_log_id
WHERE d.user_id = p_user AND d.log_date = p_date AND d.meal_type = p_meal
ORDER BY e.created_at;
$$;

-- Hämta måltidssummor per måltid
CREATE OR REPLACE FUNCTION get_meal_totals(p_user uuid, p_date date)
RETURNS TABLE(
  meal_type text,
  total_calories numeric,
  total_protein numeric,
  total_carbs numeric,
  total_fat numeric
) LANGUAGE sql SECURITY DEFINER AS $$
SELECT 
  d.meal_type,
  COALESCE(sum(e.calories_total), 0) as total_calories,
  COALESCE(sum(e.protein_total), 0) as total_protein,
  COALESCE(sum(e.carbs_total), 0) as total_carbs,
  COALESCE(sum(e.fat_total), 0) as total_fat
FROM daily_meal_logs d
LEFT JOIN meal_entries e ON e.meal_log_id = d.id
WHERE d.user_id = p_user AND d.log_date = p_date
GROUP BY d.meal_type
ORDER BY 
  CASE 
    WHEN d.meal_type = 'breakfast' THEN 1
    WHEN d.meal_type = 'lunch' THEN 2
    WHEN d.meal_type = 'dinner' THEN 3
    WHEN d.meal_type = 'snack' THEN 4
    ELSE 5
  END;
$$;

-- Funktion för att lägga till eller uppdatera en måltid
CREATE OR REPLACE FUNCTION upsert_meal_entry(
  p_user_id uuid,
  p_date date,
  p_meal_type text,
  p_product_id text,
  p_product_name text,
  p_quantity_grams numeric,
  p_calories_total numeric,
  p_protein_total numeric,
  p_carbs_total numeric,
  p_fat_total numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_meal_log_id uuid;
  v_entry_id uuid;
BEGIN
  -- Get or create meal log
  SELECT id INTO v_meal_log_id
  FROM daily_meal_logs
  WHERE user_id = p_user_id AND log_date = p_date AND meal_type = p_meal_type;
  
  IF v_meal_log_id IS NULL THEN
    INSERT INTO daily_meal_logs (user_id, log_date, meal_type)
    VALUES (p_user_id, p_date, p_meal_type)
    RETURNING id INTO v_meal_log_id;
  END IF;
  
  -- Insert meal entry
  INSERT INTO meal_entries (
    meal_log_id,
    product_id,
    product_name,
    quantity_grams,
    calories_total,
    protein_total,
    carbs_total,
    fat_total
  ) VALUES (
    v_meal_log_id,
    p_product_id,
    p_product_name,
    p_quantity_grams,
    p_calories_total,
    p_protein_total,
    p_carbs_total,
    p_fat_total
  )
  RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$;