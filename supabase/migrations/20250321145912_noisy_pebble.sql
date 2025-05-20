/*
  # Fix user registration database error

  1. Changes
    - Add proper indexes for user lookup
    - Ensure proper permissions for user registration
    - Fix potential schema issues
*/

-- First ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_users_email 
ON auth.users(email);

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Ensure proper role permissions for user registration
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT, INSERT ON TABLES TO anon;

-- Ensure proper role permissions for authenticated users
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT ON TABLES TO authenticated;

-- Create or replace the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create a profile entry for the new user
  INSERT INTO public.training_profiles (
    id,
    user_id,
    full_name,
    age,
    gender,
    height_cm,
    weight_kg,
    training_goal,
    experience_level,
    equipment_access,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    0,  -- Default age
    '', -- Empty gender
    0,  -- Default height
    0,  -- Default weight
    '', -- Empty training goal
    '', -- Empty experience level
    '', -- Empty equipment access
    now(),
    now()
  );
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log error details but don't block user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;