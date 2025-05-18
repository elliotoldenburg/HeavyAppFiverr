/*
  # Fix training profiles table column names

  1. Changes
    - Ensure column names match application expectations
    - Fix height column name
    - Add any missing columns
    - Preserve existing data

  2. Data Preservation
    - Use ALTER TABLE to rename columns
    - Keep existing data intact
*/

-- First check if the old column exists and rename it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'training_profiles' 
    AND column_name = 'height'
  ) THEN
    ALTER TABLE training_profiles RENAME COLUMN height TO height_cm;
  END IF;
END $$;

-- Ensure all required columns exist with correct names
DO $$ 
BEGIN
  -- Add height_cm if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'training_profiles' 
    AND column_name = 'height_cm'
  ) THEN
    ALTER TABLE training_profiles ADD COLUMN height_cm integer NOT NULL;
  END IF;

  -- Add weight_kg if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'training_profiles' 
    AND column_name = 'weight_kg'
  ) THEN
    ALTER TABLE training_profiles ADD COLUMN weight_kg decimal NOT NULL;
  END IF;

  -- Add other required columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'training_profiles' 
    AND column_name = 'profile_picture'
  ) THEN
    ALTER TABLE training_profiles ADD COLUMN profile_picture text;
  END IF;
END $$;