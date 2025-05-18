-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_users;

-- Create an improved search function
CREATE OR REPLACE FUNCTION search_users(
  search_query text,
  search_type text DEFAULT 'username',
  current_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  profile_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure search_query is not null
  IF search_query IS NULL THEN
    search_query := '';
  END IF;

  IF search_type = 'username' THEN
    -- Search by username (case insensitive)
    RETURN QUERY
    SELECT 
      tp.user_id,
      tp.full_name,
      tp.username,
      tp.profile_image_url
    FROM training_profiles tp
    WHERE 
      (
        -- Match username if not null
        (tp.username IS NOT NULL AND LOWER(tp.username) LIKE LOWER(search_query || '%'))
      )
      AND (current_user_id IS NULL OR tp.user_id != current_user_id)
    ORDER BY tp.username
    LIMIT 10;
  ELSE
    -- Search by full name (case insensitive)
    RETURN QUERY
    SELECT 
      tp.user_id,
      tp.full_name,
      tp.username,
      tp.profile_image_url
    FROM training_profiles tp
    WHERE 
      LOWER(tp.full_name) LIKE LOWER('%' || search_query || '%')
      AND (current_user_id IS NULL OR tp.user_id != current_user_id)
    ORDER BY tp.full_name
    LIMIT 10;
  END IF;
END;
$$;

-- Ensure indexes exist for search performance
DROP INDEX IF EXISTS idx_training_profiles_username_lower;
CREATE INDEX idx_training_profiles_username_lower 
ON training_profiles(LOWER(username)) 
WHERE username IS NOT NULL;

DROP INDEX IF EXISTS idx_training_profiles_fullname_lower;
CREATE INDEX idx_training_profiles_fullname_lower
ON training_profiles(LOWER(full_name));

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';