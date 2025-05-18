/*
  # Fix friends table structure
  
  1. Changes
    - Add status column to friends table if it doesn't exist
    - Update existing functions to handle the status column
    - Ensure proper constraints and defaults
*/

-- First check if status column exists in friends table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'friends' 
    AND column_name = 'status'
  ) THEN
    -- Add status column to friends table
    ALTER TABLE friends
    ADD COLUMN status text NOT NULL DEFAULT 'accepted';
  END IF;
END $$;

-- Update get_friends_with_profiles function to handle status column
CREATE OR REPLACE FUNCTION get_friends_with_profiles(
  include_pending boolean DEFAULT false
)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Return friends with their profiles
  RETURN QUERY
  SELECT 
    json_build_object(
      'friendship_id', f.id,
      'profile', json_build_object(
        'id', tp.user_id,
        'full_name', tp.full_name,
        'profile_image_url', tp.profile_image_url,
        'banner_image_url', tp.banner_image_url,
        'training_goal', tp.training_goal,
        'instagram_url', tp.instagram_url,
        'tiktok_url', tp.tiktok_url,
        'username', tp.username
      )
    )
  FROM friends f
  JOIN training_profiles tp ON (
    CASE 
      WHEN f.user_id = v_user_id THEN f.friend_id = tp.user_id
      ELSE f.user_id = tp.user_id
    END
  )
  WHERE 
    (f.user_id = v_user_id OR f.friend_id = v_user_id)
  ORDER BY tp.full_name;
END;
$$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';