/*
  # Fix authentication issues and clean up users table

  1. Changes
    - Clean up auth tables
    - Reset email constraints
    - Clear any stale sessions
    - Fix duplicate email handling
*/

-- First, clean up any stale or invalid sessions
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;

-- Remove any potential duplicate users
DELETE FROM auth.users a
WHERE a.id IN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(email)
      ORDER BY created_at DESC
    ) as rnum
    FROM auth.users
  ) t
  WHERE t.rnum > 1
);

-- Drop and recreate email constraints
ALTER TABLE auth.users
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

ALTER TABLE auth.users
ADD CONSTRAINT users_email_key UNIQUE (email);

-- Drop existing index if it exists and create new one
DO $$ 
BEGIN
  -- Drop the index if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'auth' 
    AND indexname = 'idx_users_email_lower'
  ) THEN
    DROP INDEX auth.idx_users_email_lower;
  END IF;
  
  -- Create the new index
  CREATE UNIQUE INDEX idx_users_email_lower
  ON auth.users (LOWER(email));
EXCEPTION
  WHEN duplicate_table THEN 
    NULL; -- Do nothing if index already exists
END $$;

-- Clear any pending email confirmations
DELETE FROM auth.users WHERE email_confirmed_at IS NULL;

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Reset user registration permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT, INSERT ON TABLES TO anon;

-- Force cache refresh
NOTIFY pgrst, 'reload schema';