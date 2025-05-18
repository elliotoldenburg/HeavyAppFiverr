/*
  # Fix profile creation duplicate key error

  1. Changes
    - Update trigger function to use ON CONFLICT DO NOTHING
    - Add error handling for unique constraint violations
    - Ensure only one profile per user
*/

-- Create or replace the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Try to create a training profile for the new user
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
    new.raw_user_meta_data->>'full_name',
    0, -- Default age
    '', -- Empty gender
    0,  -- Default height
    0,  -- Default weight
    '', -- Empty training goal
    '', -- Empty experience level
    '', -- Empty equipment access
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just continue
    RETURN new;
  WHEN others THEN
    -- Log other errors but don't fail
    RAISE NOTICE 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();