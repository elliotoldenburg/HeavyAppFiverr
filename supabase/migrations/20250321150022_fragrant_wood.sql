/*
  # Fix user registration and email handling

  1. Changes
    - Clean up duplicate email entries
    - Handle email uniqueness properly
    - Fix index creation error
    - Set up proper permissions
*/

-- First, remove any potential duplicate or invalid entries
DELETE FROM auth.users
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(email)
      ORDER BY created_at DESC
    ) as rnum
    FROM auth.users
  ) t
  WHERE t.rnum > 1
);

-- Drop and recreate the email uniqueness constraint
ALTER TABLE auth.users
DROP CONSTRAINT IF EXISTS users_email_key;

ALTER TABLE auth.users
ADD CONSTRAINT users_email_key UNIQUE (email);

-- Handle the case-insensitive index safely
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

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Reset user registration permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT, INSERT ON TABLES TO anon;

-- Force cache refresh
NOTIFY pgrst, 'reload schema';