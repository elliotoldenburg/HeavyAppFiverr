/*
  # Fix remove_friend function
  
  1. Changes
    - Update remove_friend function to properly handle friend removal
    - Ensure proper error handling and transaction safety
*/

-- Create or replace the remove_friend function
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
  v_friend_name text;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get friend's name for notification purposes
  SELECT full_name INTO v_friend_name
  FROM training_profiles
  WHERE user_id = p_other_user_id;
  
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
    'message', 'Friendship removed successfully',
    'friend_name', v_friend_name
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION remove_friend(uuid) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';