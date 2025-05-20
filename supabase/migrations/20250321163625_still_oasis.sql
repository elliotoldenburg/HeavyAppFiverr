-- Drop existing trigger and function that creates profiles automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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

-- Set up proper permissions
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;

-- Grant anon role necessary permissions
GRANT USAGE ON SCHEMA auth TO anon;
GRANT ALL ON auth.users TO anon;
GRANT ALL ON auth.identities TO anon;
GRANT ALL ON auth.sessions TO anon;
GRANT ALL ON auth.refresh_tokens TO anon;

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

DROP POLICY IF EXISTS "Users can insert own training profile" ON public.training_profiles;
CREATE POLICY "Users can insert own training profile"
  ON public.training_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Grant public schema access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';