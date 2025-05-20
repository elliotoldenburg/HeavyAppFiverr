/*
  # Add profile image URL to training profiles

  1. Changes
    - Add profile_image_url column to training_profiles table
    - Create storage bucket for profile images
    - Set up storage policies for authenticated users

  2. Security
    - Enable RLS on storage bucket
    - Add policies for user-specific access
*/

-- Add profile_image_url column to training_profiles
ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
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