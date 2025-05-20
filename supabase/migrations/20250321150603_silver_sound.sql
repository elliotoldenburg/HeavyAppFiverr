/*
  # Reset auth system to stable state
  
  1. Changes
    - Drop all custom triggers and functions
    - Reset email constraints
    - Clean up permissions
    - Remove complex indexes
*/

-- First drop all custom triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS delete_storage_objects CASCADE;

-- Drop all existing constraints and indexes
ALTER TABLE auth.users 
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

DROP INDEX IF EXISTS auth.idx_users_email_lower;
DROP INDEX IF EXISTS idx_users_email;

-- Clean up any existing duplicate emails
DELETE FROM auth.users a
WHERE a.id IN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY email
      ORDER BY created_at DESC
    ) as rnum
    FROM auth.users
  ) t
  WHERE t.rnum > 1
);

-- Add back basic email uniqueness
ALTER TABLE auth.users
ADD CONSTRAINT users_email_key UNIQUE (email);

-- Reset permissions to defaults
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Grant basic registration permissions
GRANT INSERT ON auth.users TO anon;
GRANT SELECT, INSERT ON auth.identities TO anon;

-- Force cache refresh
NOTIFY pgrst, 'reload schema';