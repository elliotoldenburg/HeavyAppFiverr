/*
  # Fix RLS policies for meals and meal_items tables
  
  1. Changes
    - Update RLS policies to properly handle authenticated users
    - Fix INSERT permissions for meals and meal_items
    - Ensure proper data access control
*/

-- Drop existing policies for meals
DROP POLICY IF EXISTS "Users can insert own meals" ON meals;
DROP POLICY IF EXISTS "Users can read own meals" ON meals;
DROP POLICY IF EXISTS "Users can update own meals" ON meals;
DROP POLICY IF EXISTS "Users can delete own meals" ON meals;

-- Create new policies for meals with proper permissions
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

-- Drop existing policies for meal_items
DROP POLICY IF EXISTS "Users can insert own meal items" ON meal_items;
DROP POLICY IF EXISTS "Users can read own meal items" ON meal_items;
DROP POLICY IF EXISTS "Users can update own meal items" ON meal_items;
DROP POLICY IF EXISTS "Users can delete own meal items" ON meal_items;

-- Create new policies for meal_items with proper permissions
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

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';