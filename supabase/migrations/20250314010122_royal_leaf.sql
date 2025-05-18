/*
  # Update storage policies for profile images

  1. Changes
    - Update storage bucket configuration
    - Add trigger to clean up old images
    - Ensure only one image per user
    - Update RLS policies

  2. Security
    - Maintain user data isolation
    - Prevent unauthorized access
    - Clean up old files automatically
*/

-- First ensure the bucket exists and is configured correctly
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile images" ON storage.objects;

-- Create new policies with proper restrictions
CREATE POLICY "Users can view profile images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload own profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create a function to clean up old images when a new one is uploaded
CREATE OR REPLACE FUNCTION storage.handle_profile_image_upload()
RETURNS trigger AS $$
DECLARE
  user_folder text;
  existing_files text[];
BEGIN
  -- Get the user's folder from the new file path
  user_folder := (storage.foldername(NEW.name))[1];
  
  -- Find existing files in the same user folder
  SELECT array_agg(name) INTO existing_files
  FROM storage.objects
  WHERE 
    bucket_id = NEW.bucket_id AND
    (storage.foldername(name))[1] = user_folder AND
    name != NEW.name;
    
  -- Delete old files if they exist
  IF array_length(existing_files, 1) > 0 THEN
    DELETE FROM storage.objects
    WHERE name = ANY(existing_files);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run the cleanup function
DROP TRIGGER IF EXISTS cleanup_old_profile_images ON storage.objects;
CREATE TRIGGER cleanup_old_profile_images
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'profile-images')
  EXECUTE FUNCTION storage.handle_profile_image_upload();