/*
  # Add training cycles functionality
  
  1. New Tables
    - `training_cycles` for tracking user training goals and phases
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure only one active cycle per user
*/

-- Create training_cycles table
CREATE TABLE training_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  
  -- Ensure dates are valid
  CONSTRAINT valid_dates CHECK (
    end_date IS NULL OR end_date >= start_date
  ),
  
  -- Ensure only one active cycle per user
  CONSTRAINT unique_active_cycle UNIQUE (user_id, active) 
  DEFERRABLE INITIALLY DEFERRED
);

-- Enable RLS
ALTER TABLE training_cycles ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Create function to handle cycle activation
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

-- Create trigger for cycle activation
CREATE TRIGGER on_cycle_activation
  BEFORE INSERT OR UPDATE ON training_cycles
  FOR EACH ROW
  EXECUTE FUNCTION handle_cycle_activation();

-- Create index for faster queries
CREATE INDEX idx_training_cycles_user_active 
ON training_cycles(user_id, active);