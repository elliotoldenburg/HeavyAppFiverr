/*
  # Simplify friend request system
  
  1. Changes
    - Simplify friend_requests table to only have 'pending' status
    - Update respond_to_friend_request function to delete requests on accept/reject
    - Create friends table entries on accept
    - Update check_friendship_status function to use simplified logic
*/

-- First, clean up existing data
-- Delete any non-pending requests
DELETE FROM friend_requests
WHERE status != 'pending';

-- Update the status check constraint to only allow 'pending'
ALTER TABLE friend_requests
DROP CONSTRAINT IF EXISTS friend_requests_status_check;

ALTER TABLE friend_requests
ADD CONSTRAINT friend_requests_status_check
CHECK (status = 'pending');

-- Drop the status column from friends table if it exists
ALTER TABLE friends
DROP COLUMN IF EXISTS status;

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

-- Create or replace the send_friend_request function
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
)
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
    WHERE 
      (user_id = v_sender_id AND friend_id = p_receiver_id) OR
      (user_id = p_receiver_id AND friend_id = v_sender_id)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Already friends'
    );
  END IF;

  -- Check if a request already exists in either direction
  IF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE 
      (sender_id = v_sender_id AND receiver_id = p_receiver_id) OR
      (sender_id = p_receiver_id AND receiver_id = v_sender_id)
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

  -- Delete the request regardless of accept/reject
  DELETE FROM friend_requests
  WHERE id = p_request_id;
  
  -- If accepted, create friendship entries
  IF p_accept THEN
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
    -- Request rejected, already deleted
    RETURN json_build_object(
      'success', true,
      'message', 'Friend request rejected'
    );
  END IF;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_friendship_status(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_friend_request(uuid, boolean) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';