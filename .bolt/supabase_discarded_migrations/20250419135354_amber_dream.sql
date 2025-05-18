/*
  # Fix friend request handling
  
  1. Changes
    - Update respond_to_friend_request function to DELETE requests after handling
    - Ensure friend requests are removed from the database after acceptance/rejection
    - Maintain proper data for notifications
*/

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
  v_request_data record;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- Get request details
  SELECT * INTO v_request_data
  FROM friend_requests
  WHERE id = p_request_id AND status = 'pending';
  
  -- Check if request exists
  IF v_request_data IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request not found or not pending'
    );
  END IF;
  
  v_sender_id := v_request_data.sender_id;
  v_receiver_id := v_request_data.receiver_id;
  
  -- Check if user is the receiver
  IF v_receiver_id != v_user_id THEN
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

  -- Delete the request regardless of accept/reject
  DELETE FROM friend_requests
  WHERE id = p_request_id;
  
  IF p_accept THEN
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
    -- Request rejected and already deleted
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION respond_to_friend_request(uuid, boolean) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';