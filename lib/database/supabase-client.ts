import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Supabase client with service role for server-side operations
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Database types
 */
export interface LoginAttempt {
  id?: string;
  user_id: string;
  ip_address: string;
  device_fingerprint: string;
  user_agent: string;
  timestamp: string;
  geographic_location: GeographicLocation | null;
  risk_score: number;
  recommendation: 'allow' | 'monitor' | 'challenge';
  factors: string[];
  created_at?: string;
}

export interface UserProfile {
  user_id: string;
  first_seen_ip: string | null;
  first_seen_device: string | null;
  normal_login_times: number[];
  common_locations: GeographicLocation[];
  login_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface GeographicLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  timezone?: string;
}
