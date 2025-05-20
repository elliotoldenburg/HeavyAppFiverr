/*
  # Add friend system functionality
  
  1. New Tables
    - `friends` for managing friend relationships
    - `friend_requests` for handling pending requests
    
  2. Security
    - Enable RLS
    - Add policies for friend management
    - Ensure proper data access control
*/

-- Create friends table
CREATE TABLE friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure no duplicate relationships
  UNIQUE(user_id, friend_id)
);

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own friend relationships"
  ON friends
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    (auth.uid() = friend_id AND status = 'accepted')
  );

CREATE POLICY "Users can send friend requests"
  ON friends
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'pending' AND
    user_id != friend_id
  );

CREATE POLICY "Users can update their own friend relationships"
  ON friends
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (user_id, friend_id)
  )
  WITH CHECK (
    auth.uid() IN (user_id, friend_id)
  );

-- Create indexes for better performance
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);

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

-- Create function to get friend list with profiles
CREATE OR REPLACE FUNCTION get_friends_with_profiles(
  include_pending boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get friends with their profiles
  SELECT json_agg(friend_data)
  INTO v_result
  FROM (
    SELECT 
      f.id as friendship_id,
      f.status,
      f.created_at,
      json_build_object(
        'id', tp.user_id,
        'full_name', tp.full_name,
        'profile_image_url', tp.profile_image_url,
        'banner_image_url', tp.banner_image_url,
        'training_goal', tp.training_goal,
        'instagram_url', tp.instagram_url,
        'tiktok_url', tp.tiktok_url
      ) as profile
    FROM friends f
    JOIN training_profiles tp ON (
      CASE 
        WHEN f.user_id = v_user_id THEN f.friend_id = tp.user_id
        ELSE f.user_id = tp.user_id
      END
    )
    WHERE 
      (f.user_id = v_user_id OR f.friend_id = v_user_id) AND
      (include_pending OR f.status = 'accepted')
    ORDER BY tp.full_name
  ) friend_data;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- Create function to get friend's progress data
CREATE OR REPLACE FUNCTION get_friend_progress(
  p_friend_id uuid,
  p_exercise_id uuid,
  p_start_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_are_friends boolean;
  v_result json;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Check if they are friends
  SELECT EXISTS (
    SELECT 1 FROM friends
    WHERE 
      status = 'accepted' AND
      (
        (user_id = v_user_id AND friend_id = p_friend_id) OR
        (user_id = p_friend_id AND friend_id = v_user_id)
      )
  ) INTO v_are_friends;
  
  IF NOT v_are_friends THEN
    RETURN NULL;
  END IF;
  
  -- Get progress data
  SELECT json_agg(progress_data ORDER BY workout_date)
  INTO v_result
  FROM (
    SELECT 
      workout_date,
      weight,
      reps,
      weight * reps as volume,
      CASE 
        WHEN reps <= 10 THEN -- Only calculate for sets with 10 or fewer reps
          weight * (1 + (reps::decimal / 30.0))
        ELSE NULL 
      END as estimated_1rm
    FROM progress_tracking_logs
    WHERE 
      user_id = p_friend_id AND
      exercise_id = p_exercise_id AND
      (p_start_date IS NULL OR workout_date >= p_start_date)
  ) progress_data;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_with_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_progress TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';