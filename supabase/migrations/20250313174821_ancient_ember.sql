/*
  # Remove storage functionality

  1. Changes
    - Delete all objects in the profile-images bucket first
    - Drop storage bucket and policies
    - Remove storage-related triggers and functions
    - Remove profile_picture column from training_profiles

  2. Data Safety
    - Use IF EXISTS to prevent errors
    - Handle dependencies in correct order
*/

-- First delete all objects in the bucket
DELETE FROM storage.objects 
WHERE bucket_id = 'profile-images';

-- Then drop the bucket
DELETE FROM storage.buckets 
WHERE id = 'profile-images';

-- Drop storage policies (these will be automatically removed with the bucket, but let's be thorough)
DROP POLICY IF EXISTS "Users can view their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;

-- Drop storage cleanup function and trigger
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS delete_storage_objects;

-- Remove profile_picture column from training_profiles
ALTER TABLE training_profiles DROP COLUMN IF EXISTS profile_picture;