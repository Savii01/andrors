import { calculateRiskScore, RiskInput, generateExplanation } from '@/lib/scoring/risk-scorer';
import { ScoringConfig } from '@/lib/config/scoring-config';
import { parseCIDR, ipToLong, isPrivateOrLocalIP } from '@/lib/geo/ip-intelligence';

describe('Risk Scorer', () => {
  const mockConfig: ScoringConfig = {
    weights: {
      newDevice: 20,
      newIp: 15,
      geoImpossible: 30,
      timeAnomaly: 10,
      botSignals: 25,
      rapidRequests: 20,
      vpnProxy: 15,
    },
    thresholds: {
      monitor: 21,
      challenge: 51,
    },
    vpnMode: 'enterprise',
  };

  const baseInput: RiskInput = {
    userId: 'user_123',
    ipAddress: '192.168.1.1',
    deviceFingerprint: 'abc123',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timestamp: new Date('2024-08-25T14:30:00Z'),
    geoLocation: { latitude: 40.7128, longitude: -74.0060 },
    previousLogins: [
      {
        id: '1',
        user_id: 'user_123',
        ip_address: '192.168.1.1',
        device_fingerprint: 'abc123',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: '2024-08-25T10:00:00Z',
        geographic_location: { latitude: 40.7128, longitude: -74.0060 },
        risk_score: 0,
        recommendation: 'allow',
        factors: [],
      },
    ],
    isNewDevice: false,
    recentAttemptCount: 1,
    userNormalLoginHours: [9, 10, 14, 15],
    isVpnOrProxy: false,
  };

  test('should return 0 score for normal login', () => {
    const result = calculateRiskScore(baseInput, mockConfig);
    expect(result.score).toBe(0);
    expect(result.recommendation).toBe('allow');
    expect(result.factors).toHaveLength(0);
  });

  test('should detect new device', () => {
    const input = { ...baseInput, isNewDevice: true };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(20);
    expect(result.recommendation).toBe('allow');
    expect(result.factors).toContain('new_device');
  });

  test('should detect new IP', () => {
    const input = { ...baseInput, ipAddress: '203.0.113.99' };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(15);
    expect(result.factors).toContain('new_ip');
  });

  test('should detect bot signals', () => {
    const input = { ...baseInput, userAgent: 'HeadlessChrome/91.0.4472.124' };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(25);
    expect(result.recommendation).toBe('monitor');
    expect(result.factors).toContain('bot_signals');
  });

  test('should detect rapid requests', () => {
    const input = { ...baseInput, recentAttemptCount: 5 };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(20);
    expect(result.factors).toContain('rapid_requests');
  });

  test('should detect VPN/proxy in enterprise mode', () => {
    const input = { ...baseInput, isVpnOrProxy: true };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(15);
    expect(result.factors).toContain('vpn_proxy');
  });

  test('should adjust VPN weighting in consumer vs enterprise mode', () => {
    const input = { ...baseInput, isVpnOrProxy: true };
    
    // Consumer mode config with lower weight
    const consumerConfig: ScoringConfig = {
      ...mockConfig,
      vpnMode: 'consumer',
      weights: { ...mockConfig.weights, vpnProxy: 5 },
    };
    const consumerResult = calculateRiskScore(input, consumerConfig);
    expect(consumerResult.score).toBe(5);

    // Disabled mode config
    const disabledConfig: ScoringConfig = {
      ...mockConfig,
      vpnMode: 'disabled',
    };
    const disabledResult = calculateRiskScore(input, disabledConfig);
    expect(disabledResult.score).toBe(0);
    expect(disabledResult.factors).not.toContain('vpn_proxy');
  });

  test('should detect time anomaly', () => {
    const input = {
      ...baseInput,
      timestamp: new Date('2024-08-25T03:00:00Z'),
      userNormalLoginHours: [9, 10, 14, 15],
    };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(10);
    expect(result.factors).toContain('time_anomaly');
  });

  test('should detect geographic impossibility', () => {
    const input = {
      ...baseInput,
      timestamp: new Date('2024-08-25T10:30:00Z'),
      geoLocation: { latitude: 40.7128, longitude: -74.0060 }, // New York
      previousLogins: [
        {
          id: '1',
          user_id: 'user_123',
          ip_address: '192.168.1.1',
          device_fingerprint: 'abc123',
          user_agent: 'Mozilla/5.0',
          timestamp: '2024-08-25T10:00:00Z', // 30 minutes earlier from London
          geographic_location: { latitude: 51.5074, longitude: -0.1278 }, // London
          risk_score: 0,
          recommendation: 'allow' as const,
          factors: [],
        },
      ],
      ipAddress: '192.168.1.1',
    };

    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(30);
    expect(result.factors).toContain('geo_impossible');
  });

  test('should combine multiple factors', () => {
    const input = {
      ...baseInput,
      isNewDevice: true,
      isVpnOrProxy: true,
      recentAttemptCount: 5,
      ipAddress: '192.168.1.1',
    };
    const result = calculateRiskScore(input, mockConfig);
    expect(result.score).toBe(55);
    expect(result.recommendation).toBe('challenge');
    expect(result.factors).toContain('new_device');
    expect(result.factors).toContain('vpn_proxy');
    expect(result.factors).toContain('rapid_requests');
  });

  test('should cap score at 100', () => {
    const input = {
      ...baseInput,
      isNewDevice: true,
      isVpnOrProxy: true,
      recentAttemptCount: 10,
      userAgent: 'HeadlessChrome',
      ipAddress: '203.0.113.99',
      previousLogins: [],
    };

    const highWeightConfig: ScoringConfig = {
      weights: {
        newDevice: 50,
        newIp: 50,
        geoImpossible: 50,
        timeAnomaly: 50,
        botSignals: 50,
        rapidRequests: 50,
        vpnProxy: 50,
      },
      thresholds: mockConfig.thresholds,
      vpnMode: 'enterprise',
    };

    const result = calculateRiskScore(input, highWeightConfig);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('should generate explanation for normal login', () => {
    const result = calculateRiskScore(baseInput, mockConfig);
    const explanation = generateExplanation(result);
    expect(explanation).toContain('Normal login pattern');
  });

  test('should generate explanation with factors', () => {
    const input = { ...baseInput, isNewDevice: true, isVpnOrProxy: true };
    const result = calculateRiskScore(input, mockConfig);
    const explanation = generateExplanation(result);
    expect(explanation).toContain('new device');
    expect(explanation).toContain('commercial VPN or datacenter proxy');
  });
});

describe('IP Threat Intelligence & CIDR Math', () => {
  test('should correctly convert IPv4 to unsigned 32-bit int', () => {
    expect(ipToLong('192.168.1.1')).toBe(3232235777);
    expect(ipToLong('127.0.0.1')).toBe(2130706433);
    expect(ipToLong('invalid')).toBe(0);
  });

  test('should parse CIDR and match subnets', () => {
    const parsed = parseCIDR('185.220.101.0/24', 'vpn', 'Tor Relay');
    expect(parsed).not.toBeNull();
    if (parsed) {
      const ipLong = ipToLong('185.220.101.55');
      const matches = ((ipLong & parsed.maskLong) >>> 0) === parsed.networkLong;
      expect(matches).toBe(true);

      const nonMatchLong = ipToLong('185.220.102.55');
      const nonMatches = ((nonMatchLong & parsed.maskLong) >>> 0) === parsed.networkLong;
      expect(nonMatches).toBe(false);
    }
  });

  test('should identify private and loopback IPs', () => {
    expect(isPrivateOrLocalIP('127.0.0.1')).toBe(true);
    expect(isPrivateOrLocalIP('192.168.0.1')).toBe(true);
    expect(isPrivateOrLocalIP('10.0.0.1')).toBe(true);
    expect(isPrivateOrLocalIP('8.8.8.8')).toBe(false);
  });
});
