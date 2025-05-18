-- First, completely reset the auth system
DO $$ 
BEGIN
  -- Drop all existing triggers and functions
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
  DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
  
  -- Drop ALL existing permissions
  REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
  REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
  REVOKE ALL ON SCHEMA auth FROM anon, authenticated;
  
  -- Drop ALL constraints on auth.users
  ALTER TABLE auth.users 
  DROP CONSTRAINT IF EXISTS users_email_key CASCADE;
  
  -- Reset auth.users table structure to most basic form
  ALTER TABLE auth.users
    ALTER COLUMN email TYPE text,
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN encrypted_password DROP NOT NULL,
    ALTER COLUMN email_confirmed_at DROP NOT NULL,
    ALTER COLUMN aud SET DEFAULT 'authenticated',
    ALTER COLUMN role SET DEFAULT 'authenticated',
    ALTER COLUMN raw_app_meta_data SET DEFAULT '{"provider":"email","providers":["email"]}';

  -- Grant FULL ACCESS to anon role (this is critical for registration)
  GRANT ALL ON SCHEMA auth TO anon;
  GRANT ALL ON ALL TABLES IN SCHEMA auth TO anon;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO anon;
  GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO anon;

  -- Grant read-only access to authenticated role
  GRANT USAGE ON SCHEMA auth TO authenticated;
  GRANT SELECT ON auth.users TO authenticated;

  -- Grant public schema access
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';