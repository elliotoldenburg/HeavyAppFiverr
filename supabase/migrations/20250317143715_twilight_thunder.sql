/*
  # Remove unused progress_tracking table

  1. Changes
    - Drop progress_tracking table as it's no longer used
    - All progress tracking is now handled by progress_tracking_logs
*/

-- Drop the unused progress_tracking table
DROP TABLE IF EXISTS progress_tracking;