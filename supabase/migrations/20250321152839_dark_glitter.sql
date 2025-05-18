-- First, reset all auth table structure and permissions
DO $$ 
BEGIN
  -- Drop all existing auth constraints and triggers
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
  DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
  
  -- Reset auth.users table structure
  ALTER TABLE auth.users
    ALTER COLUMN email TYPE text,
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN encrypted_password DROP NOT NULL,
    ALTER COLUMN email_confirmed_at DROP NOT NULL,
    ALTER COLUMN aud SET DEFAULT 'authenticated',
    ALTER COLUMN role SET DEFAULT 'authenticated',
    ALTER COLUMN raw_app_meta_data SET DEFAULT '{"provider":"email","providers":["email"]}';

  -- Drop ALL existing permissions
  REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
  REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
  REVOKE ALL ON SCHEMA auth FROM anon, authenticated;
  
  -- Grant base schema access
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  
  -- Grant anon role full access to critical auth tables
  GRANT ALL ON auth.users TO anon;
  GRANT ALL ON auth.identities TO anon;
  GRANT ALL ON auth.sessions TO anon;
  GRANT ALL ON auth.refresh_tokens TO anon;
  
  -- Grant authenticated role read-only access
  GRANT SELECT ON auth.users TO authenticated;
  
  -- Grant public schema access
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';