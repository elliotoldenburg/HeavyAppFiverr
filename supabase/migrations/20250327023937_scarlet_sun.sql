-- First drop existing triggers and constraints
DROP TRIGGER IF EXISTS on_cycle_deactivation ON training_cycles;
DROP TRIGGER IF EXISTS on_cycle_activation ON training_cycles;
DROP FUNCTION IF EXISTS handle_cycle_deactivation CASCADE;
DROP FUNCTION IF EXISTS handle_cycle_activation CASCADE;

-- Drop and recreate the unique constraint
ALTER TABLE training_cycles 
DROP CONSTRAINT IF EXISTS unique_active_cycle;

ALTER TABLE training_cycles
ADD CONSTRAINT unique_active_cycle 
  UNIQUE (user_id, active) 
  DEFERRABLE INITIALLY DEFERRED;

-- Create function to handle cycle state changes
CREATE OR REPLACE FUNCTION handle_cycle_state_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If cycle is being deactivated
  IF OLD.active = true AND NEW.active = false THEN
    -- Set end date to current date if not already set
    IF NEW.end_date IS NULL THEN
      NEW.end_date := CURRENT_DATE;
    END IF;
    
    -- Clear training goal from profile
    UPDATE training_profiles
    SET training_goal = ''
    WHERE user_id = NEW.user_id;
  END IF;

  -- If cycle is being activated, deactivate all other cycles
  IF NEW.active = true AND (TG_OP = 'INSERT' OR OLD.active = false) THEN
    UPDATE training_cycles
    SET active = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cycle state changes
CREATE TRIGGER handle_cycle_state_changes
  BEFORE INSERT OR UPDATE ON training_cycles
  FOR EACH ROW
  EXECUTE FUNCTION handle_cycle_state_change();

-- Create function to safely end cycle
CREATE OR REPLACE FUNCTION end_training_cycle(cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use a transaction to ensure atomicity
  BEGIN
    -- First update the cycle's end date and active status
    UPDATE training_cycles
    SET 
      end_date = CURRENT_DATE,
      active = false
    WHERE id = cycle_id;

    -- Clear the training goal from the user's profile
    UPDATE training_profiles
    SET training_goal = ''
    WHERE user_id = (
      SELECT user_id 
      FROM training_cycles 
      WHERE id = cycle_id
    );

    -- Commit the transaction
    COMMIT;
  EXCEPTION
    WHEN others THEN
      -- Rollback on any error
      ROLLBACK;
      RAISE;
  END;
END;
$$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';