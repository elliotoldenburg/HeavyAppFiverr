/*
  # Fix friend search functionality
  
  1. Changes
    - Update search_users_with_status function to use auth_user_id parameter
    - Fix get_friends_with_profiles function to not rely on status column
    - Ensure proper friend relationship handling
*/

-- Drop existing functions to start fresh
DROP FUNCTION IF EXISTS search_users_with_status(text);
DROP FUNCTION IF EXISTS get_friends_with_profiles(boolean);
DROP FUNCTION IF EXISTS get_pending_friend_requests();

-- Create a function to search users with friendship status with auth_user_id parameter
CREATE OR REPLACE FUNCTION search_users_with_status(
  auth_user_id uuid,
  search_text text
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  profile_image_url text,
  status text
)
LANGUAGE sql
AS $$
  WITH filtered_users AS (
    SELECT
      tp.user_id,
      tp.username,
      tp.full_name,
      tp.profile_image_url
    FROM training_profiles tp
    WHERE 
      tp.user_id != auth_user_id AND
      (
        tp.username ILIKE '%' || search_text || '%' OR
        tp.full_name ILIKE '%' || search_text || '%'
      )
  ),
  relation_status AS (
    SELECT
      u.*,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM friends f
          WHERE f.user_id = auth_user_id AND f.friend_id = u.user_id
        ) THEN 'friend'
        WHEN EXISTS (
          SELECT 1 FROM friend_requests fr
          WHERE fr.sender_id = auth_user_id AND fr.receiver_id = u.user_id
        ) THEN 'requested'
        WHEN EXISTS (
          SELECT 1 FROM friend_requests fr
          WHERE fr.sender_id = u.user_id AND fr.receiver_id = auth_user_id
        ) THEN 'incoming'
        ELSE 'none'
      END AS status
    FROM filtered_users u
  )
  SELECT * FROM relation_status
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

-- Create function to get friend list with profiles
CREATE OR REPLACE FUNCTION get_friends_with_profiles()
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Return friends with their profiles
  RETURN QUERY
  SELECT 
    json_build_object(
      'friendship_id', f.id,
      'profile', json_build_object(
        'id', tp.user_id,
        'full_name', tp.full_name,
        'profile_image_url', tp.profile_image_url,
        'banner_image_url', tp.banner_image_url,
        'training_goal', tp.training_goal,
        'instagram_url', tp.instagram_url,
        'tiktok_url', tp.tiktok_url,
        'username', tp.username
      )
    )
  FROM friends f
  JOIN training_profiles tp ON tp.user_id = f.friend_id
  WHERE f.user_id = v_user_id
  ORDER BY tp.full_name;
END;
$$;

-- Create function to get pending friend requests
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION search_users_with_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_with_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_friend_requests() TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';