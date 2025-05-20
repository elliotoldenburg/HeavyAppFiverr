/*
  # Update training cycles table and policies

  1. Changes
    - Add missing policies and constraints if needed
    - Update trigger function
    - Add indexes for performance
*/

-- First check if table exists and create if not
DO $$ 
BEGIN
  -- Add any missing columns
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' 
    AND tablename = 'training_cycles'
  ) THEN
    -- Table exists, ensure all columns are present
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'training_cycles' 
      AND column_name = 'notes'
    ) THEN
      ALTER TABLE training_cycles ADD COLUMN notes text;
    END IF;

    -- Add any missing constraints
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'valid_dates'
    ) THEN
      ALTER TABLE training_cycles
      ADD CONSTRAINT valid_dates 
      CHECK (end_date IS NULL OR end_date >= start_date);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'unique_active_cycle'
    ) THEN
      ALTER TABLE training_cycles
      ADD CONSTRAINT unique_active_cycle 
      UNIQUE (user_id, active) 
      DEFERRABLE INITIALLY DEFERRED;
    END IF;

  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE training_cycles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own training cycles" ON training_cycles;
DROP POLICY IF EXISTS "Users can insert own training cycles" ON training_cycles;
DROP POLICY IF EXISTS "Users can update own training cycles" ON training_cycles;

-- Recreate policies
CREATE POLICY "Users can read own training cycles"
  ON training_cycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training cycles"
  ON training_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training cycles"
  ON training_cycles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update or create the cycle activation function
CREATE OR REPLACE FUNCTION handle_cycle_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- If new cycle is being activated, deactivate all other cycles for the user
  IF NEW.active = true THEN
    UPDATE training_cycles
    SET active = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_cycle_activation ON training_cycles;

-- Create trigger for cycle activation
CREATE TRIGGER on_cycle_activation
  BEFORE INSERT OR UPDATE ON training_cycles
  FOR EACH ROW
  EXECUTE FUNCTION handle_cycle_activation();

-- Create or replace index for faster queries
DROP INDEX IF EXISTS idx_training_cycles_user_active;
CREATE INDEX idx_training_cycles_user_active 
ON training_cycles(user_id, active);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';