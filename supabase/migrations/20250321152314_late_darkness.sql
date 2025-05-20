-- First drop everything and start fresh
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS delete_storage_objects CASCADE;

-- Clean up auth schema completely
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;

-- Drop ALL constraints on auth.users
ALTER TABLE auth.users 
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

-- Give anon role FULL ACCESS to auth schema
GRANT ALL ON SCHEMA auth TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO anon;

-- Give anon role specific permissions on critical tables
GRANT ALL ON auth.users TO anon;
GRANT ALL ON auth.identities TO anon;
GRANT ALL ON auth.sessions TO anon;

-- Give authenticated role basic read access
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Grant public schema access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create super simple trigger function that just returns NEW
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Don't even try to create profile yet, just return NEW
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