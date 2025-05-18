/*
  # Remove automatic profile creation on signup

  1. Changes
    - Remove trigger that automatically creates training profiles
    - Clean up related functions
    - Keep training_profiles table but let it be created during onboarding
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Make sure RLS is still enabled on training_profiles
ALTER TABLE training_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist for training_profiles
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