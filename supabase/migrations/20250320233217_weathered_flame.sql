-- Create admin role if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin;
  END IF;
END $$;

-- Grant admin necessary permissions
GRANT USAGE ON SCHEMA auth TO admin;
GRANT ALL ON auth.users TO admin;

-- Create admin function to delete users
CREATE OR REPLACE FUNCTION admin_delete_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the user
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Grant execute permission to admin
GRANT EXECUTE ON FUNCTION admin_delete_user TO admin;