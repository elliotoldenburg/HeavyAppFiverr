-- Drop the existing function
DROP FUNCTION IF EXISTS get_pending_friend_requests;

-- Create an improved version that fixes the GROUP BY error
CREATE OR REPLACE FUNCTION get_pending_friend_requests()
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Return pending requests with sender profiles
  RETURN QUERY
  SELECT 
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
  FROM friend_requests fr
  JOIN training_profiles tp ON tp.user_id = fr.sender_id
  WHERE 
    fr.receiver_id = v_user_id AND
    fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pending_friend_requests TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';