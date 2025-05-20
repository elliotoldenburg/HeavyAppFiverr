/*
  # Rollback storage changes to original state

  1. Changes
    - Drop all custom functions and triggers
    - Reset bucket to original state
    - Remove all custom policies
    - Restore original storage setup
*/

-- Drop custom functions and triggers
DROP TRIGGER IF EXISTS cleanup_old_profile_images ON storage.objects;
DROP FUNCTION IF EXISTS storage.handle_profile_image_upload() CASCADE;
DROP FUNCTION IF EXISTS get_signed_url CASCADE;

-- Reset bucket to original state
UPDATE storage.buckets 
SET public = true 
WHERE id = 'profile-images';

-- Drop all existing policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile images" ON storage.objects;

-- Create new policies with original names and permissions
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'profiles'
);

CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'profiles'
) WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'profiles'
);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'profiles'
);