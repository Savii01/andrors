-- Helper function to increment login count
CREATE OR REPLACE FUNCTION increment_login_count(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_profiles (user_id, login_count)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        login_count = user_profiles.login_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get recent login attempts count
CREATE OR REPLACE FUNCTION get_recent_attempts_count(
    p_user_id TEXT,
    p_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM login_attempts
    WHERE user_id = p_user_id
    AND timestamp >= NOW() - (p_minutes || ' minutes')::INTERVAL;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if device has been seen before
CREATE OR REPLACE FUNCTION has_seen_device(
    p_user_id TEXT,
    p_device_fingerprint TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM login_attempts
        WHERE user_id = p_user_id
        AND device_fingerprint = p_device_fingerprint
        LIMIT 1
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's normal login hours
CREATE OR REPLACE FUNCTION get_normal_login_hours(p_user_id TEXT)
RETURNS INTEGER[] AS $$
DECLARE
    v_hours INTEGER[];
BEGIN
    -- Get hours that appear more than once in login history
    SELECT ARRAY_AGG(DISTINCT hour)
    INTO v_hours
    FROM (
        SELECT EXTRACT(HOUR FROM timestamp)::INTEGER as hour, COUNT(*) as cnt
        FROM login_attempts
        WHERE user_id = p_user_id
        GROUP BY hour
        HAVING COUNT(*) > 1
    ) subq;
    
    RETURN COALESCE(v_hours, ARRAY[]::INTEGER[]);
END;
$$ LANGUAGE plpgsql;

-- Function to clean old login attempts (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM login_attempts
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Create index for cleanup function
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at 
ON login_attempts(created_at);

-- Add comments
COMMENT ON FUNCTION increment_login_count IS 'Increment user login count in user_profiles';
COMMENT ON FUNCTION get_recent_attempts_count IS 'Count login attempts in recent minutes';
COMMENT ON FUNCTION has_seen_device IS 'Check if device fingerprint exists for user';
COMMENT ON FUNCTION get_normal_login_hours IS 'Get array of hours when user typically logs in';
COMMENT ON FUNCTION cleanup_old_login_attempts IS 'Delete login attempts older than 90 days';
