import { supabase, LoginAttempt, UserProfile } from './supabase-client';

/**
 * Insert a new login attempt
 */
export async function insertLoginAttempt(attempt: LoginAttempt): Promise<LoginAttempt | null> {
  try {
    const { data, error } = await supabase
      .from('login_attempts')
      .insert(attempt)
      .select()
      .single();

    if (error) {
      console.error('Error inserting login attempt:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error inserting login attempt:', error);
    return null;
  }
}

/**
 * Get last N login attempts for a user
 * Optimized with index on (user_id, timestamp DESC)
 */
export async function getLastLoginAttempts(
  userId: string,
  limit: number = 10
): Promise<LoginAttempt[]> {
  try {
    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching login attempts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error fetching login attempts:', error);
    return [];
  }
}

/**
 * Get login attempts within a time window
 */
export async function getLoginAttemptsInTimeWindow(
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<LoginAttempt[]> {
  try {
    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching login attempts in time window:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error fetching login attempts in time window:', error);
    return [];
  }
}

/**
 * Check if device fingerprint exists for user
 */
export async function hasSeenDevice(userId: string, deviceFingerprint: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('login_attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceFingerprint)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking device:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Unexpected error checking device:', error);
    return false;
  }
}

/**
 * Get or create user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Unexpected error fetching user profile:', error);
    return null;
  }
}

/**
 * Upsert user profile
 */
export async function upsertUserProfile(profile: UserProfile): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(profile, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error upserting user profile:', error);
    return null;
  }
}

/**
 * Update user profile login count
 */
export async function incrementLoginCount(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_login_count', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error incrementing login count:', error);
    }
  } catch (error) {
    console.error('Unexpected error incrementing login count:', error);
  }
}
