-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Reset auth.users constraints and indexes
ALTER TABLE auth.users 
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

DROP INDEX IF EXISTS auth.users_email_key;
DROP INDEX IF EXISTS auth.users_instance_id_email_idx;

-- Reset auth.users structure
ALTER TABLE auth.users
  ALTER COLUMN email TYPE text,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN encrypted_password DROP NOT NULL,
  ALTER COLUMN email_confirmed_at DROP NOT NULL,
  ALTER COLUMN aud SET DEFAULT 'authenticated',
  ALTER COLUMN role SET DEFAULT 'authenticated',
  ALTER COLUMN raw_app_meta_data SET DEFAULT '{"provider":"email","providers":["email"]}';

-- Create case-insensitive unique email index
CREATE UNIQUE INDEX users_email_key 
ON auth.users (LOWER(email)) 
WHERE email IS NOT NULL;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.training_profiles (
    id,
    user_id,
    full_name,
    age,
    gender,
    height_cm,
    weight_kg,
    training_goal,
    experience_level,
    equipment_access,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    0,
    '',
    0,
    0,
    '',
    '',
    '',
    now(),
    now()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Set up proper permissions
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;

-- Grant anon role necessary permissions
GRANT USAGE ON SCHEMA auth TO anon;
GRANT ALL ON auth.users TO anon;
GRANT ALL ON auth.identities TO anon;

-- Grant authenticated role permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.identities TO authenticated;

-- Set up RLS on training_profiles
ALTER TABLE public.training_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own training profile" ON public.training_profiles;
CREATE POLICY "Users can read own training profile"
  ON public.training_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own training profile" ON public.training_profiles;
CREATE POLICY "Users can update own training profile"
  ON public.training_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';