/*
  # Fix user registration by simplifying auth setup
  
  1. Changes
    - Remove complex triggers and functions
    - Keep basic email uniqueness
    - Restore basic permissions
*/

-- Drop existing complex setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Remove any existing constraints that might conflict
ALTER TABLE auth.users 
DROP CONSTRAINT IF EXISTS users_email_key;

-- Add back simple email uniqueness
ALTER TABLE auth.users
ADD CONSTRAINT users_email_key UNIQUE (email);

-- Ensure basic permissions are correct
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Reset to basic registration permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT, INSERT ON TABLES TO anon;

-- Force cache refresh
NOTIFY pgrst, 'reload schema';