-- First reset all auth permissions
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Reset auth.users constraints and indexes
ALTER TABLE auth.users 
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

DROP INDEX IF EXISTS auth.users_email_key;
DROP INDEX IF EXISTS auth.users_instance_id_email_idx;

-- Reset auth.users structure
ALTER TABLE auth.users
  ALTER COLUMN email TYPE text,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN encrypted_password DROP NOT NULL,
  ALTER COLUMN email_confirmed_at DROP NOT NULL,
  ALTER COLUMN aud SET DEFAULT 'authenticated',
  ALTER COLUMN role SET DEFAULT 'authenticated',
  ALTER COLUMN raw_app_meta_data SET DEFAULT '{"provider":"email","providers":["email"]}';

-- Grant full access to auth schema for registration
GRANT USAGE ON SCHEMA auth TO anon;
GRANT ALL ON auth.users TO anon;
GRANT ALL ON auth.identities TO anon;
GRANT ALL ON auth.sessions TO anon;
GRANT ALL ON auth.refresh_tokens TO anon;

-- Grant basic access to authenticated users
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Grant access to public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create simple profile creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    '',
    0,
    '',
    0,
    0,
    '',
    '',
    '',
    now(),
    now()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RETURN NEW;
END;
$$;

-- Create basic trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';