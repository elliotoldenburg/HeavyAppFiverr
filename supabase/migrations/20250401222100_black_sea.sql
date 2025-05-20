/*
  # Fix search_training_profiles function
  
  1. Changes
    - Simplify search function to return correct fields
    - Ensure proper search on both username and full_name
    - Fix result ordering for better matches
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_training_profiles;

-- Create a simplified search function that returns the exact fields needed
CREATE OR REPLACE FUNCTION search_training_profiles(
  search_text text
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  profile_image_url text
)
LANGUAGE sql
AS $$
  SELECT 
    id,
    user_id,
    full_name,
    username,
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_training_profiles TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';