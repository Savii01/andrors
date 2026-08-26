/**
 * Resilient Multi-Layer Device Identification & Fingerprinting Engine
 * Specially hardened for iOS, Safari Anti-Fingerprinting Protection, and Mobile Browsers.
 */

export interface DeviceInfo {
  // Core Platform
  browser: string;
  os: string;
  isIOS: boolean;
  isSafari: boolean;
  isMobile: boolean;

  // Display & Hardware Profile
  screenResolution: string;
  pixelRatio: number;
  colorDepth: number;
  colorGamut: string; // p3 | srgb | rec2020
  hdrSupport: boolean;
  touchPoints: number;
  hardwareConcurrency: number;
  deviceMemory?: number;

  // Temporal & Regional
  timezone: string;
  timezoneOffset: number;
  language: string;
  languages: string[];
  platform: string;

  // WebKit & Audio Entropy
  audioFingerprint?: string;
  webglRenderer?: string;
  canvasFingerprint?: string;
  hasApplePay: boolean;
  isStandalone: boolean;

  // Persistent Token
  persistedDeviceId: string;
}

const STORAGE_KEY = 'andrors_device_id';
const COOKIE_KEY = 'andrors_did';

/**
 * Generate a resilient device fingerprint that does not break on iOS/Safari
 */
export async function generateDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Device fingerprinting must run in browser environment');
  }

  const info = await collectDeviceInfo();
  return hashDeviceInfo(info);
}

/**
 * Collect all stable device signals with Safari noise isolation
 */
export async function collectDeviceInfo(): Promise<DeviceInfo> {
  if (typeof window === 'undefined') {
    return getFallbackDeviceInfo();
  }

  const nav = window.navigator;
  const screen = window.screen;
  const ua = nav.userAgent || '';

  const isIOS = /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  const isMobile = isIOS || /Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // Persistent device ID token (resilient across tabs & sessions)
  const persistedDeviceId = getOrSetPersistedDeviceId();

  // Color Gamut detection (Stable on Apple P3 displays)
  let colorGamut = 'srgb';
  if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
    colorGamut = 'p3';
  } else if (window.matchMedia && window.matchMedia('(color-gamut: rec2020)').matches) {
    colorGamut = 'rec2020';
  }

  // HDR / Dynamic Range
  const hdrSupport = !!(window.matchMedia && window.matchMedia('(dynamic-range: high)').matches);

  // Audio Context Entropy (Stable on iOS Web Audio API)
  let audioFingerprint: string | undefined;
  try {
    audioFingerprint = await getAudioFingerprint();
  } catch {
    audioFingerprint = 'audio-unavailable';
  }

  // WebGL & Canvas (With Safari noise handling)
  const webglRenderer = getWebGLRendererInfo();
  
  // On iOS Safari, standard canvas is randomized/poisoned by WebKit.
  // We only include deterministic canvas attributes on Safari or stable canvas on other browsers.
  let canvasFingerprint: string | undefined;
  if (!isIOS && !isSafari) {
    canvasFingerprint = getCanvasFingerprint();
  } else {
    // Safari-safe low-entropy canvas measurement (text metric bounding box)
    canvasFingerprint = getSafariResilientCanvasMetric();
  }

  const date = new Date();

  return {
    browser: detectBrowser(ua),
    os: detectOS(ua, nav.platform),
    isIOS,
    isSafari,
    isMobile,
    screenResolution: `${screen.width}x${screen.height}`,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth || 24,
    colorGamut,
    hdrSupport,
    touchPoints: nav.maxTouchPoints || 0,
    hardwareConcurrency: nav.hardwareConcurrency || 4,
    deviceMemory: (nav as any).deviceMemory,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    timezoneOffset: date.getTimezoneOffset(),
    language: nav.language || 'en',
    languages: Array.from(nav.languages || [nav.language || 'en']),
    platform: nav.platform || 'unknown',
    audioFingerprint,
    webglRenderer,
    canvasFingerprint,
    hasApplePay: typeof (window as any).ApplePaySession !== 'undefined',
    isStandalone: !!((nav as any).standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)),
    persistedDeviceId,
  };
}

/**
 * Enhanced fingerprint combining persistent token and stable hardware vectors
 */
export async function generateEnhancedFingerprint(): Promise<string> {
  return generateDeviceFingerprint();
}

/**
 * Generate or retrieve persistent self-healing device token
 */
export function getOrSetPersistedDeviceId(): string {
  if (typeof window === 'undefined') return 'server_render_placeholder';

  let token: string | null = null;

  // 1. Try LocalStorage
  try {
    token = localStorage.getItem(STORAGE_KEY);
  } catch {}

  // 2. Try Cookie if LocalStorage was cleared
  if (!token) {
    token = getCookie(COOKIE_KEY);
  }

  // 3. Try SessionStorage
  if (!token) {
    try {
      token = sessionStorage.getItem(STORAGE_KEY);
    } catch {}
  }

  // If no token exists, generate a new cryptographic device UUID
  if (!token || !token.startsWith('andrors_did_')) {
    token = `andrors_did_${generateUUID()}`;
  }

  // Self-heal across all storage vectors
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {}
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {}
  setCookie(COOKIE_KEY, token, 365); // 1 year expiry

  return token;
}

/**
 * Audio Context Hardware Fingerprint
 * WebKit / Safari provides stable audio synthesizer rendering characteristics
 */
async function getAudioFingerprint(): Promise<string> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return 'no-audio-api';

  try {
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

    gain.gain.value = 0; // Mute
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);

    const baseData = `${context.sampleRate}_${context.destination.maxChannelCount}_${context.state}`;
    context.close();
    return baseData;
  } catch {
    return 'audio-error';
  }
}

/**
 * Safari-Safe Canvas Text Metrics
 * Measures font metrics without pixel buffer dumping to avoid Safari anti-fingerprint noise
 */
function getSafariResilientCanvasMetric(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const metrics1 = ctx.measureText('Andrors Auth 🔒 12345');
    
    ctx.font = '24px "Times New Roman", Times, serif';
    const metrics2 = ctx.measureText('Security Evaluation Matrix');

    return `${metrics1.width.toFixed(2)}_${metrics2.width.toFixed(2)}`;
  } catch {
    return 'safari-metric-error';
  }
}

/**
 * Standard Canvas Fingerprinting (For Chrome/Firefox/Edge)
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Andrors Identity 🔒', 2, 15);

    const dataUrl = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  } catch {
    return 'canvas-error';
  }
}

/**
 * WebGL GPU information
 */
function getWebGLRendererInfo(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';

    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'webgl-basic';

    const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'generic-vendor';
    const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'generic-renderer';

    return `${vendor}|${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

/**
 * Browser detection
 */
function detectBrowser(ua: string): string {
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera';
  return 'Unknown';
}

/**
 * OS detection
 */
function detectOS(ua: string, platform: string): string {
  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

/**
 * Hash device info into stable deterministic string
 */
async function hashDeviceInfo(info: DeviceInfo): Promise<string> {
  // Exclude volatile properties before hashing
  const stablePayload = {
    persistedDeviceId: info.persistedDeviceId,
    os: info.os,
    screenResolution: info.screenResolution,
    pixelRatio: info.pixelRatio,
    colorGamut: info.colorGamut,
    touchPoints: info.touchPoints,
    timezone: info.timezone,
    timezoneOffset: info.timezoneOffset,
    language: info.language,
    audioFingerprint: info.audioFingerprint,
    webglRenderer: info.webglRenderer,
    hasApplePay: info.hasApplePay,
  };

  const str = JSON.stringify(stablePayload, Object.keys(stablePayload).sort());
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function setCookie(name: string, value: string, days: number): void {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function getFallbackDeviceInfo(): DeviceInfo {
  return {
    browser: 'Unknown',
    os: 'Unknown',
    isIOS: false,
    isSafari: false,
    isMobile: false,
    screenResolution: '1920x1080',
    pixelRatio: 1,
    colorDepth: 24,
    colorGamut: 'srgb',
    hdrSupport: false,
    touchPoints: 0,
    hardwareConcurrency: 4,
    timezone: 'UTC',
    timezoneOffset: 0,
    language: 'en',
    languages: ['en'],
    platform: 'unknown',
    hasApplePay: false,
    isStandalone: false,
    persistedDeviceId: 'server_fallback',
  };
}

export function getSimpleFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  const token = getOrSetPersistedDeviceId();
  return token.replace('andrors_did_', '').slice(0, 16);
}
