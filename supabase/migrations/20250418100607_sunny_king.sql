/*
  # Add function to get friend's progress data
  
  1. Changes
    - Create function to fetch friend's exercise progress
    - Add RLS policy to allow viewing friends' progress
    - Ensure proper data access control
*/

-- First drop the existing function if it exists
DROP FUNCTION IF EXISTS get_friend_progress(uuid, uuid, date);

-- Create function to get friend's progress data
CREATE OR REPLACE FUNCTION get_friend_progress(
  p_friend_id uuid,
  p_exercise_id uuid,
  p_start_date date DEFAULT NULL
)
RETURNS TABLE (
  workout_date date,
  weight numeric,
  reps integer,
  volume numeric,
  estimated_1rm numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_are_friends boolean;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Check if they are friends
  SELECT EXISTS (
    SELECT 1 FROM friends
    WHERE 
      (
        (user_id = v_user_id AND friend_id = p_friend_id) OR
        (user_id = p_friend_id AND friend_id = v_user_id)
      )
  ) INTO v_are_friends;
  
  IF NOT v_are_friends THEN
    RETURN;
  END IF;
  
  -- Get progress data
  RETURN QUERY
  SELECT 
    ptl.workout_date,
    ptl.weight,
    ptl.reps,
    ptl.weight * ptl.reps as volume,
    CASE 
      WHEN ptl.reps <= 10 THEN -- Only calculate for sets with 10 or fewer reps
        ptl.weight * (1 + (ptl.reps::decimal / 30.0))
      ELSE NULL 
    END as estimated_1rm
  FROM progress_tracking_logs ptl
  WHERE 
    ptl.user_id = p_friend_id AND
    ptl.exercise_id = p_exercise_id AND
    (p_start_date IS NULL OR ptl.workout_date >= p_start_date)
  ORDER BY ptl.workout_date;
END;
$$;

-- Create policy to allow viewing friends' progress
DROP POLICY IF EXISTS "Users can read friends' progress logs" ON progress_tracking_logs;

CREATE POLICY "Users can read friends' progress logs"
  ON progress_tracking_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM friends
      WHERE (
        (friends.user_id = auth.uid() AND friends.friend_id = progress_tracking_logs.user_id) OR
        (friends.friend_id = auth.uid() AND friends.user_id = progress_tracking_logs.user_id)
      )
    )
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_friend_progress TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';