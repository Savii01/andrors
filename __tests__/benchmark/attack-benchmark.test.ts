/**
 * Empirical Bot Attack & Threat Benchmark Suite (Jest Executable)
 */

import { calculateRiskScore, RiskInput } from '../../lib/scoring/risk-scorer';
import { GeographicLocation, LoginAttempt } from '../../lib/database/supabase-client';

interface TestCase {
  name: string;
  category: 'bot_headless' | 'credential_burst' | 'vpn_datacenter' | 'geo_impossible' | 'legitimate_user' | 'subtle_anomaly';
  isAttack: boolean;
  expectedRecommendation: 'allow' | 'monitor' | 'challenge';
  input: RiskInput;
}

const mockLondon: GeographicLocation = { latitude: 51.5074, longitude: -0.1278, city: 'London', country: 'United Kingdom' };
const mockTokyo: GeographicLocation = { latitude: 35.6762, longitude: 139.6503, city: 'Tokyo', country: 'Japan' };
const mockNewYork: GeographicLocation = { latitude: 40.7128, longitude: -74.0060, city: 'New York', country: 'United States' };

function buildBaselineHistory(): LoginAttempt[] {
  const baseTime = new Date('2026-08-26T10:00:00Z');
  return [
    {
      user_id: 'alex_dev',
      ip_address: '194.26.29.10',
      device_fingerprint: 'fp_alex_macbook_pro_m2',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      timestamp: new Date(baseTime.getTime() - 24 * 3600 * 1000).toISOString(),
      geographic_location: mockLondon,
      risk_score: 0,
      recommendation: 'allow',
      factors: [],
    }
  ];
}

describe('Empirical Bot Attack & Threat Detection Benchmark', () => {
  const history = buildBaselineHistory();
  const now = new Date('2026-08-26T10:30:00Z');

  const dataset: TestCase[] = [
    // --- 1. HEADLESS & AUTOMATED BOT ATTACKS ---
    {
      name: 'Puppeteer Headless Bot',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '34.192.10.5',
        deviceFingerprint: 'fp_random_headless_instance',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/122.0.0.0 Safari/537.36 Puppeteer',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },
    {
      name: 'Selenium WebDriver Agent',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '54.144.20.11',
        deviceFingerprint: 'fp_selenium_chrome_grid',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Selenium/4.8',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },
    {
      name: 'Playwright Scripted Runtime',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '159.65.40.8',
        deviceFingerprint: 'fp_playwright_webkit_runner',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) playwright',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },
    {
      name: 'curl / Python-Requests Automated Scraper',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '185.220.101.5',
        deviceFingerprint: 'fp_none_raw_http',
        userAgent: 'python-requests/2.31.0',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 6,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },

    // --- 2. CREDENTIAL STUFFING BURST ---
    {
      name: 'Rapid Credential Stuffing Burst (12 attempts)',
      category: 'credential_burst',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '104.248.12.3',
        deviceFingerprint: 'fp_stuffer_cluster_88',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 12,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },

    // --- 3. IMPOSSIBLE TRAVEL ATO ---
    {
      name: 'Impossible Travel: London to Tokyo in 15 mins (9,560 km/h)',
      category: 'geo_impossible',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '133.242.18.9',
        deviceFingerprint: 'fp_tokyo_hijacked_session',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
        timestamp: new Date('2026-08-26T10:15:00Z'),
        geoLocation: mockTokyo,
        previousLogins: [
          {
            user_id: 'alex_dev',
            ip_address: '194.26.29.10',
            device_fingerprint: 'fp_alex_macbook_pro_m2',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            timestamp: '2026-08-26T10:00:00Z', // Logged in London 15 mins prior
            geographic_location: mockLondon,
            risk_score: 0,
            recommendation: 'allow',
            factors: [],
          }
        ],
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },

    // --- 4. TOR & COMMERCIAL VPN ROTATING PROXIES ---
    {
      name: 'Tor Exit Relay Anonymous Bot Attack',
      category: 'vpn_datacenter',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '185.220.100.240', // Known Tor Subnet (+15)
        deviceFingerprint: 'fp_tor_browser_bundle', // New Device (+20)
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0', // New IP (+15)
        timestamp: new Date('2026-08-26T03:30:00Z'), // 3:30 AM Time Anomaly (+10) -> Score 60
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },

    // --- 5. LEGITIMATE USERS ---
    {
      name: 'Legitimate User: Same Device & Known ISP',
      category: 'legitimate_user',
      isAttack: false,
      expectedRecommendation: 'allow',
      input: {
        userId: 'alex_dev',
        ipAddress: '194.26.29.10',
        deviceFingerprint: 'fp_alex_macbook_pro_m2',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: false,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },

    // --- 6. SUBTLE ANOMALIES ---
    {
      name: 'Subtle Anomaly: Same User on New Laptop (Home WiFi - ALLOW)',
      category: 'subtle_anomaly',
      isAttack: false,
      expectedRecommendation: 'allow',
      input: {
        userId: 'alex_dev',
        ipAddress: '194.26.29.10', // Familiar Home IP
        deviceFingerprint: 'fp_alex_new_ipad_pro', // New Device (+20 weight -> Score 20 = ALLOW)
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },
    {
      name: 'Subtle Anomaly: New Laptop at Coffee Shop IP (MONITOR)',
      category: 'subtle_anomaly',
      isAttack: false,
      expectedRecommendation: 'monitor',
      input: {
        userId: 'alex_dev',
        ipAddress: '82.165.197.1', // New residential/coffee shop IP (+15)
        deviceFingerprint: 'fp_alex_new_ipad_pro', // New Device (+20) -> Score 35 = MONITOR
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },
  ];

  test('should execute all attack vectors and compute empirical detection metrics', () => {
    let truePositives = 0;
    let falseNegatives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    const latencies: number[] = [];

    dataset.forEach((tc) => {
      const start = performance.now();
      const res = calculateRiskScore(tc.input);
      const duration = performance.now() - start;
      latencies.push(duration);

      const isChallenged = res.recommendation === 'challenge';

      if (tc.isAttack) {
        if (isChallenged) truePositives++;
        else falseNegatives++;
      } else {
        if (!isChallenged) trueNegatives++;
        else falsePositives++;
      }

      if (res.recommendation !== tc.expectedRecommendation) {
        console.log(`Mismatch on [${tc.name}]: score=${res.score}, got=${res.recommendation}, expected=${tc.expectedRecommendation}, factors=${res.factors.join(',')}`);
      }

      // Assert expected outcome
      expect(`${tc.name}: ${res.recommendation}`).toBe(`${tc.name}: ${tc.expectedRecommendation}`);
    });

    const totalAttacks = dataset.filter(d => d.isAttack).length;
    const totalLegit = dataset.filter(d => !d.isAttack).length;

    const catchRate = (truePositives / totalAttacks) * 100;
    const falsePositiveRate = (falsePositives / totalLegit) * 100;

    // Verify 100% catch rate on automated attacks and 0% false positive challenge rate on clean users
    expect(catchRate).toBe(100);
    expect(falsePositiveRate).toBe(0);
    expect(latencies.every(l => l < 100)).toBe(true); // Sub-100ms evaluation per request
  });
});
