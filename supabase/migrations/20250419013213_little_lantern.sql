/*
  # Add remove_friend function
  
  1. Changes
    - Create function to remove friendship in both directions
    - Ensure proper error handling
    - Return success status
*/

-- Create function to remove a friend
CREATE OR REPLACE FUNCTION remove_friend(
  p_other_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_count integer;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Check if they are friends
  SELECT COUNT(*) INTO v_count
  FROM friends
  WHERE 
    (user_id = v_user_id AND friend_id = p_other_user_id) OR
    (user_id = p_other_user_id AND friend_id = v_user_id);
    
  IF v_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not friends'
    );
  END IF;

  -- Delete friendship in both directions
  DELETE FROM friends
  WHERE 
    (user_id = v_user_id AND friend_id = p_other_user_id) OR
    (user_id = p_other_user_id AND friend_id = v_user_id);
  
  RETURN json_build_object(
    'success', true,
    'message', 'Friendship removed successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION remove_friend(uuid) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';