/*
  # Update friend request functions to include notification data
  
  1. Changes
    - Update respond_to_friend_request to include sender and receiver names
    - Update send_friend_request to include sender name
    - Ensure proper data for real-time notifications
*/

-- Update respond_to_friend_request function to include names
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
      (v_receiver_id, v_sender_id);
      
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

-- Update send_friend_request function to include sender name
CREATE OR REPLACE FUNCTION send_friend_request(p_receiver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id uuid;
  v_sender_name text;
  v_receiver_name text;
BEGIN
  -- Get the authenticated user's ID
  v_sender_id := auth.uid();
  
  -- Get names for notification purposes
  SELECT full_name INTO v_sender_name
  FROM training_profiles
  WHERE user_id = v_sender_id;
  
  SELECT full_name INTO v_receiver_name
  FROM training_profiles
  WHERE user_id = p_receiver_id;
  
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
    'message', 'Friend request sent successfully',
    'sender_id', v_sender_id,
    'receiver_id', p_receiver_id,
    'sender_name', v_sender_name,
    'receiver_name', v_receiver_name
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION respond_to_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION send_friend_request(uuid) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';