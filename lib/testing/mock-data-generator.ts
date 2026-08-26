/**
 * Mock Data Generator for Testing
 * Generate realistic login patterns for testing the risk scorer
 */

import { LoginAttempt, GeographicLocation } from '../database/supabase-client';

export interface MockUser {
  userId: string;
  normalIps: string[];
  normalDevices: string[];
  normalLocation: GeographicLocation;
  normalLoginHours: number[];
}

/**
 * Generate a mock user with typical behavior patterns
 */
export function generateMockUser(userId: string): MockUser {
  return {
    userId,
    normalIps: [
      '192.168.1.100',
      '192.168.1.101',
      '10.0.0.50',
    ],
    normalDevices: [
      'home_laptop_abc123',
      'work_desktop_xyz789',
      'mobile_phone_def456',
    ],
    normalLocation: {
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
      country: 'United States',
    },
    normalLoginHours: [8, 9, 10, 14, 15, 16, 17], // 8am-5pm workday
  };
}

/**
 * Generate normal login attempt
 */
export function generateNormalLogin(user: MockUser): Partial<LoginAttempt> {
  const randomIp = user.normalIps[Math.floor(Math.random() * user.normalIps.length)];
  const randomDevice = user.normalDevices[Math.floor(Math.random() * user.normalDevices.length)];
  const randomHour = user.normalLoginHours[Math.floor(Math.random() * user.normalLoginHours.length)];
  
  const timestamp = new Date();
  timestamp.setHours(randomHour, Math.floor(Math.random() * 60), 0, 0);

  return {
    user_id: user.userId,
    ip_address: randomIp,
    device_fingerprint: randomDevice,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    timestamp: timestamp.toISOString(),
    geographic_location: user.normalLocation,
    risk_score: 0,
    recommendation: 'allow',
    factors: [],
  };
}

/**
 * Generate suspicious login (new device)
 */
export function generateNewDeviceLogin(user: MockUser): Partial<LoginAttempt> {
  const login = generateNormalLogin(user);
  return {
    ...login,
    device_fingerprint: 'new_unknown_device_hash',
  };
}

/**
 * Generate suspicious login (new IP)
 */
export function generateNewIpLogin(user: MockUser): Partial<LoginAttempt> {
  const login = generateNormalLogin(user);
  return {
    ...login,
    ip_address: '203.0.113.99', // New IP
  };
}

/**
 * Generate bot-like login
 */
export function generateBotLogin(user: MockUser): Partial<LoginAttempt> {
  const login = generateNormalLogin(user);
  return {
    ...login,
    user_agent: 'HeadlessChrome/91.0.4472.124',
  };
}

/**
 * Generate VPN login
 */
export function generateVpnLogin(user: MockUser): Partial<LoginAttempt> {
  const login = generateNormalLogin(user);
  return {
    ...login,
    ip_address: '185.220.100.240', // Example VPN IP
  };
}

/**
 * Generate geographic impossibility
 */
export function generateGeoImpossibleLogin(user: MockUser, minutesAgo: number = 30): Partial<LoginAttempt> {
  const login = generateNormalLogin(user);
  
  const timestamp = new Date();
  timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);
  
  return {
    ...login,
    timestamp: timestamp.toISOString(),
    geographic_location: {
      latitude: 51.5074,
      longitude: -0.1278,
      city: 'London',
      country: 'United Kingdom',
    },
  };
}

/**
 * Generate time anomaly login (3am when user normally logs in during day)
 */
export function generateTimeAnomalyLogin(user: MockUser): Partial<LoginAttempt> {
  const login = generateNormalLogin(user);
  
  const timestamp = new Date();
  timestamp.setHours(3, 0, 0, 0); // 3 AM
  
  return {
    ...login,
    timestamp: timestamp.toISOString(),
  };
}

/**
 * Generate batch of historical logins
 */
export function generateLoginHistory(user: MockUser, count: number = 10): LoginAttempt[] {
  const logins: LoginAttempt[] = [];
  
  for (let i = 0; i < count; i++) {
    const login = generateNormalLogin(user);
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - Math.floor(Math.random() * 30)); // Last 30 days
    
    logins.push({
      id: `mock_${i}`,
      user_id: user.userId,
      ip_address: login.ip_address!,
      device_fingerprint: login.device_fingerprint!,
      user_agent: login.user_agent!,
      timestamp: timestamp.toISOString(),
      geographic_location: login.geographic_location!,
      risk_score: 0,
      recommendation: 'allow',
      factors: [],
      created_at: timestamp.toISOString(),
    });
  }
  
  return logins.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Generate test scenarios
 */
export function generateTestScenarios(userId: string) {
  const user = generateMockUser(userId);
  
  return {
    user,
    scenarios: {
      normal: generateNormalLogin(user),
      newDevice: generateNewDeviceLogin(user),
      newIp: generateNewIpLogin(user),
      bot: generateBotLogin(user),
      vpn: generateVpnLogin(user),
      geoImpossible: generateGeoImpossibleLogin(user),
      timeAnomaly: generateTimeAnomalyLogin(user),
    },
    history: generateLoginHistory(user, 10),
  };
}

/**
 * Random IP generator
 */
export function generateRandomIp(): string {
  return Array.from({ length: 4 }, () => 
    Math.floor(Math.random() * 256)
  ).join('.');
}

/**
 * Random device fingerprint generator
 */
export function generateRandomDeviceFingerprint(): string {
  const chars = 'abcdef0123456789';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

/**
 * Generate user agents for different browsers
 */
export const userAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
  bot: 'HeadlessChrome/91.0.4472.124',
  curl: 'curl/7.68.0',
};

/**
 * Print test scenario for debugging
 */
export function printTestScenario(scenario: ReturnType<typeof generateTestScenarios>) {
  console.log('=== Test Scenario ===');
  console.log('User ID:', scenario.user.userId);
  console.log('Normal IPs:', scenario.user.normalIps);
  console.log('Normal Devices:', scenario.user.normalDevices);
  console.log('Normal Login Hours:', scenario.user.normalLoginHours);
  console.log('\n=== Scenarios ===');
  Object.entries(scenario.scenarios).forEach(([name, data]) => {
    console.log(`\n${name}:`);
    console.log('  IP:', data.ip_address);
    console.log('  Device:', data.device_fingerprint);
    console.log('  User Agent:', data.user_agent?.substring(0, 50) + '...');
  });
  console.log('\n=== History Count ===', scenario.history.length);
}
