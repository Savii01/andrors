/**
 * Risk Scoring Configuration
 * All weights, thresholds, and operational modes are configurable via environment variables
 */

export type VpnDetectionMode = 'enterprise' | 'consumer' | 'disabled';

export interface ScoringWeights {
  newDevice: number;
  newIp: number;
  geoImpossible: number;
  timeAnomaly: number;
  botSignals: number;
  rapidRequests: number;
  vpnProxy: number;
  botDynamics: number;
  powFailed: number;
  canaryTarget: number;
}

export interface RiskThresholds {
  monitor: number;
  challenge: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  thresholds: RiskThresholds;
  vpnMode: VpnDetectionMode;
}

/**
 * Get risk scoring configuration from environment variables
 * Falls back to default values if not configured
 */
export function getScoringConfig(): ScoringConfig {
  const vpnModeEnv = (process.env.VPN_DETECTION_MODE || 'enterprise').toLowerCase() as VpnDetectionMode;
  const vpnMode: VpnDetectionMode = ['enterprise', 'consumer', 'disabled'].includes(vpnModeEnv)
    ? vpnModeEnv
    : 'enterprise';

  // In consumer mode, default VPN weight is adjusted downwards if not explicitly overridden
  const defaultVpnWeight = vpnMode === 'consumer' ? '5' : vpnMode === 'disabled' ? '0' : '15';

  return {
    weights: {
      newDevice: parseInt(process.env.RISK_WEIGHT_NEW_DEVICE || '20', 10),
      newIp: parseInt(process.env.RISK_WEIGHT_NEW_IP || '15', 10),
      geoImpossible: parseInt(process.env.RISK_WEIGHT_GEO_IMPOSSIBLE || '30', 10),
      timeAnomaly: parseInt(process.env.RISK_WEIGHT_TIME_ANOMALY || '10', 10),
      botSignals: parseInt(process.env.RISK_WEIGHT_BOT_SIGNALS || '25', 10),
      rapidRequests: parseInt(process.env.RISK_WEIGHT_RAPID_REQUESTS || '20', 10),
      vpnProxy: parseInt(process.env.RISK_WEIGHT_VPN_PROXY || defaultVpnWeight, 10),
      botDynamics: parseInt(process.env.RISK_WEIGHT_BOT_DYNAMICS || '25', 10),
      powFailed: parseInt(process.env.RISK_WEIGHT_POW_FAILED || '35', 10),
      canaryTarget: parseInt(process.env.RISK_WEIGHT_CANARY_TARGET || '100', 10),
    },
    thresholds: {
      monitor: parseInt(process.env.RISK_THRESHOLD_MONITOR || '21', 10),
      challenge: parseInt(process.env.RISK_THRESHOLD_CHALLENGE || '51', 10),
    },
    vpnMode,
  };
}

/**
 * Validate scoring configuration
 */
export function validateScoringConfig(config: ScoringConfig): boolean {
  const weights = Object.values(config.weights);
  const allPositive = weights.every(w => w >= 0 && w <= 100);
  const thresholdsValid = 
    config.thresholds.monitor > 0 && 
    config.thresholds.challenge > config.thresholds.monitor &&
    config.thresholds.challenge <= 100;
  
  return allPositive && thresholdsValid;
}

// Export default config instance
export const scoringConfig = getScoringConfig();
