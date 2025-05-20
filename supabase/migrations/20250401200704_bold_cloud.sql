/*
  # Create search_training_profiles function
  
  1. Changes
    - Add function to search users by name or username
    - Make search case-insensitive
    - Improve search patterns for partial matches
    - Add proper indexes for search performance
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_training_profiles;

-- Create a function to search for users by name or username
CREATE OR REPLACE FUNCTION search_training_profiles(
  search_text text
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  full_name text,
  profile_image_url text
)
LANGUAGE sql
AS $$
  SELECT 
    id,
    user_id,
    username,
    full_name,
    profile_image_url
  FROM training_profiles
  WHERE 
    (lower(username) LIKE '%' || lower(search_text) || '%' OR 
     lower(full_name) LIKE '%' || lower(search_text) || '%')
    AND username IS NOT NULL
  ORDER BY 
    CASE 
      WHEN lower(username) = lower(search_text) THEN 0
      WHEN lower(username) LIKE lower(search_text) || '%' THEN 1
      WHEN lower(full_name) = lower(search_text) THEN 2
      WHEN lower(full_name) LIKE lower(search_text) || '%' THEN 3
      ELSE 4
    END,
    full_name
  LIMIT 20;
$$;

-- Ensure proper indexes exist for search performance
DROP INDEX IF EXISTS idx_training_profiles_username_lower;
CREATE INDEX idx_training_profiles_username_lower 
ON training_profiles(lower(username)) 
WHERE username IS NOT NULL;

DROP INDEX IF EXISTS idx_training_profiles_full_name_lower;
CREATE INDEX idx_training_profiles_full_name_lower
ON training_profiles(lower(full_name));

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_training_profiles TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';