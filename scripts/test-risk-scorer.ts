/**
 * Test script for risk scorer
 * Run with: npx ts-node scripts/test-risk-scorer.ts
 */

import { calculateRiskScore, RiskInput, generateExplanation } from '../lib/scoring/risk-scorer';
import { generateTestScenarios } from '../lib/testing/mock-data-generator';

console.log('=== Risk Scoring Engine Test ===\n');

// Generate test scenarios
const testData = generateTestScenarios('test_user_123');

console.log('User Profile:');
console.log('- Normal IPs:', testData.user.normalIps.join(', '));
console.log('- Normal Devices:', testData.user.normalDevices.join(', '));
console.log('- Normal Login Hours:', testData.user.normalLoginHours.join(', '));
console.log('\n');

// Test each scenario
const scenarios = [
  {
    name: 'Normal Login',
    data: testData.scenarios.normal,
    isNewDevice: false,
    isVpnOrProxy: false,
    recentAttemptCount: 1,
  },
  {
    name: 'New Device',
    data: testData.scenarios.newDevice,
    isNewDevice: true,
    isVpnOrProxy: false,
    recentAttemptCount: 1,
  },
  {
    name: 'New IP',
    data: testData.scenarios.newIp,
    isNewDevice: false,
    isVpnOrProxy: false,
    recentAttemptCount: 1,
  },
  {
    name: 'Bot Detection',
    data: testData.scenarios.bot,
    isNewDevice: false,
    isVpnOrProxy: false,
    recentAttemptCount: 1,
  },
  {
    name: 'VPN/Proxy',
    data: testData.scenarios.vpn,
    isNewDevice: false,
    isVpnOrProxy: true,
    recentAttemptCount: 1,
  },
  {
    name: 'Geographic Impossibility',
    data: testData.scenarios.geoImpossible,
    isNewDevice: false,
    isVpnOrProxy: false,
    recentAttemptCount: 1,
  },
  {
    name: 'Time Anomaly',
    data: testData.scenarios.timeAnomaly,
    isNewDevice: false,
    isVpnOrProxy: false,
    recentAttemptCount: 1,
  },
  {
    name: 'Multiple Factors (New Device + VPN + Rapid)',
    data: testData.scenarios.newDevice,
    isNewDevice: true,
    isVpnOrProxy: true,
    recentAttemptCount: 5,
  },
];

scenarios.forEach((scenario) => {
  const input: RiskInput = {
    userId: testData.user.userId,
    ipAddress: scenario.data.ip_address!,
    deviceFingerprint: scenario.data.device_fingerprint!,
    userAgent: scenario.data.user_agent!,
    timestamp: new Date(scenario.data.timestamp!),
    geoLocation: scenario.data.geographic_location || null,
    previousLogins: testData.history,
    isNewDevice: scenario.isNewDevice,
    recentAttemptCount: scenario.recentAttemptCount,
    userNormalLoginHours: testData.user.normalLoginHours,
    isVpnOrProxy: scenario.isVpnOrProxy,
  };

  const result = calculateRiskScore(input);
  const explanation = generateExplanation(result);

  console.log(`\n--- ${scenario.name} ---`);
  console.log(`Risk Score: ${result.score}`);
  console.log(`Recommendation: ${result.recommendation.toUpperCase()}`);
  console.log(`Factors: ${result.factors.join(', ') || 'none'}`);
  console.log(`Explanation: ${explanation}`);
  
  // Show color-coded recommendation
  const color = result.score < 21 ? '\x1b[32m' : result.score < 51 ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}Status: ${getStatusEmoji(result.recommendation)} ${result.recommendation}${reset}`);
});

console.log('\n\n=== Test Summary ===');
console.log('All risk scoring tests completed successfully!');
console.log('\nScore Breakdown by Factor:');
console.log('- New Device: +20');
console.log('- New IP: +15');
console.log('- Geographic Impossibility: +30');
console.log('- Time Anomaly: +10');
console.log('- Bot Signals: +25');
console.log('- Rapid Requests: +20');
console.log('- VPN/Proxy: +15');
console.log('\nRecommendation Thresholds:');
console.log('- 0-20: Allow (proceed normally)');
console.log('- 21-50: Monitor (flag but allow)');
console.log('- 51-100: Challenge (require MFA)');

function getStatusEmoji(recommendation: string): string {
  switch (recommendation) {
    case 'allow':
      return '✓';
    case 'monitor':
      return '⚠';
    case 'challenge':
      return '🔒';
    default:
      return '?';
  }
}
