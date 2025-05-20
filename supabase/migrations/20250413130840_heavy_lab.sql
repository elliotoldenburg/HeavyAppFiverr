-- Drop existing functions to start fresh
DROP FUNCTION IF EXISTS search_users_with_status(uuid, text);
DROP FUNCTION IF EXISTS get_friends_with_profiles();
DROP FUNCTION IF EXISTS get_pending_friend_requests();
DROP FUNCTION IF EXISTS send_friend_request(uuid);
DROP FUNCTION IF EXISTS respond_to_friend_request(uuid, boolean);

-- Create a function to search users with friendship status
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
  friend_relationships AS (
    SELECT friend_id FROM friends WHERE user_id = auth_user_id
  ),
  outgoing_requests AS (
    SELECT receiver_id FROM friend_requests 
    WHERE sender_id = auth_user_id AND status = 'pending'
  ),
  incoming_requests AS (
    SELECT sender_id FROM friend_requests 
    WHERE receiver_id = auth_user_id AND status = 'pending'
  )
  SELECT
    u.user_id,
    u.username,
    u.full_name,
    u.profile_image_url,
    CASE
      WHEN fr.friend_id IS NOT NULL THEN 'friend'
      WHEN or_req.receiver_id IS NOT NULL THEN 'requested'
      WHEN ir_req.sender_id IS NOT NULL THEN 'incoming'
      ELSE 'none'
    END AS status
  FROM filtered_users u
  LEFT JOIN friend_relationships fr ON u.user_id = fr.friend_id
  LEFT JOIN outgoing_requests or_req ON u.user_id = or_req.receiver_id
  LEFT JOIN incoming_requests ir_req ON u.user_id = ir_req.sender_id
  ORDER BY 
    CASE 
      WHEN lower(u.username) = lower(search_text) THEN 0
      WHEN lower(u.username) LIKE lower(search_text) || '%' THEN 1
      WHEN lower(u.full_name) = lower(search_text) THEN 2
      WHEN lower(u.full_name) LIKE lower(search_text) || '%' THEN 3
      ELSE 4
    END,
    u.full_name
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

-- Create function to send a friend request
CREATE OR REPLACE FUNCTION send_friend_request(p_receiver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id uuid;
  v_result json;
BEGIN
  -- Get the authenticated user's ID
  v_sender_id := auth.uid();
  
  -- Check if sender is trying to send request to themselves
  IF v_sender_id = p_receiver_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cannot send friend request to yourself'
    );
  END IF;

  -- Check if they are already friends
  IF EXISTS (
    SELECT 1 FROM friends 
    WHERE (user_id = v_sender_id AND friend_id = p_receiver_id)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Already friends'
    );
  END IF;

  -- Check if a request already exists
  IF EXISTS (
    SELECT 1 FROM friend_requests 
    WHERE (sender_id = v_sender_id AND receiver_id = p_receiver_id)
       OR (sender_id = p_receiver_id AND receiver_id = v_sender_id)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Friend request already exists'
    );
  END IF;

  -- Insert the friend request
  INSERT INTO friend_requests (sender_id, receiver_id, status)
  VALUES (v_sender_id, p_receiver_id, 'pending');

  RETURN json_build_object(
    'success', true,
    'message', 'Friend request sent successfully'
  );
END;
$$;

-- Create function to respond to a friend request
CREATE OR REPLACE FUNCTION respond_to_friend_request(
  p_request_id uuid,
  p_accept boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_sender_id uuid;
  v_receiver_id uuid;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- Get request details
  SELECT sender_id, receiver_id 
  INTO v_sender_id, v_receiver_id
  FROM friend_requests
  WHERE id = p_request_id AND status = 'pending';
  
  -- Check if request exists and user is the receiver
  IF v_receiver_id IS NULL OR v_receiver_id != v_user_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid request'
    );
  END IF;

  IF p_accept THEN
    -- Accept the request
    UPDATE friend_requests 
    SET status = 'accepted', 
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Create friend relationships in both directions
    INSERT INTO friends (user_id, friend_id)
    VALUES 
      (v_sender_id, v_receiver_id),
      (v_receiver_id, v_sender_id);
      
    RETURN json_build_object(
      'success', true,
      'message', 'Friend request accepted'
    );
  ELSE
    -- Reject the request
    UPDATE friend_requests 
    SET status = 'rejected',
        updated_at = now()
    WHERE id = p_request_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Friend request rejected'
    );
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION search_users_with_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_with_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_friend_request(uuid, boolean) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';