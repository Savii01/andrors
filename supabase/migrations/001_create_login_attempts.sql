-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    geographic_location JSONB,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    recommendation TEXT NOT NULL CHECK (recommendation IN ('allow', 'monitor', 'challenge')),
    factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX idx_login_attempts_timestamp ON login_attempts(timestamp DESC);
CREATE INDEX idx_login_attempts_user_timestamp ON login_attempts(user_id, timestamp DESC);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_device_fingerprint ON login_attempts(device_fingerprint);

-- Add comment
COMMENT ON TABLE login_attempts IS 'Stores all login attempts with risk scoring data';
