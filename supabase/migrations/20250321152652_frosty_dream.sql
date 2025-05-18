-- First, let's check and fix the auth.users table structure
DO $$ 
BEGIN
  -- Drop the email constraint if it exists
  ALTER TABLE auth.users 
  DROP CONSTRAINT IF EXISTS users_email_key CASCADE;
  
  -- Drop any indexes that might interfere
  DROP INDEX IF EXISTS auth.users_email_key;
  DROP INDEX IF EXISTS auth.users_instance_id_email_idx;
  
  -- Recreate the table structure correctly
  ALTER TABLE auth.users
    ALTER COLUMN email TYPE text,
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN encrypted_password DROP NOT NULL,
    ALTER COLUMN email_confirmed_at DROP NOT NULL,
    ALTER COLUMN aud SET DEFAULT 'authenticated',
    ALTER COLUMN role SET DEFAULT 'authenticated';

  -- Add back ONLY the essential constraint
  CREATE UNIQUE INDEX users_email_key ON auth.users (email) WHERE email IS NOT NULL;
  
  -- Grant proper permissions to auth roles
  GRANT ALL ON auth.users TO supabase_auth_admin;
  GRANT ALL ON auth.users TO dashboard_user;
  GRANT ALL ON auth.users TO postgres;
  
  -- Grant minimal permissions to anon
  GRANT ALL ON auth.users TO anon;
  GRANT ALL ON auth.identities TO anon;
  GRANT ALL ON auth.sessions TO anon;
  
  -- Grant read access to authenticated
  GRANT SELECT ON auth.users TO authenticated;

END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';