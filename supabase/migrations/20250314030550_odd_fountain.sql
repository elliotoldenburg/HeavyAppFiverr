/*
  # Fix user registration by adding trigger function

  1. Changes
    - Create trigger function to handle new user registration
    - Add trigger to create training profile on user creation
    - Ensure proper error handling
*/

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create a training profile for the new user
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
  );
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log error details
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