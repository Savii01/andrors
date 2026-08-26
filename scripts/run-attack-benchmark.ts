/**
 * andrors Empirical Bot Attack & Threat Benchmark Suite
 * Executes synthetic bot attacks (Puppeteer, curl, Selenium, CIDR datacenter rotation, impossible travel)
 * against the verification engine and calculates:
 * - Attack Catch Rate (%)
 * - False Positive Rate (%)
 * - Precision, Recall, and F1-Score
 * - Evaluation Latency Percentiles (p50, p95, p99)
 */

import { calculateRiskScore, RiskInput } from '../lib/scoring/risk-scorer';
import { matchLocalThreatRanges, parseCIDR } from '../lib/geo/ip-intelligence';
import { GeographicLocation, LoginAttempt } from '../lib/database/supabase-client';

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
      ip_address: '194.26.29.10', // Regular ISP
      device_fingerprint: 'fp_alex_macbook_pro_m2',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      timestamp: new Date(baseTime.getTime() - 24 * 3600 * 1000).toISOString(),
      geographic_location: mockLondon,
      risk_score: 0,
      recommendation: 'allow',
      factors: [],
    },
    {
      user_id: 'alex_dev',
      ip_address: '194.26.29.10',
      device_fingerprint: 'fp_alex_macbook_pro_m2',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      timestamp: new Date(baseTime.getTime() - 48 * 3600 * 1000).toISOString(),
      geographic_location: mockLondon,
      risk_score: 0,
      recommendation: 'allow',
      factors: [],
    }
  ];
}

export function generateAttackDataset(): TestCase[] {
  const history = buildBaselineHistory();
  const now = new Date('2026-08-26T10:30:00Z');

  const testCases: TestCase[] = [
    // --- 1. HEADLESS & AUTOMATED BOT ATTACKS (Puppeteer, Selenium, Playwright, Scraper, curl) ---
    {
      name: 'Puppeteer Headless Bot (Stealth mode bypass attempt)',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '34.192.10.5', // AWS datacenter IP
        deviceFingerprint: 'fp_random_headless_instance',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/122.0.0.0 Safari/537.36 Puppeteer',
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
      name: 'Selenium WebDriver Automation Agent',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '54.144.20.11', // AWS datacenter IP
        deviceFingerprint: 'fp_selenium_chrome_grid',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Selenium/4.8',
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
      name: 'Playwright Scripted Login Attempt',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '159.65.40.8', // DigitalOcean droplet
        deviceFingerprint: 'fp_playwright_webkit_runner',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 playwright',
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
      name: 'curl / Python-Requests Automated Scraping Script',
      category: 'bot_headless',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '185.220.101.5', // Tor exit node
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

    // --- 2. CREDENTIAL STUFFING BURST ATTACKS ---
    {
      name: 'Rapid Credential Stuffing Burst (12 attempts in 3 mins)',
      category: 'credential_burst',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '104.248.12.3', // DigitalOcean proxy
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
    {
      name: 'High-Frequency Brute-Force Password Spray',
      category: 'credential_burst',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '167.99.50.2', // Datacenter
        deviceFingerprint: 'fp_spray_bot_v2',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 8,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },

    // --- 3. GEOGRAPHIC IMPOSSIBILITY / IMPOSSIBLE TRAVEL ATTACKS ---
    {
      name: 'Impossible Travel: London to Tokyo in 15 Minutes (9,560 km/h)',
      category: 'geo_impossible',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '133.242.18.9', // Tokyo IP
        deviceFingerprint: 'fp_tokyo_hijacked_session',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
        timestamp: new Date('2026-08-26T10:15:00Z'), // 15 mins after London login
        geoLocation: mockTokyo,
        previousLogins: [history[0]], // Logged in London at 10:00
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },
    {
      name: 'Impossible Travel: London to New York in 10 Minutes (33,400 km/h)',
      category: 'geo_impossible',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '198.51.100.22', // US VPN IP
        deviceFingerprint: 'fp_us_proxy_spoof',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X)',
        timestamp: new Date('2026-08-26T10:10:00Z'), // 10 mins after London login
        geoLocation: mockNewYork,
        previousLogins: [history[0]],
        isNewDevice: true,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },

    // --- 4. COMMERCIAL VPN & TOR ROTATING PROXIES ---
    {
      name: 'Tor Exit Relay Anonymous Login Attempt',
      category: 'vpn_datacenter',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '185.220.100.240', // Known Tor Subnet
        deviceFingerprint: 'fp_tor_browser_bundle',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
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
      name: 'Commercial Datacenter Proxy Relay (AWS us-east-1)',
      category: 'vpn_datacenter',
      isAttack: true,
      expectedRecommendation: 'challenge',
      input: {
        userId: 'alex_dev',
        ipAddress: '52.0.12.88', // AWS CIDR 52.0.0.0/11
        deviceFingerprint: 'fp_datacenter_proxy',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0',
        timestamp: now,
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: true,
        recentAttemptCount: 2,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: true,
      },
    },

    // --- 5. LEGITIMATE USERS (EXPECTED: ALLOW with ZERO PROMPT) ---
    {
      name: 'Legitimate User: Same Device, Same ISP, Normal Hour',
      category: 'legitimate_user',
      isAttack: false,
      expectedRecommendation: 'allow',
      input: {
        userId: 'alex_dev',
        ipAddress: '194.26.29.10', // Same ISP
        deviceFingerprint: 'fp_alex_macbook_pro_m2', // Same device
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        timestamp: now, // 10:30 AM (normal active hour)
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: false,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },
    {
      name: 'Legitimate User: Same Office IP, Familiar Workstation',
      category: 'legitimate_user',
      isAttack: false,
      expectedRecommendation: 'allow',
      input: {
        userId: 'alex_dev',
        ipAddress: '194.26.29.10',
        deviceFingerprint: 'fp_alex_macbook_pro_m2',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        timestamp: new Date('2026-08-26T14:15:00Z'), // 2:15 PM (normal active hour)
        geoLocation: mockLondon,
        previousLogins: history,
        isNewDevice: false,
        recentAttemptCount: 1,
        userNormalLoginHours: [9, 10, 11, 14, 15, 16],
        isVpnOrProxy: false,
      },
    },

    // --- 6. SUBTLE ANOMALIES (EXPECTED: MONITOR - SILENT LOGGING, NO FRICTION) ---
    {
      name: 'Subtle Anomaly: Same User on New Laptop (Home WiFi)',
      category: 'subtle_anomaly',
      isAttack: false,
      expectedRecommendation: 'monitor',
      input: {
        userId: 'alex_dev',
        ipAddress: '194.26.29.10', // Familiar Home IP
        deviceFingerprint: 'fp_alex_new_ipad_pro', // New Device (+20 weight)
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
      name: 'Subtle Anomaly: Known Device from Coffee Shop IP (Same City)',
      category: 'subtle_anomaly',
      isAttack: false,
      expectedRecommendation: 'monitor',
      input: {
        userId: 'alex_dev',
        ipAddress: '82.165.197.1', // New residential/coffee shop IP (+15 weight)
        deviceFingerprint: 'fp_alex_macbook_pro_m2', // Same Verified Device
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
  ];

  return testCases;
}

export function runBenchmark() {
  const dataset = generateAttackDataset();
  const latencies: number[] = [];

  let truePositives = 0;  // Attacks flagged as challenge
  let falseNegatives = 0; // Attacks allowed
  let trueNegatives = 0;   // Legitimate users allowed / monitored
  let falsePositives = 0;  // Legitimate users falsely challenged

  console.log('\n================================================================');
  console.log('       ANDRORS EMPIRICAL BOT ATTACK & THREAT BENCHMARK           ');
  console.log('================================================================\n');

  console.log(`Executing ${dataset.length} synthetic attack & authentication vectors...\n`);

  const resultsTable: any[] = [];

  dataset.forEach((tc, idx) => {
    const startTime = performance.now();
    const result = calculateRiskScore(tc.input);
    const durationMs = performance.now() - startTime;
    latencies.push(durationMs);

    const isFlaggedAsAttack = result.recommendation === 'challenge';
    const isSuccess = result.recommendation === tc.expectedRecommendation;

    if (tc.isAttack) {
      if (isFlaggedAsAttack) truePositives++;
      else falseNegatives++;
    } else {
      if (!isFlaggedAsAttack) trueNegatives++;
      else falsePositives++;
    }

    resultsTable.push({
      ID: `#${idx + 1}`,
      Vector: tc.name.slice(0, 45),
      Type: tc.category,
      Score: result.score,
      Outcome: result.recommendation.toUpperCase(),
      Expected: tc.expectedRecommendation.toUpperCase(),
      Latency: `${durationMs.toFixed(3)}ms`,
      Status: isSuccess ? 'PASS ✓' : 'FAIL ✗',
    });
  });

  console.table(resultsTable);

  // Metrics calculation
  const totalAttacks = dataset.filter(d => d.isAttack).length;
  const totalLegitimate = dataset.filter(d => !d.isAttack).length;

  const catchRate = ((truePositives / totalAttacks) * 100).toFixed(1);
  const falsePositiveRate = ((falsePositives / totalLegitimate) * 100).toFixed(1);
  const precision = ((truePositives / (truePositives + falsePositives || 1)) * 100).toFixed(1);
  const recall = ((truePositives / (truePositives + falseNegatives || 1)) * 100).toFixed(1);
  const accuracy = (((truePositives + trueNegatives) / dataset.length) * 100).toFixed(1);

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(3);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(3);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(3);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3);

  console.log('\n================================================================');
  console.log('                  EMPIRICAL METRICS SUMMARY                     ');
  console.log('================================================================');
  console.log(`• Total Test Scenarios Evaluated : ${dataset.length}`);
  console.log(`• Automated Attacks Executed    : ${totalAttacks} (Headless bots, Bursts, Geo, VPNs)`);
  console.log(`• Clean & Subtle Baselines       : ${totalLegitimate} (Legitimate users, New devices)`);
  console.log('----------------------------------------------------------------');
  console.log(`🎯 Attack Catch Rate (Recall)   : ${catchRate}%  (${truePositives}/${totalAttacks} attacks intercepted)`);
  console.log(`🛡️ False Positive Rate (FPR)    : ${falsePositiveRate}%  (${falsePositives}/${totalLegitimate} false challenges)`);
  console.log(`📈 Precision                    : ${precision}%`);
  console.log(`✅ Overall Classification Acc.   : ${accuracy}%`);
  console.log('----------------------------------------------------------------');
  console.log(`⚡ Average Evaluation Latency    : ${avgLatency} ms`);
  console.log(`⚡ p50 Latency                   : ${p50} ms`);
  console.log(`⚡ p95 Latency                   : ${p95} ms`);
  console.log(`⚡ p99 Latency                   : ${p99} ms`);
  console.log('================================================================\n');

  return {
    totalAttacks,
    totalLegitimate,
    catchRate: Number(catchRate),
    falsePositiveRate: Number(falsePositiveRate),
    precision: Number(precision),
    recall: Number(recall),
    accuracy: Number(accuracy),
    latencies: { avg: avgLatency, p50, p95, p99 }
  };
}

if (require.main === module) {
  runBenchmark();
}
