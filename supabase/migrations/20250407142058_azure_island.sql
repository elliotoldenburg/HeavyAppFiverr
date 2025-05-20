/*
  # Fix friend search functionality
  
  1. Changes
    - Create improved search function for finding users
    - Allow searching by both username and full name
    - Ensure proper filtering of search results
*/

-- Drop existing search function if it exists
DROP FUNCTION IF EXISTS search_training_profiles;

-- Create improved search function that returns all necessary fields
CREATE OR REPLACE FUNCTION search_training_profiles(
  search_text text
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  profile_image_url text
)
LANGUAGE sql
AS $$
  SELECT 
    id,
    user_id,
    full_name,
    username,
    profile_image_url
  FROM training_profiles
  WHERE 
    (lower(username) LIKE '%' || lower(search_text) || '%' OR 
     lower(full_name) LIKE '%' || lower(search_text) || '%')
    AND username IS NOT NULL
  ORDER BY 
    CASE 
      WHEN lower(username) = lower(search_text) THEN 0
      WHEN lower(username) LIKE lower(search_text) || '%' THEN 1
      WHEN lower(full_name) = lower(search_text) THEN 2
      WHEN lower(full_name) LIKE lower(search_text) || '%' THEN 3
      ELSE 4
    END,
    full_name
  LIMIT 20;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_training_profiles TO authenticated;

-- Create function to handle friend requests
CREATE OR REPLACE FUNCTION handle_friend_request(
  p_friend_id uuid,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_existing_request friends;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Check if request already exists
  SELECT * INTO v_existing_request
  FROM friends
  WHERE 
    (user_id = v_user_id AND friend_id = p_friend_id) OR
    (user_id = p_friend_id AND friend_id = v_user_id);
    
  IF v_existing_request IS NULL THEN
    -- Create new friend request
    INSERT INTO friends (user_id, friend_id, status)
    VALUES (v_user_id, p_friend_id, 'pending')
    RETURNING to_json(*) INTO v_result;
  ELSE
    -- Update existing relationship
    UPDATE friends
    SET 
      status = p_status,
      updated_at = now()
    WHERE id = v_existing_request.id
    RETURNING to_json(*) INTO v_result;
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION handle_friend_request TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';