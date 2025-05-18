-- Create function to search users with friendship status
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
  SELECT json_agg(
    json_build_object(
      'user_id', tp.user_id,
      'full_name', tp.full_name,
      'username', tp.username,
      'profile_image_url', tp.profile_image_url,
      'is_friend', true
    )
  )
  INTO v_friends
  FROM training_profiles tp
  JOIN friends f ON f.friend_id = tp.user_id
  WHERE 
    f.user_id = v_user_id AND
    f.status = 'accepted' AND
    (
      lower(tp.username) LIKE '%' || lower(search_text) || '%' OR
      lower(tp.full_name) LIKE '%' || lower(search_text) || '%'
    )
  ORDER BY 
    CASE 
      WHEN lower(tp.username) = lower(search_text) THEN 0
      WHEN lower(tp.username) LIKE lower(search_text) || '%' THEN 1
      WHEN lower(tp.full_name) = lower(search_text) THEN 2
      WHEN lower(tp.full_name) LIKE lower(search_text) || '%' THEN 3
      ELSE 4
    END,
    tp.full_name
  LIMIT 10;
  
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
  )
  SELECT json_agg(
    json_build_object(
      'user_id', tp.user_id,
      'full_name', tp.full_name,
      'username', tp.username,
      'profile_image_url', tp.profile_image_url,
      'is_friend', false,
      'request_status', rs.status,
      'request_direction', rs.direction
    )
  )
  INTO v_non_friends
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
  ORDER BY 
    CASE 
      WHEN lower(tp.username) = lower(search_text) THEN 0
      WHEN lower(tp.username) LIKE lower(search_text) || '%' THEN 1
      WHEN lower(tp.full_name) = lower(search_text) THEN 2
      WHEN lower(tp.full_name) LIKE lower(search_text) || '%' THEN 3
      ELSE 4
    END,
    tp.full_name
  LIMIT 20;
  
  -- Combine results
  v_result := json_build_object(
    'friends', COALESCE(v_friends, '[]'::json),
    'non_friends', COALESCE(v_non_friends, '[]'::json)
  );
  
  RETURN v_result;
END;
$$;

-- Create function to respond to friend requests
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
  v_request friend_requests;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get the request
  SELECT * INTO v_request
  FROM friend_requests
  WHERE 
    id = p_request_id AND
    receiver_id = v_user_id AND
    status = 'pending';
    
  IF v_request IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request not found or not pending'
    );
  END IF;
  
  -- Update request status
  UPDATE friend_requests
  SET 
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    updated_at = now()
  WHERE id = p_request_id
  RETURNING to_json(*) INTO v_result;
  
  -- If accepted, create friendship
  IF p_accept THEN
    -- Create friendship in both directions
    INSERT INTO friends (user_id, friend_id, status)
    VALUES 
      (v_request.sender_id, v_request.receiver_id, 'accepted'),
      (v_request.receiver_id, v_request.sender_id, 'accepted');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', CASE WHEN p_accept THEN 'Friend request accepted' ELSE 'Friend request rejected' END,
    'request', v_result
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users_with_status TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_friend_request TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';