/**
 * Client-side verification utilities
 * Use this to call the /api/verify endpoint from your frontend
 */

import { generateDeviceFingerprint } from '../fingerprint/device-fingerprint';

export interface VerificationRequest {
  userId: string;
  ipAddress?: string; // Optional - can be determined server-side
  deviceFingerprint?: string; // Optional - auto-generated if not provided
  userAgent?: string; // Optional - auto-detected if not provided
  timestamp?: string;
}

export interface VerificationResponse {
  riskScore: number;
  recommendation: 'allow' | 'monitor' | 'challenge';
  factors: string[];
  explanation: string;
  requestId: string;
  success: boolean;
  error?: string;
}

/**
 * Verify a login attempt
 * Call this before allowing user to authenticate
 */
export async function verifyLogin(
  request: VerificationRequest
): Promise<VerificationResponse> {
  try {
    // Generate device fingerprint if not provided
    const deviceFingerprint = request.deviceFingerprint || 
      await generateDeviceFingerprint();

    // Get user agent if not provided
    const userAgent = request.userAgent || 
      (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown');

    // Prepare request payload
    const payload = {
      userId: request.userId,
      ipAddress: request.ipAddress || 'auto', // Server will detect
      deviceFingerprint,
      userAgent,
      timestamp: request.timestamp || new Date().toISOString(),
    };

    // Call API
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.statusText}`);
    }

    const result: VerificationResponse = await response.json();
    return result;

  } catch (error) {
    console.error('Verification error:', error);
    
    // Return fallback response on error
    return {
      riskScore: 50,
      recommendation: 'monitor',
      factors: ['client_error'],
      explanation: 'Unable to verify login. Proceeding with caution.',
      requestId: 'error',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle verification result
 * Determines what action to take based on recommendation
 */
export function handleVerificationResult(
  result: VerificationResponse
): 'proceed' | 'ask_password' | 'require_mfa' {
  switch (result.recommendation) {
    case 'allow':
      return 'proceed';
    case 'monitor':
      return 'ask_password'; // Re-confirm password
    case 'challenge':
      return 'require_mfa'; // Require additional verification
    default:
      return 'require_mfa'; // Be conservative on unknown
  }
}

/**
 * Example usage in login flow
 */
export async function exampleLoginFlow(userId: string) {
  // 1. User enters credentials
  console.log('User attempting login...');

  // 2. Verify the login attempt
  const verification = await verifyLogin({ userId });

  // 3. Handle result
  const action = handleVerificationResult(verification);

  console.log(`Risk Score: ${verification.riskScore}`);
  console.log(`Recommendation: ${verification.recommendation}`);
  console.log(`Factors: ${verification.factors.join(', ')}`);
  console.log(`Action: ${action}`);

  switch (action) {
    case 'proceed':
      console.log('✓ Login allowed');
      // Proceed with authentication
      break;

    case 'ask_password':
      console.log('⚠ Re-enter password required');
      // Show password re-entry form
      break;

    case 'require_mfa':
      console.log('🔒 MFA required');
      // Show MFA challenge
      break;
  }

  return { verification, action };
}
