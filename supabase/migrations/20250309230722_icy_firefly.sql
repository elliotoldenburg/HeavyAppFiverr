/*
  # Remove unused profiles table

  1. Changes
    - Remove the profiles table as it's no longer used
    - All user profile data is now stored in training_profiles
*/

DROP TABLE IF EXISTS profiles;