-- First ensure all foreign keys are set to CASCADE
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing foreign key constraints referencing auth.users
    FOR r IN (
        SELECT tc.table_schema, 
               tc.table_name, 
               tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'auth'
          AND ccu.table_name = 'users'
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
            r.table_schema,
            r.table_name,
            r.constraint_name
        );
    END LOOP;
END $$;

-- Recreate all foreign keys with CASCADE delete
ALTER TABLE public.training_profiles
    DROP CONSTRAINT IF EXISTS training_profiles_user_id_fkey,
    ADD CONSTRAINT training_profiles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

ALTER TABLE public.anvandare_program
    DROP CONSTRAINT IF EXISTS anvandare_program_user_id_fkey,
    ADD CONSTRAINT anvandare_program_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

ALTER TABLE public.custom_exercises
    DROP CONSTRAINT IF EXISTS custom_exercises_user_id_fkey,
    ADD CONSTRAINT custom_exercises_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

ALTER TABLE public.workout_logs
    DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey,
    ADD CONSTRAINT workout_logs_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

ALTER TABLE public.weight_tracking
    DROP CONSTRAINT IF EXISTS weight_tracking_user_id_fkey,
    ADD CONSTRAINT weight_tracking_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

ALTER TABLE public.progress_tracking_logs
    DROP CONSTRAINT IF EXISTS progress_tracking_logs_user_id_fkey,
    ADD CONSTRAINT progress_tracking_logs_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Drop any blocking triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Ensure RLS policies are properly set
ALTER TABLE auth.users FORCE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Create policy to allow users to delete their own account
CREATE POLICY delete_own_user 
    ON auth.users 
    FOR DELETE 
    TO authenticated 
    USING (auth.uid() = id);