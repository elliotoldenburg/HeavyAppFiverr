/*
  # Fix ambiguous column reference in send_friend_request function
  
  1. Changes
    - Drop the existing function
    - Recreate with explicit column references to avoid ambiguity
    - Fix the receiver_id parameter reference
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS send_friend_request(uuid);

-- Recreate the function with explicit column references
CREATE OR REPLACE FUNCTION send_friend_request(p_receiver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id uuid;
  v_existing_request uuid;
  v_existing_friendship uuid;
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

  -- Check if a friend request already exists
  SELECT fr.id INTO v_existing_request
  FROM friend_requests fr
  WHERE (fr.sender_id = v_sender_id AND fr.receiver_id = p_receiver_id)
     OR (fr.sender_id = p_receiver_id AND fr.receiver_id = v_sender_id);

  IF v_existing_request IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Friend request already exists'
    );
  END IF;

  -- Check if they are already friends
  SELECT f.id INTO v_existing_friendship
  FROM friends f
  WHERE (f.user_id = v_sender_id AND f.friend_id = p_receiver_id)
     OR (f.user_id = p_receiver_id AND f.friend_id = v_sender_id);

  IF v_existing_friendship IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Already friends'
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION send_friend_request(uuid) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';