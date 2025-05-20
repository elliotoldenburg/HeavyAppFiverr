/*
  # Make specific users friends
  
  1. Changes
    - Add a friendship record between two specific users
    - Set status to 'accepted' to make them immediate friends
    - Use ON CONFLICT to handle case where they might already be friends
*/

-- Insert friendship record with accepted status
INSERT INTO friends (
  user_id,
  friend_id,
  status,
  created_at,
  updated_at
)
VALUES (
  '3822e586-3674-457e-9611-6b5143897ff1',
  'e5acf328-fe80-465d-8e37-e7caaabeb8da',
  'accepted',
  now(),
  now()
)
ON CONFLICT (user_id, friend_id) 
DO UPDATE SET
  status = 'accepted',
  updated_at = now();

-- Also insert the reverse relationship to ensure bidirectional friendship
-- This is needed only if your app requires explicit records in both directions
INSERT INTO friends (
  user_id,
  friend_id,
  status,
  created_at,
  updated_at
)
VALUES (
  'e5acf328-fe80-465d-8e37-e7caaabeb8da',
  '3822e586-3674-457e-9611-6b5143897ff1',
  'accepted',
  now(),
  now()
)
ON CONFLICT (user_id, friend_id) 
DO UPDATE SET
  status = 'accepted',
  updated_at = now();