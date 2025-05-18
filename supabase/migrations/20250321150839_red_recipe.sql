-- First drop all custom triggers and functions that might cause network issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS delete_storage_objects CASCADE;

-- Reset auth system to basic state
ALTER TABLE auth.users 
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

-- Add back basic email uniqueness without complex indexes
ALTER TABLE auth.users
ADD CONSTRAINT users_email_key UNIQUE (email);

-- Reset permissions to defaults
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;

-- Grant minimal required permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
GRANT INSERT ON auth.users TO anon;
GRANT SELECT, INSERT ON auth.identities TO anon;

-- Create simple function for user creation
CREATE OR REPLACE FUNCTION auth.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';