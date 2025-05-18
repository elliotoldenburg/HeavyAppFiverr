/*
  # Fix send_friend_request function return type

  1. Changes
    - Drop the existing function first to avoid return type error
    - Recreate the function with proper return type
    - Fix ambiguous column references
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS send_friend_request(uuid);

-- Recreate the function with proper return type
CREATE OR REPLACE FUNCTION send_friend_request(receiver_id uuid)
RETURNS friend_request_response
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id uuid;
  v_existing_request uuid;
  v_existing_friendship uuid;
  v_response friend_request_response;
BEGIN
  -- Get the authenticated user's ID
  v_sender_id := auth.uid();
  
  -- Check if sender is trying to send request to themselves
  IF v_sender_id = receiver_id THEN
    v_response := (false, 'Cannot send friend request to yourself')::friend_request_response;
    RETURN v_response;
  END IF;

  -- Check if a friend request already exists
  SELECT fr.id INTO v_existing_request
  FROM friend_requests fr
  WHERE (fr.sender_id = v_sender_id AND fr.receiver_id = receiver_id)
     OR (fr.sender_id = receiver_id AND fr.receiver_id = v_sender_id);

  IF v_existing_request IS NOT NULL THEN
    v_response := (false, 'Friend request already exists')::friend_request_response;
    RETURN v_response;
  END IF;

  -- Check if they are already friends
  SELECT f.id INTO v_existing_friendship
  FROM friends f
  WHERE (f.user_id = v_sender_id AND f.friend_id = receiver_id)
     OR (f.user_id = receiver_id AND f.friend_id = v_sender_id);

  IF v_existing_friendship IS NOT NULL THEN
    v_response := (false, 'Already friends')::friend_request_response;
    RETURN v_response;
  END IF;

  -- Insert the friend request
  INSERT INTO friend_requests (sender_id, receiver_id, status)
  VALUES (v_sender_id, receiver_id, 'pending');

  v_response := (true, 'Friend request sent successfully')::friend_request_response;
  RETURN v_response;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION send_friend_request(uuid) TO authenticated;