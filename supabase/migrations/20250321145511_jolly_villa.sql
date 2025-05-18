/*
  # Add user deletion cleanup

  1. Changes
    - Clean up orphaned data first
    - Add storage cleanup trigger
    - Add CASCADE DELETE to all user-related foreign keys
    - Ensure proper order of operations
*/

-- First clean up any orphaned data
DELETE FROM auth.identities
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

DELETE FROM storage.objects
WHERE bucket_id = 'profile-images'
AND (storage.foldername(name))[1] NOT IN (
  SELECT id::text FROM auth.users
);

-- Create storage cleanup function
CREATE OR REPLACE FUNCTION delete_storage_objects()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all storage objects in the user's folder
  DELETE FROM storage.objects
  WHERE bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for storage cleanup
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_objects();

-- Update foreign key constraints with CASCADE DELETE
DO $$ 
BEGIN
  -- Handle auth.identities first since it's causing the issue
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'identities_user_id_fkey'
  ) THEN
    ALTER TABLE auth.identities
    DROP CONSTRAINT identities_user_id_fkey;
  END IF;

  ALTER TABLE auth.identities
  ADD CONSTRAINT identities_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  -- Then handle all other tables
  ALTER TABLE public.training_profiles
  DROP CONSTRAINT IF EXISTS training_profiles_user_id_fkey,
  ADD CONSTRAINT training_profiles_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  ALTER TABLE public.anvandare_program
  DROP CONSTRAINT IF EXISTS anvandare_program_user_id_fkey,
  ADD CONSTRAINT anvandare_program_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  ALTER TABLE public.custom_exercises
  DROP CONSTRAINT IF EXISTS custom_exercises_user_id_fkey,
  ADD CONSTRAINT custom_exercises_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  ALTER TABLE public.workout_logs
  DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey,
  ADD CONSTRAINT workout_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  ALTER TABLE public.weight_tracking
  DROP CONSTRAINT IF EXISTS weight_tracking_user_id_fkey,
  ADD CONSTRAINT weight_tracking_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  ALTER TABLE public.progress_tracking_logs
  DROP CONSTRAINT IF EXISTS progress_tracking_logs_user_id_fkey,
  ADD CONSTRAINT progress_tracking_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
END $$;