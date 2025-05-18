-- First, clean up any duplicate active cycles
WITH active_cycles AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM training_cycles
  WHERE active = true
)
UPDATE training_cycles
SET active = false
WHERE id IN (
  SELECT id FROM active_cycles WHERE rn > 1
);

-- Now add unique constraint to ensure only one active cycle per user
ALTER TABLE training_cycles
DROP CONSTRAINT IF EXISTS unique_active_cycle_per_user;

-- Create a partial index that enforces uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_cycle_per_user
ON training_cycles (user_id)
WHERE active = true;

-- Create index for faster queries on active training cycles
CREATE INDEX IF NOT EXISTS idx_training_cycles_active
ON training_cycles(user_id, active)
WHERE active = true;

-- Function to get friends with their profiles
CREATE OR REPLACE FUNCTION get_friends_with_profiles(include_pending boolean DEFAULT false)
RETURNS TABLE (
  friend_id uuid,
  full_name text,
  username text,
  profile_image_url text,
  status text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user_id uuid;
BEGIN
  -- Get authenticated user's ID
  auth_user_id := auth.uid();
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH friend_status AS (
    -- Get confirmed friends
    SELECT 
      CASE 
        WHEN f.user_id = auth_user_id THEN f.friend_id
        ELSE f.user_id
      END AS friend_id,
      'friend' as status,
      f.created_at
    FROM friends f
    WHERE f.user_id = auth_user_id OR f.friend_id = auth_user_id

    UNION ALL

    -- Include pending requests if requested
    SELECT 
      CASE 
        WHEN fr.sender_id = auth_user_id THEN fr.receiver_id
        ELSE fr.sender_id
      END AS friend_id,
      CASE 
        WHEN fr.sender_id = auth_user_id THEN 'requested'
        ELSE 'incoming'
      END as status,
      fr.created_at
    FROM friend_requests fr
    WHERE 
      include_pending = true AND
      fr.status = 'pending' AND
      (fr.sender_id = auth_user_id OR fr.receiver_id = auth_user_id)
  )
  SELECT 
    fs.friend_id,
    tp.full_name,
    tp.username,
    tp.profile_image_url,
    fs.status,
    fs.created_at
  FROM friend_status fs
  JOIN training_profiles tp ON tp.user_id = fs.friend_id
  ORDER BY fs.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_friends_with_profiles(boolean) TO authenticated;

-- Create function to check friendship status
CREATE OR REPLACE FUNCTION check_friendship_status(
  auth_user_id uuid,
  other_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  -- Check if they are friends (either direction)
  IF EXISTS (
    SELECT 1 FROM friends
    WHERE 
      (user_id = auth_user_id AND friend_id = other_user_id) OR
      (user_id = other_user_id AND friend_id = auth_user_id)
  ) THEN
    v_status := 'friend';
  
  -- Check if auth_user has sent a request to other_user
  ELSIF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE 
      sender_id = auth_user_id AND 
      receiver_id = other_user_id AND
      status = 'pending'
  ) THEN
    v_status := 'requested';
  
  -- Check if other_user has sent a request to auth_user
  ELSIF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE 
      sender_id = other_user_id AND 
      receiver_id = auth_user_id AND
      status = 'pending'
  ) THEN
    v_status := 'incoming';
  
  -- No relationship
  ELSE
    v_status := 'none';
  END IF;
  
  RETURN v_status;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_friendship_status(uuid, uuid) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';