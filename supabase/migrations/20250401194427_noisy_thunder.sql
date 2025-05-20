-- Drop any existing search functions to start fresh
DROP FUNCTION IF EXISTS search_users;
DROP FUNCTION IF EXISTS search_users_by_name_or_username;

-- Create new search function with clean implementation
CREATE OR REPLACE FUNCTION search_users(
  search_query text,
  current_user_id uuid
)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  profile_image_url text
)
LANGUAGE sql
AS $$
  SELECT 
    user_id as id,
    username,
    full_name,
    profile_image_url
  FROM training_profiles
  WHERE 
    (lower(username) LIKE '%' || lower(search_query) || '%' OR 
     lower(full_name) LIKE '%' || lower(search_query) || '%')
    AND user_id != current_user_id
    AND username IS NOT NULL
  ORDER BY 
    CASE 
      WHEN lower(username) = lower(search_query) THEN 0
      WHEN lower(username) LIKE lower(search_query) || '%' THEN 1
      WHEN lower(full_name) = lower(search_query) THEN 2
      WHEN lower(full_name) LIKE lower(search_query) || '%' THEN 3
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
GRANT EXECUTE ON FUNCTION search_users TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';