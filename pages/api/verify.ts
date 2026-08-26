import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import {
  insertLoginAttempt,
  getLastLoginAttempts,
  hasSeenDevice,
  getLoginAttemptsInTimeWindow,
} from '@/lib/database/queries';
import { calculateRiskScore, generateExplanation, RiskInput } from '@/lib/scoring/risk-scorer';
import { getLocationFromIP, isVpnOrProxy, initializeGeoIP } from '@/lib/geo/ip-intelligence';
import { LoginAttempt } from '@/lib/database/supabase-client';

// Initialize GeoIP on module load
let geoInitialized = false;
async function ensureGeoInitialized() {
  if (!geoInitialized) {
    await initializeGeoIP();
    geoInitialized = true;
  }
}

interface VerifyRequest {
  userId: string;
  ipAddress: string;
  deviceFingerprint: string;
  userAgent: string;
  timestamp?: string;
}

interface VerifyResponse {
  riskScore: number;
  recommendation: 'allow' | 'monitor' | 'challenge';
  factors: string[];
  explanation: string;
  requestId: string;
  success: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyResponse>
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      riskScore: 0,
      recommendation: 'allow',
      factors: [],
      explanation: 'Method not allowed',
      requestId: uuidv4(),
      success: false,
      error: 'Only POST requests are accepted',
    });
  }

  const requestId = uuidv4();

  try {
    // Validate request body
    const { userId, ipAddress, deviceFingerprint, userAgent, timestamp }: VerifyRequest = req.body;

    if (!userId || !ipAddress || !deviceFingerprint || !userAgent) {
      return res.status(400).json({
        riskScore: 0,
        recommendation: 'allow',
        factors: [],
        explanation: 'Missing required fields',
        requestId,
        success: false,
        error: 'userId, ipAddress, deviceFingerprint, and userAgent are required',
      });
    }

    // Parse timestamp or use current time
    const loginTimestamp = timestamp ? new Date(timestamp) : new Date();

    // Initialize GeoIP if needed
    await ensureGeoInitialized();

    // Gather data for risk calculation
    const [previousLogins, isNewDevice, geoLocation, isVpn] = await Promise.all([
      getLastLoginAttempts(userId, 10),
      hasSeenDevice(userId, deviceFingerprint).then(seen => !seen),
      Promise.resolve(getLocationFromIP(ipAddress)),
      isVpnOrProxy(ipAddress),
    ]);

    // Count recent attempts (last 10 minutes)
    const tenMinutesAgo = new Date(loginTimestamp.getTime() - 10 * 60 * 1000);
    const recentAttempts = await getLoginAttemptsInTimeWindow(
      userId,
      tenMinutesAgo,
      loginTimestamp
    );

    // Extract user's normal login hours from history
    const normalLoginHours = extractNormalLoginHours(previousLogins);

    // Prepare risk input
    const riskInput: RiskInput = {
      userId,
      ipAddress,
      deviceFingerprint,
      userAgent,
      timestamp: loginTimestamp,
      geoLocation,
      previousLogins,
      isNewDevice,
      recentAttemptCount: recentAttempts.length,
      userNormalLoginHours: normalLoginHours,
      isVpnOrProxy: isVpn,
    };

    // Calculate risk score
    const riskResult = calculateRiskScore(riskInput);
    const explanation = generateExplanation(riskResult);

    // Store login attempt in database
    const loginAttempt: LoginAttempt = {
      user_id: userId,
      ip_address: ipAddress,
      device_fingerprint: deviceFingerprint,
      user_agent: userAgent,
      timestamp: loginTimestamp.toISOString(),
      geographic_location: geoLocation,
      risk_score: riskResult.score,
      recommendation: riskResult.recommendation,
      factors: riskResult.factors,
    };

    // Insert asynchronously (don't block response)
    insertLoginAttempt(loginAttempt).catch(error => {
      console.error('Failed to store login attempt:', error);
    });

    // Return response
    return res.status(200).json({
      riskScore: riskResult.score,
      recommendation: riskResult.recommendation,
      factors: riskResult.factors,
      explanation,
      requestId,
      success: true,
    });

  } catch (error) {
    console.error('Error processing verification request:', error);

    // Fallback to conservative scoring on error
    return res.status(200).json({
      riskScore: 50,
      recommendation: 'monitor',
      factors: ['error_fallback'],
      explanation: 'Unable to complete risk assessment. Flagged for monitoring.',
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extract normal login hours from previous logins
 * Returns array of hours (0-23) when user typically logs in
 */
function extractNormalLoginHours(previousLogins: LoginAttempt[]): number[] {
  if (previousLogins.length < 3) {
    return []; // Not enough data
  }

  const hourCounts: Record<number, number> = {};

  for (const login of previousLogins) {
    const hour = new Date(login.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Return hours that appear more than once
  return Object.entries(hourCounts)
    .filter(([_, count]) => count > 1)
    .map(([hour]) => parseInt(hour, 10));
}
