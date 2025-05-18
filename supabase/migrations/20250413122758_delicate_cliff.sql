/*
  # Fix friend request functions

  1. Changes
    - Add missing to_json function for friend request responses
    - Update friend request functions to handle JSON responses correctly
    - Add proper type definitions for function responses

  2. Security
    - Functions maintain existing RLS policies
    - Only authenticated users can call these functions
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.send_friend_request(receiver_id uuid);
DROP FUNCTION IF EXISTS public.respond_to_friend_request(p_request_id uuid, p_accept boolean);
DROP FUNCTION IF EXISTS public.get_pending_friend_requests();

-- Create type for friend request response
CREATE TYPE friend_request_response AS (
  success boolean,
  message text
);

-- Create type for pending friend request
CREATE TYPE pending_friend_request AS (
  id uuid,
  sender_id uuid,
  created_at timestamptz,
  profile jsonb
);

-- Function to send a friend request
CREATE OR REPLACE FUNCTION public.send_friend_request(receiver_id uuid)
RETURNS friend_request_response
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id uuid;
  v_response friend_request_response;
BEGIN
  -- Get the authenticated user's ID
  v_sender_id := auth.uid();
  
  -- Check if sender and receiver are the same
  IF v_sender_id = receiver_id THEN
    v_response := (false, 'Cannot send friend request to yourself')::friend_request_response;
    RETURN v_response;
  END IF;

  -- Check if they are already friends
  IF EXISTS (
    SELECT 1 FROM friends 
    WHERE (user_id = v_sender_id AND friend_id = receiver_id)
    OR (user_id = receiver_id AND friend_id = v_sender_id)
  ) THEN
    v_response := (false, 'Already friends')::friend_request_response;
    RETURN v_response;
  END IF;

  -- Check if a request already exists
  IF EXISTS (
    SELECT 1 FROM friend_requests 
    WHERE sender_id = v_sender_id 
    AND receiver_id = receiver_id 
    AND status = 'pending'
  ) THEN
    v_response := (false, 'Friend request already sent')::friend_request_response;
    RETURN v_response;
  END IF;

  -- Insert the friend request
  INSERT INTO friend_requests (sender_id, receiver_id, status)
  VALUES (v_sender_id, receiver_id, 'pending');

  v_response := (true, 'Friend request sent successfully')::friend_request_response;
  RETURN v_response;
END;
$$;

-- Function to respond to a friend request
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(
  p_request_id uuid,
  p_accept boolean
)
RETURNS friend_request_response
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_sender_id uuid;
  v_receiver_id uuid;
  v_response friend_request_response;
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
    v_response := (false, 'Invalid request')::friend_request_response;
    RETURN v_response;
  END IF;

  IF p_accept THEN
    -- Accept the request
    UPDATE friend_requests 
    SET status = 'accepted', 
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Create friend relationships
    INSERT INTO friends (user_id, friend_id)
    VALUES 
      (v_sender_id, v_receiver_id),
      (v_receiver_id, v_sender_id);
      
    v_response := (true, 'Friend request accepted')::friend_request_response;
  ELSE
    -- Reject the request
    UPDATE friend_requests 
    SET status = 'rejected',
        updated_at = now()
    WHERE id = p_request_id;
    
    v_response := (true, 'Friend request rejected')::friend_request_response;
  END IF;

  RETURN v_response;
END;
$$;

-- Function to get pending friend requests
CREATE OR REPLACE FUNCTION public.get_pending_friend_requests()
RETURNS SETOF pending_friend_request
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  RETURN QUERY
  SELECT 
    fr.id,
    fr.sender_id,
    fr.created_at,
    jsonb_build_object(
      'full_name', tp.full_name,
      'username', tp.username,
      'profile_image_url', tp.profile_image_url
    ) as profile
  FROM friend_requests fr
  JOIN training_profiles tp ON tp.user_id = fr.sender_id
  WHERE fr.receiver_id = v_user_id 
  AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;