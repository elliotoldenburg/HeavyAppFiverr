/*
  # Clear training history for specific user

  1. Changes
    - Remove all workout logs for user
    - Remove all exercise logs associated with user's workouts
    - Remove all progress tracking data for user
    - Remove all weight tracking data for user

  2. Data Safety
    - Only removes data for specified user
    - Maintains referential integrity
    - Uses cascading deletes where appropriate
*/

-- Delete all workout logs for the user (this will cascade to exercise_logs)
DELETE FROM workout_logs
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';

-- Delete all progress tracking data for the user
DELETE FROM progress_tracking
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';

-- Delete all weight tracking data for the user
DELETE FROM weight_tracking
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';