-- Drop existing functions to start fresh
DROP FUNCTION IF EXISTS search_users_with_status(text);
DROP FUNCTION IF EXISTS search_training_profiles(text);
DROP FUNCTION IF EXISTS get_pending_friend_requests();

-- Create a comprehensive search function that properly handles GROUP BY
CREATE OR REPLACE FUNCTION search_training_profiles(
  search_text text
)
RETURNS SETOF training_profiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
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

-- Create a function to search users with friendship status with explicit parameter types
CREATE OR REPLACE FUNCTION search_users_with_status(
  search_text text
)
RETURNS TABLE (
  friends json,
  non_friends json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  RETURN QUERY
  WITH friend_matches AS (
    SELECT 
      tp.user_id,
      tp.full_name,
      tp.username,
      tp.profile_image_url,
      CASE 
        WHEN lower(tp.username) = lower(search_text) THEN 0
        WHEN lower(tp.username) LIKE lower(search_text) || '%' THEN 1
        WHEN lower(tp.full_name) = lower(search_text) THEN 2
        WHEN lower(tp.full_name) LIKE lower(search_text) || '%' THEN 3
        ELSE 4
      END as sort_order
    FROM training_profiles tp
    JOIN friends f ON f.friend_id = tp.user_id
    WHERE 
      f.user_id = v_user_id AND
      f.status = 'accepted' AND
      (
        lower(tp.username) LIKE '%' || lower(search_text) || '%' OR
        lower(tp.full_name) LIKE '%' || lower(search_text) || '%'
      )
    ORDER BY sort_order, tp.full_name
    LIMIT 10
  ),
  friend_ids AS (
    SELECT friend_id FROM friends WHERE user_id = v_user_id AND status = 'accepted'
    UNION
    SELECT user_id FROM friends WHERE friend_id = v_user_id AND status = 'accepted'
  ),
  request_status AS (
    SELECT 
      CASE
        WHEN sender_id = v_user_id THEN receiver_id
        ELSE sender_id
      END as other_user_id,
      status,
      CASE
        WHEN sender_id = v_user_id THEN 'sent'
        ELSE 'received'
      END as direction
    FROM friend_requests
    WHERE sender_id = v_user_id OR receiver_id = v_user_id
  ),
  non_friend_matches AS (
    SELECT 
      tp.user_id,
      tp.full_name,
      tp.username,
      tp.profile_image_url,
      rs.status,
      rs.direction,
      CASE 
        WHEN lower(tp.username) = lower(search_text) THEN 0
        WHEN lower(tp.username) LIKE lower(search_text) || '%' THEN 1
        WHEN lower(tp.full_name) = lower(search_text) THEN 2
        WHEN lower(tp.full_name) LIKE lower(search_text) || '%' THEN 3
        ELSE 4
      END as sort_order
    FROM training_profiles tp
    LEFT JOIN friend_ids fi ON tp.user_id = fi.friend_id
    LEFT JOIN request_status rs ON tp.user_id = rs.other_user_id
    WHERE 
      tp.user_id != v_user_id AND
      fi.friend_id IS NULL AND
      tp.username IS NOT NULL AND
      (
        lower(tp.username) LIKE '%' || lower(search_text) || '%' OR
        lower(tp.full_name) LIKE '%' || lower(search_text) || '%'
      )
    ORDER BY sort_order, tp.full_name
    LIMIT 20
  )
  SELECT 
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'user_id', fm.user_id,
          'full_name', fm.full_name,
          'username', fm.username,
          'profile_image_url', fm.profile_image_url,
          'is_friend', true
        )
      ) FROM friend_matches fm),
      '[]'::json
    ) as friends,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'user_id', nfm.user_id,
          'full_name', nfm.full_name,
          'username', nfm.username,
          'profile_image_url', nfm.profile_image_url,
          'is_friend', false,
          'request_status', nfm.status,
          'request_direction', nfm.direction
        )
      ) FROM non_friend_matches nfm),
      '[]'::json
    ) as non_friends;
END;
$$;

-- Create the get_pending_friend_requests function
CREATE OR REPLACE FUNCTION get_pending_friend_requests()
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Return pending requests with sender profiles
  RETURN QUERY
  SELECT 
    json_build_object(
      'id', fr.id,
      'sender_id', fr.sender_id,
      'created_at', fr.created_at,
      'profile', json_build_object(
        'full_name', tp.full_name,
        'username', tp.username,
        'profile_image_url', tp.profile_image_url
      )
    )
  FROM friend_requests fr
  JOIN training_profiles tp ON tp.user_id = fr.sender_id
  WHERE 
    fr.receiver_id = v_user_id AND
    fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

-- Create proper indexes for search performance
DROP INDEX IF EXISTS idx_training_profiles_username_lower;
CREATE INDEX idx_training_profiles_username_lower 
ON training_profiles(lower(username)) 
WHERE username IS NOT NULL;

DROP INDEX IF EXISTS idx_training_profiles_fullname_lower;
CREATE INDEX idx_training_profiles_fullname_lower
ON training_profiles(lower(full_name));

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION search_training_profiles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION search_users_with_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_friend_requests() TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';