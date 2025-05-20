/*
  # Remove experience_level from training_profiles
  
  1. Changes
    - Make experience_level column nullable in training_profiles
    - This allows us to keep existing data but not require it for new profiles
*/

-- Make experience_level column nullable
ALTER TABLE training_profiles
ALTER COLUMN experience_level DROP NOT NULL;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';