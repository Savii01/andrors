import { getScoringConfig, ScoringConfig } from '../config/scoring-config';
import { LoginAttempt, GeographicLocation } from '../database/supabase-client';

/**
 * Risk factors that can be triggered
 */
export type RiskFactor =
  | 'new_device'
  | 'new_ip'
  | 'geo_impossible'
  | 'time_anomaly'
  | 'bot_signals'
  | 'rapid_requests'
  | 'vpn_proxy'
  | 'bot_dynamics'
  | 'pow_failed'
  | 'canary_target';

/**
 * Input data for risk calculation
 */
export interface RiskInput {
  userId: string;
  ipAddress: string;
  deviceFingerprint: string;
  userAgent: string;
  timestamp: Date;
  geoLocation: GeographicLocation | null;
  
  // Historical data
  previousLogins: LoginAttempt[];
  isNewDevice: boolean;
  recentAttemptCount: number;
  userNormalLoginHours: number[];
  isVpnOrProxy: boolean;

  // Phase 2 signals
  isHumanDynamics?: boolean;
  isTrusted?: boolean;
  powValid?: boolean;
  isCanaryUser?: boolean;
  webrtcCandidateIp?: string | null;
}

/**
 * Risk scoring result
 */
export interface RiskScore {
  score: number;
  recommendation: 'allow' | 'monitor' | 'challenge';
  factors: RiskFactor[];
  breakdown: Record<RiskFactor, number>;
}

/**
 * Calculate risk score based on multiple factors
 */
export function calculateRiskScore(input: RiskInput, config?: ScoringConfig): RiskScore {
  const scoringConfig = config || getScoringConfig();
  const factors: RiskFactor[] = [];
  const breakdown: Record<RiskFactor, number> = {
    new_device: 0,
    new_ip: 0,
    geo_impossible: 0,
    time_anomaly: 0,
    bot_signals: 0,
    rapid_requests: 0,
    vpn_proxy: 0,
    bot_dynamics: 0,
    pow_failed: 0,
    canary_target: 0,
  };

  let totalScore = 0;

  // Factor 1: New Device
  if (input.isNewDevice) {
    factors.push('new_device');
    breakdown.new_device = scoringConfig.weights.newDevice;
    totalScore += scoringConfig.weights.newDevice;
  }

  // Factor 2: New IP
  if (isNewIp(input.ipAddress, input.previousLogins)) {
    factors.push('new_ip');
    breakdown.new_ip = scoringConfig.weights.newIp;
    totalScore += scoringConfig.weights.newIp;
  }

  // Factor 3: Geographic Impossibility
  const geoImpossibility = checkGeographicImpossibility(input.geoLocation, input.previousLogins, input.timestamp);
  if (geoImpossibility) {
    factors.push('geo_impossible');
    breakdown.geo_impossible = scoringConfig.weights.geoImpossible;
    totalScore += scoringConfig.weights.geoImpossible;
  }

  // Factor 4: Time Anomaly
  const timeAnomaly = checkTimeAnomaly(input.timestamp, input.userNormalLoginHours);
  if (timeAnomaly) {
    factors.push('time_anomaly');
    breakdown.time_anomaly = scoringConfig.weights.timeAnomaly;
    totalScore += scoringConfig.weights.timeAnomaly;
  }

  // Factor 5: Bot Signals
  const isBotLike = detectBotSignals(input.userAgent);
  if (isBotLike) {
    factors.push('bot_signals');
    breakdown.bot_signals = scoringConfig.weights.botSignals;
    totalScore += scoringConfig.weights.botSignals;
  }

  // Factor 6: Rapid Requests
  if (input.recentAttemptCount >= 5) {
    factors.push('rapid_requests');
    breakdown.rapid_requests = scoringConfig.weights.rapidRequests;
    totalScore += scoringConfig.weights.rapidRequests;
  }

  // Factor 7: VPN/Proxy (Weighted according to enterprise vs consumer mode)
  if (input.isVpnOrProxy && scoringConfig.vpnMode !== 'disabled') {
    const vpnWeight = scoringConfig.weights.vpnProxy;
    if (vpnWeight > 0) {
      factors.push('vpn_proxy');
      breakdown.vpn_proxy = vpnWeight;
      totalScore += vpnWeight;
    }
  }

  // Factor 8: Behavioral Dynamics — bot-like mouse/keystroke patterns or synthetic events
  if (input.isHumanDynamics === false || input.isTrusted === false) {
    factors.push('bot_dynamics');
    breakdown.bot_dynamics = scoringConfig.weights.botDynamics;
    totalScore += scoringConfig.weights.botDynamics;
  }

  // Factor 9: Proof-of-Work failure — missing or invalid PoW solution
  if (input.powValid === false) {
    factors.push('pow_failed');
    breakdown.pow_failed = scoringConfig.weights.powFailed;
    totalScore += scoringConfig.weights.powFailed;
  }

  // Factor 10: Canary / honeypot target — immediate hard block
  if (input.isCanaryUser === true) {
    factors.push('canary_target');
    breakdown.canary_target = scoringConfig.weights.canaryTarget;
    totalScore += scoringConfig.weights.canaryTarget;
  }

  // Cap score at 100
  const finalScore = Math.min(totalScore, 100);

  // Determine recommendation
  const recommendation = getRecommendation(finalScore, scoringConfig);

  return {
    score: finalScore,
    recommendation,
    factors,
    breakdown,
  };
}

/**
 * Check if IP is new (not in last 3 logins)
 */
function isNewIp(currentIp: string, previousLogins: LoginAttempt[]): boolean {
  const lastThreeLogins = previousLogins.slice(0, 3);
  return !lastThreeLogins.some(login => login.ip_address === currentIp);
}

/**
 * Check for geographic impossibility
 * Returns true if user logged in from >5000km away within 1 hour
 */
function checkGeographicImpossibility(
  currentLocation: GeographicLocation | null,
  previousLogins: LoginAttempt[],
  currentTimestamp: Date = new Date()
): boolean {
  if (!currentLocation || previousLogins.length === 0) {
    return false;
  }

  const lastLogin = previousLogins[0];
  if (!lastLogin.geographic_location) {
    return false;
  }

  const lastLocation = lastLogin.geographic_location as GeographicLocation;
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    lastLocation.latitude,
    lastLocation.longitude
  );

  const timeDiff = Math.abs(currentTimestamp.getTime() - new Date(lastLogin.timestamp).getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  // If more than 5000km apart and less than 1 hour difference
  return distance > 5000 && hoursDiff < 1;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if login time is anomalous compared to user's normal hours
 */
function checkTimeAnomaly(timestamp: Date, normalHours: number[]): boolean {
  if (normalHours.length === 0) {
    return false; // Not enough data to determine anomaly
  }

  const loginHour = timestamp.getHours();
  
  // Check if current hour is in normal hours (with ±2 hour tolerance)
  const isNormalHour = normalHours.some(hour => 
    Math.abs(hour - loginHour) <= 2 || 
    Math.abs(hour - loginHour) >= 22 // Wrap around midnight
  );

  return !isNormalHour;
}

/**
 * Detect bot-like user agents
 */
function detectBotSignals(userAgent: string): boolean {
  const botPatterns = [
    /headless/i,
    /phantom/i,
    /selenium/i,
    /webdriver/i,
    /puppeteer/i,
    /playwright/i,
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /http\.client/i,
  ];

  return botPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Determine recommendation based on score and thresholds
 */
function getRecommendation(
  score: number,
  config: ScoringConfig
): 'allow' | 'monitor' | 'challenge' {
  if (score >= config.thresholds.challenge) {
    return 'challenge';
  } else if (score >= config.thresholds.monitor) {
    return 'monitor';
  } else {
    return 'allow';
  }
}

/**
 * Generate human-readable explanation of risk score
 */
export function generateExplanation(result: RiskScore): string {
  if (result.factors.length === 0) {
    return 'Normal login pattern detected. No risk factors identified.';
  }

  const factorDescriptions: Record<RiskFactor, string> = {
    new_device: 'new device detected',
    new_ip: 'new IP address',
    geo_impossible: 'geographic impossibility (too far, too fast)',
    time_anomaly: 'unusual login time',
    bot_signals: 'bot-like behavior detected',
    rapid_requests: 'multiple rapid login attempts',
    vpn_proxy: 'commercial VPN or datacenter proxy detected',
    bot_dynamics: 'non-human input dynamics (mouse/keyboard)',
    pow_failed: 'proof-of-work challenge failed or missing',
    canary_target: 'honeypot account targeted',
  };

  const descriptions = result.factors.map(f => factorDescriptions[f]).join(', ');
  
  return `Risk factors: ${descriptions}. ${getRecommendationText(result.recommendation)}`;
}

function getRecommendationText(recommendation: 'allow' | 'monitor' | 'challenge'): string {
  switch (recommendation) {
    case 'allow':
      return 'User allowed.';
    case 'monitor':
      return 'User allowed but flagged for monitoring.';
    case 'challenge':
      return 'Additional verification required.';
  }
}
