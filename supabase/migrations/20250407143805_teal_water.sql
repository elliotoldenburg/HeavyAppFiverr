/*
  # Create friend request system
  
  1. New Tables
    - `friend_requests` for handling pending friend requests
    
  2. Changes
    - Update friends table structure
    - Add new functions for friend request handling
    - Improve search functionality
*/

-- Create friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure no duplicate requests
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for friend_requests
CREATE POLICY "Users can view their own friend requests"
  ON friend_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id));

CREATE POLICY "Users can send friend requests"
  ON friend_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    status = 'pending' AND
    sender_id != receiver_id
  );

CREATE POLICY "Users can update their own friend requests"
  ON friend_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id))
  WITH CHECK (auth.uid() IN (sender_id, receiver_id));

CREATE POLICY "Users can delete their own friend requests"
  ON friend_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender 
ON friend_requests(sender_id);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver 
ON friend_requests(receiver_id);

CREATE INDEX IF NOT EXISTS idx_friend_requests_status 
ON friend_requests(status);

-- Create function to send a friend request
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id uuid;
  v_existing_request friend_requests;
  v_existing_friendship friends;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_sender_id := auth.uid();
  
  -- Check if users are already friends
  SELECT * INTO v_existing_friendship
  FROM friends
  WHERE 
    (user_id = v_sender_id AND friend_id = p_receiver_id) OR
    (user_id = p_receiver_id AND friend_id = v_sender_id);
    
  IF v_existing_friendship IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Already friends',
      'status', v_existing_friendship.status
    );
  END IF;
  
  -- Check if request already exists
  SELECT * INTO v_existing_request
  FROM friend_requests
  WHERE 
    (sender_id = v_sender_id AND receiver_id = p_receiver_id) OR
    (sender_id = p_receiver_id AND receiver_id = v_sender_id);
    
  IF v_existing_request IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request already exists',
      'status', v_existing_request.status
    );
  END IF;
  
  -- Create new friend request
  INSERT INTO friend_requests (
    sender_id,
    receiver_id,
    status
  )
  VALUES (
    v_sender_id,
    p_receiver_id,
    'pending'
  )
  RETURNING to_json(*) INTO v_result;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Friend request sent',
    'request', v_result
  );
END;
$$;

-- Create function to handle friend request response
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

-- Create function to get pending friend requests
CREATE OR REPLACE FUNCTION get_pending_friend_requests()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get pending requests with sender profiles
  SELECT json_agg(
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
  )
  INTO v_result
  FROM friend_requests fr
  JOIN training_profiles tp ON tp.user_id = fr.sender_id
  WHERE 
    fr.receiver_id = v_user_id AND
    fr.status = 'pending'
  ORDER BY fr.created_at DESC;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

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
  SELECT json_agg(
    json_build_object(
      'user_id', tp.user_id,
      'full_name', tp.full_name,
      'username', tp.username,
      'profile_image_url', tp.profile_image_url,
      'is_friend', false,
      'request_status', (
        SELECT fr.status
        FROM friend_requests fr
        WHERE 
          (fr.sender_id = v_user_id AND fr.receiver_id = tp.user_id) OR
          (fr.sender_id = tp.user_id AND fr.receiver_id = v_user_id)
        LIMIT 1
      )
    )
  )
  INTO v_non_friends
  FROM training_profiles tp
  LEFT JOIN friends f ON (f.friend_id = tp.user_id AND f.user_id = v_user_id)
  WHERE 
    tp.user_id != v_user_id AND
    f.id IS NULL AND
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION send_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_friend_requests TO authenticated;
GRANT EXECUTE ON FUNCTION search_users_with_status TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';