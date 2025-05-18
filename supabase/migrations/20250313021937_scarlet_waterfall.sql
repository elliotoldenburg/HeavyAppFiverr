/*
  # Fix training profiles schema and refresh cache

  1. Changes
    - Ensure training_profiles table has correct schema
    - Force schema cache refresh
    - Maintain all existing data and relationships
*/

-- Notify about schema changes to force cache refresh
NOTIFY pgrst, 'reload schema';

-- Verify and fix schema if needed
DO $$ 
BEGIN
  -- Ensure table exists with correct schema
  CREATE TABLE IF NOT EXISTS training_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    full_name text NOT NULL,
    age integer NOT NULL,
    gender text NOT NULL,
    height_cm integer NOT NULL,
    weight_kg decimal NOT NULL,
    training_goal text NOT NULL,
    experience_level text NOT NULL,
    equipment_access text NOT NULL,
    injuries text,
    fitness_goal text,
    profile_picture text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_profile UNIQUE (user_id)
  );

  -- Ensure RLS is enabled
  ALTER TABLE training_profiles ENABLE ROW LEVEL SECURITY;

EXCEPTION WHEN duplicate_table THEN
  -- Table already exists, ensure columns are correct
  BEGIN
    ALTER TABLE training_profiles 
      ALTER COLUMN height_cm SET NOT NULL,
      ALTER COLUMN weight_kg SET NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    -- If columns don't exist, add them
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'training_profiles' 
      AND column_name = 'height_cm'
    ) THEN
      ALTER TABLE training_profiles ADD COLUMN height_cm integer NOT NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'training_profiles' 
      AND column_name = 'weight_kg'
    ) THEN
      ALTER TABLE training_profiles ADD COLUMN weight_kg decimal NOT NULL;
    END IF;
  END;
END $$;

-- Ensure policies exist
DO $$ 
BEGIN
  -- Recreate policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'training_profiles' 
    AND policyname = 'Users can read own training profile'
  ) THEN
    CREATE POLICY "Users can read own training profile"
      ON training_profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'training_profiles' 
    AND policyname = 'Users can update own training profile'
  ) THEN
    CREATE POLICY "Users can update own training profile"
      ON training_profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'training_profiles' 
    AND policyname = 'Users can insert own training profile'
  ) THEN
    CREATE POLICY "Users can insert own training profile"
      ON training_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure trigger exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'update_training_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_training_profiles_updated_at
      BEFORE UPDATE ON training_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Force schema cache refresh again
NOTIFY pgrst, 'reload schema';