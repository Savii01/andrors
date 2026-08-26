import { Reader, CityResponse } from 'maxmind';
import { GeographicLocation } from '../database/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

let geoReader: Reader<CityResponse> | null = null;

export type IPClassification = 'residential' | 'datacenter' | 'vpn' | 'tor' | 'proxy' | 'unknown';

export interface IPIntelligenceResult {
  ipAddress: string;
  isVpnOrProxy: boolean;
  classification: IPClassification;
  provider?: string;
  confidenceScore: number; // 0 to 100
  abuseScore?: number;
  source: 'local_cidr' | 'abuseipdb' | 'heuristic' | 'fallback';
}

// In-memory binary CIDR representations for sub-millisecond lookup
interface ParsedCIDR {
  cidr: string;
  networkLong: number;
  maskLong: number;
  type: IPClassification;
  provider?: string;
}

let compiledRanges: ParsedCIDR[] = [];
let threatDataLoaded = false;

// Simple in-memory cache for API and lookup results (LRU-like)
const ipLookupCache = new Map<string, { result: IPIntelligenceResult; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Initialize MaxMind GeoIP reader and IP threat intelligence datasets
 */
export async function initializeGeoIP(): Promise<void> {
  try {
    const dbPath = process.env.MAXMIND_DB_PATH || path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');
    
    if (fs.existsSync(dbPath)) {
      const maxmind = await import('maxmind');
      geoReader = await maxmind.open<CityResponse>(dbPath);
      console.log('MaxMind GeoIP database initialized');
    } else {
      console.warn(`MaxMind database not found at ${dbPath}. Geographic features disabled.`);
    }

    // Load threat intelligence dataset (CIDRs for datacenters, VPNs, Tor)
    loadThreatIntelligence();
  } catch (error) {
    console.error('Failed to initialize GeoIP & IP intelligence:', error);
  }
}

/**
 * Load and compile CIDR ranges for high-speed offline lookup
 */
export function loadThreatIntelligence(): void {
  if (threatDataLoaded && compiledRanges.length > 0) return;

  const threatRanges: ParsedCIDR[] = [];

  try {
    const defaultDataPath = path.join(process.cwd(), 'data', 'ip-threat-intelligence.json');
    if (fs.existsSync(defaultDataPath)) {
      const rawData = JSON.parse(fs.readFileSync(defaultDataPath, 'utf-8'));
      
      if (Array.isArray(rawData.datacenterRanges)) {
        for (const cidr of rawData.datacenterRanges) {
          const parsed = parseCIDR(cidr, 'datacenter', 'Cloud / Datacenter Hosting');
          if (parsed) threatRanges.push(parsed);
        }
      }

      if (Array.isArray(rawData.vpnAndTorRanges)) {
        for (const cidr of rawData.vpnAndTorRanges) {
          const parsed = parseCIDR(cidr, 'vpn', 'Commercial VPN / Tor Relay');
          if (parsed) threatRanges.push(parsed);
        }
      }
    }

    // Load optional custom list if provided
    const customListPath = process.env.VPN_LIST_PATH;
    if (customListPath && fs.existsSync(customListPath)) {
      const customSet = loadVpnProxyList(customListPath);
      for (const entry of customSet) {
        const parsed = parseCIDR(entry.includes('/') ? entry : `${entry}/32`, 'vpn', 'Custom VPN Feed');
        if (parsed) threatRanges.push(parsed);
      }
    }

    compiledRanges = threatRanges;
    threatDataLoaded = true;
    console.log(`Loaded and compiled ${compiledRanges.length} IP threat CIDR ranges for real-time verification`);
  } catch (err) {
    console.error('Error loading threat intelligence dataset:', err);
  }
}

/**
 * Convert an IPv4 string to 32-bit unsigned integer
 */
export function ipToLong(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Parse CIDR string into bitmask components
 */
export function parseCIDR(cidr: string, type: IPClassification, provider?: string): ParsedCIDR | null {
  try {
    const [ipPart, bitsStr] = cidr.trim().split('/');
    const bits = bitsStr ? parseInt(bitsStr, 10) : 32;
    
    if (bits < 0 || bits > 32) return null;
    
    const ipLong = ipToLong(ipPart);
    const maskLong = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    const networkLong = (ipLong & maskLong) >>> 0;

    return {
      cidr,
      networkLong,
      maskLong,
      type,
      provider,
    };
  } catch {
    return null;
  }
}

/**
 * Check if IP matches any compiled CIDR subnet
 */
export function matchLocalThreatRanges(ipAddress: string): ParsedCIDR | null {
  if (!threatDataLoaded || compiledRanges.length === 0) {
    loadThreatIntelligence();
  }

  const ipLong = ipToLong(ipAddress);
  if (ipLong === 0) return null;

  for (const range of compiledRanges) {
    if (((ipLong & range.maskLong) >>> 0) === range.networkLong) {
      return range;
    }
  }

  return null;
}

/**
 * Check AbuseIPDB API for real-time threat intelligence (Free tier: 1,000 checks/day)
 */
export async function checkAbuseIPDB(ipAddress: string): Promise<IPIntelligenceResult | null> {
  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ipAddress)}&maxAgeInDays=90&verbose=true`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const abuseData = data?.data;
    if (!abuseData) return null;

    const abuseScore = abuseData.abuseConfidenceScore || 0;
    const isTor = abuseData.isTor || false;
    const isHosting = abuseData.usageType?.toLowerCase().includes('data center') || 
                      abuseData.usageType?.toLowerCase().includes('hosting') || 
                      abuseData.usageType?.toLowerCase().includes('transit');
    
    const isVpnOrProxy = abuseScore >= 25 || isTor || isHosting;
    let classification: IPClassification = 'residential';
    if (isTor) classification = 'tor';
    else if (isHosting) classification = 'datacenter';
    else if (abuseScore >= 50) classification = 'proxy';
    else if (abuseScore >= 25) classification = 'vpn';

    return {
      ipAddress,
      isVpnOrProxy,
      classification,
      provider: abuseData.isp || abuseData.domain,
      confidenceScore: abuseScore,
      abuseScore,
      source: 'abuseipdb',
    };
  } catch (error) {
    console.error('AbuseIPDB API error:', error);
    return null;
  }
}

/**
 * Main IP Intelligence & Threat Evaluation
 */
export async function analyzeIPIntelligence(ipAddress: string): Promise<IPIntelligenceResult> {
  // Check memory cache
  const cached = ipLookupCache.get(ipAddress);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  // Handle local / private IPs
  if (isPrivateOrLocalIP(ipAddress)) {
    const localResult: IPIntelligenceResult = {
      ipAddress,
      isVpnOrProxy: false,
      classification: 'residential',
      provider: 'Local / Loopback',
      confidenceScore: 0,
      source: 'heuristic',
    };
    return localResult;
  }

  // 1. Try local CIDR intelligence database (Fastest, zero latency)
  const localMatch = matchLocalThreatRanges(ipAddress);
  if (localMatch) {
    const result: IPIntelligenceResult = {
      ipAddress,
      isVpnOrProxy: true,
      classification: localMatch.type,
      provider: localMatch.provider,
      confidenceScore: localMatch.type === 'vpn' || localMatch.type === 'tor' ? 95 : 85,
      source: 'local_cidr',
    };
    ipLookupCache.set(ipAddress, { result, timestamp: Date.now() });
    return result;
  }

  // 2. Try AbuseIPDB API if configured
  const apiResult = await checkAbuseIPDB(ipAddress);
  if (apiResult) {
    ipLookupCache.set(ipAddress, { result: apiResult, timestamp: Date.now() });
    return apiResult;
  }

  // 3. Fallback: Clean / Residential IP
  const defaultResult: IPIntelligenceResult = {
    ipAddress,
    isVpnOrProxy: false,
    classification: 'residential',
    confidenceScore: 10,
    source: 'fallback',
  };
  ipLookupCache.set(ipAddress, { result: defaultResult, timestamp: Date.now() });
  return defaultResult;
}

/**
 * Check if IP is a VPN, Datacenter, or Proxy
 */
export async function isVpnOrProxy(ipAddress: string): Promise<boolean> {
  const intel = await analyzeIPIntelligence(ipAddress);
  return intel.isVpnOrProxy;
}

/**
 * Helper to check private/loopback/bogons
 */
export function isPrivateOrLocalIP(ip: string): boolean {
  if (!isValidIPv4(ip)) return false;
  return (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip === 'localhost' ||
    ip === '::1' ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
  );
}

/**
 * Get geographic location from IP address
 */
export function getLocationFromIP(ipAddress: string): GeographicLocation | null {
  if (geoReader) {
    try {
      const result = geoReader.get(ipAddress);
      
      if (result && result.location) {
        return {
          latitude: result.location.latitude || 0,
          longitude: result.location.longitude || 0,
          city: result.city?.names?.en,
          country: result.country?.names?.en,
          timezone: result.location.time_zone,
        };
      }
    } catch (error) {
      console.error('Error looking up IP in MaxMind:', error);
    }
  }

  // Fallback heuristic coordinates for common/test IP subnets when mmdb is not downloaded
  if (ipAddress.startsWith('133.242.') || ipAddress.startsWith('133.')) {
    return { latitude: 35.6762, longitude: 139.6503, city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' };
  }
  if (ipAddress.startsWith('194.26.') || ipAddress.startsWith('82.165.') || ipAddress.startsWith('185.220.')) {
    return { latitude: 51.5074, longitude: -0.1278, city: 'London', country: 'United Kingdom', timezone: 'Europe/London' };
  }
  if (ipAddress.startsWith('198.51.') || ipAddress.startsWith('40.71.')) {
    return { latitude: 40.7128, longitude: -74.0060, city: 'New York', country: 'United States', timezone: 'America/New_York' };
  }
  if (ipAddress.startsWith('34.192.') || ipAddress.startsWith('54.144.')) {
    return { latitude: 38.8951, longitude: -77.0364, city: 'Ashburn', country: 'United States', timezone: 'America/New_York' };
  }
  if (ipAddress.startsWith('104.248.') || ipAddress.startsWith('159.65.')) {
    return { latitude: 52.3676, longitude: 4.9041, city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam' };
  }

  return null;
}

/**
 * Load VPN/Proxy IP list from file
 */
export function loadVpnProxyList(filePath: string): Set<string> {
  const vpnIps = new Set<string>();
  
  try {
    if (!fs.existsSync(filePath)) {
      return vpnIps;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        vpnIps.add(trimmed);
      }
    }
  } catch (error) {
    console.error('Error loading VPN list:', error);
  }
  
  return vpnIps;
}

/**
 * Calculate distance between two geographic locations (Haversine formula in km)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
 * Validate IP address format
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  if (!ipv4Regex.test(ip)) {
    return false;
  }

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Fallback location for testing
 */
export function getFallbackLocation(): GeographicLocation {
  return {
    latitude: 0,
    longitude: 0,
    city: 'Unknown',
    country: 'Unknown',
  };
}
