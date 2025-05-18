/*
  # Add social media links to training profiles

  1. Changes
    - Add tiktok_url and instagram_url columns to training_profiles
    - Make columns nullable since not all users will have social media
*/

-- Add social media columns to training_profiles
ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS tiktok_url text,
ADD COLUMN IF NOT EXISTS instagram_url text;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';