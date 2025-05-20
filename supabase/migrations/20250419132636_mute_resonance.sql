/*
  # Fix friend request functionality
  
  1. Changes
    - Update friend_requests table to ensure proper status handling
    - Fix respond_to_friend_request function to properly create friendships
    - Ensure proper error handling and transaction safety
*/

-- First, ensure the friend_requests table has the correct status constraint
ALTER TABLE friend_requests
DROP CONSTRAINT IF EXISTS friend_requests_status_check;

ALTER TABLE friend_requests
ADD CONSTRAINT friend_requests_status_check
CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Create or replace the respond_to_friend_request function
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
  v_sender_name text;
  v_receiver_name text;
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

  -- Get names for notification purposes
  SELECT full_name INTO v_sender_name
  FROM training_profiles
  WHERE user_id = v_sender_id;
  
  SELECT full_name INTO v_receiver_name
  FROM training_profiles
  WHERE user_id = v_receiver_id;

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
      (v_receiver_id, v_sender_id)
    ON CONFLICT DO NOTHING;
      
    RETURN json_build_object(
      'success', true,
      'message', 'Friend request accepted',
      'sender_id', v_sender_id,
      'receiver_id', v_receiver_id,
      'sender_name', v_sender_name,
      'receiver_name', v_receiver_name
    );
  ELSE
    -- Reject the request
    UPDATE friend_requests 
    SET status = 'rejected',
        updated_at = now()
    WHERE id = p_request_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Friend request rejected',
      'sender_id', v_sender_id,
      'receiver_id', v_receiver_id,
      'sender_name', v_sender_name,
      'receiver_name', v_receiver_name
    );
  END IF;
END;
$$;

-- Create or replace the check_friendship_status function
CREATE OR REPLACE FUNCTION check_friendship_status(
  auth_user_id uuid,
  other_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  -- Check if they are friends (either direction)
  IF EXISTS (
    SELECT 1 FROM friends
    WHERE 
      (user_id = auth_user_id AND friend_id = other_user_id) OR
      (user_id = other_user_id AND friend_id = auth_user_id)
  ) THEN
    v_status := 'friend';
  
  -- Check if auth_user has sent a request to other_user
  ELSIF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE 
      sender_id = auth_user_id AND 
      receiver_id = other_user_id AND
      status = 'pending'
  ) THEN
    v_status := 'requested';
  
  -- Check if other_user has sent a request to auth_user
  ELSIF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE 
      sender_id = other_user_id AND 
      receiver_id = auth_user_id AND
      status = 'pending'
  ) THEN
    v_status := 'incoming';
  
  -- No relationship
  ELSE
    v_status := 'none';
  END IF;
  
  RETURN v_status;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION respond_to_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION check_friendship_status(uuid, uuid) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';