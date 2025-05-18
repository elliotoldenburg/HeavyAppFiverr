/*
  # Add cascading delete constraints

  1. Changes
    - Add ON DELETE CASCADE to all foreign key constraints
    - Ensure all user-related data is properly cleaned up
    - Handle storage cleanup for profile images

  2. Security
    - Maintain referential integrity
    - Prevent orphaned data
    - Clean up all user assets
*/

-- First, drop existing foreign key constraints
ALTER TABLE training_profiles
DROP CONSTRAINT IF EXISTS training_profiles_user_id_fkey;

ALTER TABLE anvandare_program
DROP CONSTRAINT IF EXISTS anvandare_program_user_id_fkey;

ALTER TABLE custom_exercises
DROP CONSTRAINT IF EXISTS custom_exercises_user_id_fkey;

ALTER TABLE workout_logs
DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey;

ALTER TABLE weight_tracking
DROP CONSTRAINT IF EXISTS weight_tracking_user_id_fkey;

ALTER TABLE progress_tracking
DROP CONSTRAINT IF EXISTS progress_tracking_user_id_fkey;

-- Recreate constraints with CASCADE
ALTER TABLE training_profiles
ADD CONSTRAINT training_profiles_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE anvandare_program
ADD CONSTRAINT anvandare_program_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE custom_exercises
ADD CONSTRAINT custom_exercises_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE workout_logs
ADD CONSTRAINT workout_logs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE weight_tracking
ADD CONSTRAINT weight_tracking_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE progress_tracking
ADD CONSTRAINT progress_tracking_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Create a function to clean up storage when a user is deleted
CREATE OR REPLACE FUNCTION delete_storage_objects()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all storage objects in the user's profile folder
  DELETE FROM storage.objects
  WHERE bucket_id = 'profile-images'
  AND (storage.foldername(name))[2] = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to run the cleanup function when a user is deleted
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_objects();