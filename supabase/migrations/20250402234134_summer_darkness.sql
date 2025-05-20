/*
  # Create food_database table
  
  1. New Table
    - `food_database` for storing nutrition information about foods
    
  2. Security
    - Enable RLS
    - Add policy for public read access
    - No INSERT/UPDATE policies yet
*/

-- Create food_database table
CREATE TABLE IF NOT EXISTS food_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  kcal_per_100g decimal NOT NULL,
  protein_per_100g decimal NOT NULL,
  fat_per_100g decimal NOT NULL,
  carbs_per_100g decimal NOT NULL,
  brand text,
  barcode text,
  source text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure nutrition values are positive
  CONSTRAINT positive_kcal CHECK (kcal_per_100g >= 0),
  CONSTRAINT positive_protein CHECK (protein_per_100g >= 0),
  CONSTRAINT positive_fat CHECK (fat_per_100g >= 0),
  CONSTRAINT positive_carbs CHECK (carbs_per_100g >= 0)
);

-- Enable RLS
ALTER TABLE food_database ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to food database"
  ON food_database
  FOR SELECT
  TO public
  USING (true);

-- Create indexes for better search performance
CREATE INDEX idx_food_database_name 
ON food_database(name);

CREATE INDEX idx_food_database_category
ON food_database(category);

CREATE INDEX idx_food_database_barcode
ON food_database(barcode)
WHERE barcode IS NOT NULL;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';