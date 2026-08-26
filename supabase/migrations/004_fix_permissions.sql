-- Grant permissions to service_role
-- This fixes permission denied errors when using service_role key

-- Grant permissions on login_attempts table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_attempts TO service_role;

-- Grant permissions on user_profiles table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO service_role;

-- Disable RLS for development (enable after securing policies)
ALTER TABLE login_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
