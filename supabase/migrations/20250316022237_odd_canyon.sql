/*
  # Delete workout history for specific user

  1. Changes
    - Remove all workout logs for user
    - Remove all progress tracking data
    - Remove all weight tracking data
    - Maintain referential integrity

  2. Data Safety
    - Only affects specified user
    - Uses cascading deletes where appropriate
*/

-- Delete all workout logs for the user (this will cascade to exercise_logs and set_logs)
DELETE FROM workout_logs
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';

-- Delete all progress tracking logs for the user
DELETE FROM progress_tracking_logs
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';

-- Delete all weight tracking data for the user
DELETE FROM weight_tracking
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';

-- Delete any custom exercises for the user
DELETE FROM custom_exercises
WHERE user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6';