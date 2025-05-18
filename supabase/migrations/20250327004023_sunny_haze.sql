-- Add banner_image_url column to training_profiles
ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS banner_image_url text;

-- Create storage bucket for banner images
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public banner image access" ON storage.objects;
DROP POLICY IF EXISTS "Allow user banner image upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow user banner image update" ON storage.objects;
DROP POLICY IF EXISTS "Allow user banner image delete" ON storage.objects;

-- Create storage policies for banner images with unique names
CREATE POLICY "Allow public banner image access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'banner-images');

CREATE POLICY "Allow user banner image upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banner-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow user banner image update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banner-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'banner-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow user banner image delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'banner-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);