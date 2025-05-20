/*
  # Add username field to training_profiles
  
  1. Changes
    - Add username column to training_profiles table
    - Create unique index for username search
    - Add username to onboarding form
    - Update search functionality
*/

-- Add username column to training_profiles
ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS username text;

-- Create unique index for username search
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_profiles_username_lower
ON training_profiles(LOWER(username))
WHERE username IS NOT NULL;

-- Add check constraint to ensure username format
ALTER TABLE training_profiles
ADD CONSTRAINT username_format CHECK (
  username IS NULL OR 
  username ~ '^[a-zA-Z0-9_\.]{3,30}$'
);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';