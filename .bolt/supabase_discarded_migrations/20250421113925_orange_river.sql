/*
  # Remove notes from training cycles
  
  1. Changes
    - Make notes column nullable in training_cycles
    - Update existing cycles to set notes to NULL
    - This allows us to keep the column for backward compatibility
*/

-- Make notes column nullable
ALTER TABLE training_cycles
ALTER COLUMN notes DROP NOT NULL;

-- Update existing cycles to remove notes
UPDATE training_cycles
SET notes = NULL;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';