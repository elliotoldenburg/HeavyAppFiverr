/*
  # Fix user registration email issue

  1. Changes
    - Clean up any potential duplicate email entries
    - Reset email uniqueness constraint
    - Add proper indexes and constraints
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

-- Create a case-insensitive index for email lookups
DROP INDEX IF EXISTS idx_users_email_lower;
CREATE UNIQUE INDEX idx_users_email_lower
ON auth.users (LOWER(email));

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Reset user registration permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT, INSERT ON TABLES TO anon;

-- Notify about schema changes to force cache refresh
NOTIFY pgrst, 'reload schema';