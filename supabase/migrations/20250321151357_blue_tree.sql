-- First ensure we have a clean slate but keep relationships
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Create the handle_new_user function first
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Check if profile already exists
  SELECT COUNT(*) INTO v_count
  FROM public.training_profiles
  WHERE user_id = NEW.id;

  -- Only create profile if it doesn't exist
  IF v_count = 0 THEN
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
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
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
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger to handle new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure proper permissions for auth operations
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
GRANT INSERT ON auth.users TO anon;
GRANT SELECT, INSERT ON auth.identities TO anon;

-- Ensure proper permissions for profile creation
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.training_profiles TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Ensure proper permissions for all related tables
GRANT ALL ON public.anvandare_program TO authenticated;
GRANT ALL ON public.custom_exercises TO authenticated;
GRANT ALL ON public.workout_logs TO authenticated;
GRANT ALL ON public.exercise_logs TO authenticated;
GRANT ALL ON public.set_logs TO authenticated;
GRANT ALL ON public.weight_tracking TO authenticated;
GRANT ALL ON public.progress_tracking_logs TO authenticated;

-- Ensure sequence permissions for all tables
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';