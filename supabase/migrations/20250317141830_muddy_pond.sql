/*
  # Add CASCADE DELETE to exercise relationships

  1. Changes
    - Update foreign key constraints to include ON DELETE CASCADE
    - This allows deleting exercises and automatically removes related logs
    - Maintains referential integrity
*/

-- First drop existing foreign key constraints
ALTER TABLE exercise_logs 
DROP CONSTRAINT IF EXISTS exercise_logs_exercise_id_fkey;

ALTER TABLE pass_ovningar 
DROP CONSTRAINT IF EXISTS pass_ovningar_exercise_id_fkey;

ALTER TABLE progress_tracking_logs 
DROP CONSTRAINT IF EXISTS progress_tracking_logs_exercise_id_fkey;

-- Recreate foreign keys with CASCADE DELETE
ALTER TABLE exercise_logs
ADD CONSTRAINT exercise_logs_exercise_id_fkey
FOREIGN KEY (exercise_id) 
REFERENCES ovningar(id) 
ON DELETE CASCADE;

ALTER TABLE pass_ovningar
ADD CONSTRAINT pass_ovningar_exercise_id_fkey
FOREIGN KEY (exercise_id) 
REFERENCES ovningar(id) 
ON DELETE CASCADE;

ALTER TABLE progress_tracking_logs
ADD CONSTRAINT progress_tracking_logs_exercise_id_fkey
FOREIGN KEY (exercise_id) 
REFERENCES ovningar(id) 
ON DELETE CASCADE;