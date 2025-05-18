/*
  # Fix user deletion constraints

  1. Changes
    - Add ON DELETE CASCADE to all foreign keys referencing auth.users
    - Ensure proper cleanup of user data when deleting users
*/

-- First check and update training_profiles foreign key
ALTER TABLE training_profiles
DROP CONSTRAINT IF EXISTS training_profiles_user_id_fkey,
ADD CONSTRAINT training_profiles_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update anvandare_program foreign key
ALTER TABLE anvandare_program
DROP CONSTRAINT IF EXISTS anvandare_program_user_id_fkey,
ADD CONSTRAINT anvandare_program_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update custom_exercises foreign key
ALTER TABLE custom_exercises
DROP CONSTRAINT IF EXISTS custom_exercises_user_id_fkey,
ADD CONSTRAINT custom_exercises_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update workout_logs foreign key
ALTER TABLE workout_logs
DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey,
ADD CONSTRAINT workout_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update weight_tracking foreign key
ALTER TABLE weight_tracking
DROP CONSTRAINT IF EXISTS weight_tracking_user_id_fkey,
ADD CONSTRAINT weight_tracking_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update progress_tracking_logs foreign key
ALTER TABLE progress_tracking_logs
DROP CONSTRAINT IF EXISTS progress_tracking_logs_user_id_fkey,
ADD CONSTRAINT progress_tracking_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;