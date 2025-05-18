/*
  # Fix GROUP BY error in search_users_with_status function
  
  1. Changes
    - Fix the SQL error in search_users_with_status function
    - Ensure all selected columns are included in GROUP BY clause
    - Maintain the same functionality
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS search_users_with_status;

-- Create an improved version that fixes the GROUP BY error
CREATE OR REPLACE FUNCTION search_users_with_status(
  search_text text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_friends json;
  v_non_friends json;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get friends that match search
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
  )
  SELECT json_agg(
    json_build_object(
      'user_id', fm.user_id,
      'full_name', fm.full_name,
      'username', fm.username,
      'profile_image_url', fm.profile_image_url,
      'is_friend', true
    )
  )
  INTO v_friends
  FROM friend_matches fm;
  
  -- Get non-friends that match search
  WITH friend_ids AS (
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
  SELECT json_agg(
    json_build_object(
      'user_id', nfm.user_id,
      'full_name', nfm.full_name,
      'username', nfm.username,
      'profile_image_url', nfm.profile_image_url,
      'is_friend', false,
      'request_status', nfm.status,
      'request_direction', nfm.direction
    )
  )
  INTO v_non_friends
  FROM non_friend_matches nfm;
  
  -- Combine results
  v_result := json_build_object(
    'friends', COALESCE(v_friends, '[]'::json),
    'non_friends', COALESCE(v_non_friends, '[]'::json)
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users_with_status TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';