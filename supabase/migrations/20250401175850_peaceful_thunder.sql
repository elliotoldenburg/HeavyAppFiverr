/*
  # Improve user search functionality
  
  1. Changes
    - Add function to search users by name or username
    - Make search case-insensitive
    - Improve search patterns for partial matches
    - Add proper indexes for search performance
*/

-- Create a function to search for users
CREATE OR REPLACE FUNCTION search_users(
  search_query text,
  search_type text DEFAULT 'username',
  current_user_id uuid DEFAULT NULL
)
RETURNS SETOF training_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF search_type = 'username' THEN
    -- Search by username (case insensitive)
    RETURN QUERY
    SELECT *
    FROM training_profiles
    WHERE 
      (username IS NOT NULL AND LOWER(username) LIKE LOWER(search_query || '%'))
      AND (current_user_id IS NULL OR user_id != current_user_id)
    ORDER BY username
    LIMIT 10;
  ELSE
    -- Search by full name (case insensitive)
    RETURN QUERY
    SELECT *
    FROM training_profiles
    WHERE 
      LOWER(full_name) LIKE LOWER('%' || search_query || '%')
      AND (current_user_id IS NULL OR user_id != current_user_id)
    ORDER BY full_name
    LIMIT 10;
  END IF;
END;
$$;

-- Create or improve indexes for search performance
DROP INDEX IF EXISTS idx_training_profiles_username_lower;
CREATE INDEX idx_training_profiles_username_lower 
ON training_profiles(LOWER(username)) 
WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_profiles_fullname_lower
ON training_profiles(LOWER(full_name));

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';