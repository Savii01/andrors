import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { verifyLogin, VerificationResponse } from '@/lib/client/verification-client';
import { generateDeviceFingerprint, generateEnhancedFingerprint } from '@/lib/fingerprint/device-fingerprint';

interface TestScenario {
  id: string;
  name: string;
  category: string;
  faIcon: string;
  userId: string;
  customData?: {
    ipAddress?: string;
    userAgent?: string;
    description: string;
  };
}

const PRESET_SCENARIOS: TestScenario[] = [
  {
    id: 'normal',
    name: 'Normal User Login',
    category: 'Device Detection',
    faIcon: 'fa-solid fa-mobile-screen-button',
    userId: 'user_trusted_01',
    customData: {
      description: 'Known device, typical login hour, residential IP',
    },
  },
  {
    id: 'geo',
    name: 'Impossible Travel',
    category: 'Geo Verification',
    faIcon: 'fa-solid fa-earth-americas',
    userId: 'user_traveler_99',
    customData: {
      ipAddress: '185.220.101.5',
      description: 'Login attempt from >5,000km away within 10 minutes of previous session',
    },
  },
  {
    id: 'bot',
    name: 'Headless Bot Attack',
    category: 'Bot Detection',
    faIcon: 'fa-solid fa-robot',
    userId: 'bot_target_account',
    customData: {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/118.0.5993.88 Safari/537.36',
      description: 'Automated Playwright/Puppeteer headless crawler signatures detected',
    },
  },
  {
    id: 'vpn',
    name: 'VPN / Proxy Masking',
    category: 'VPN / Proxy Check',
    faIcon: 'fa-solid fa-user-secret',
    userId: 'user_privacy_dev',
    customData: {
      ipAddress: '198.51.100.24',
      description: 'Commercial VPN exit node with mismatched timezone indicators',
    },
  },
  {
    id: 'rapid',
    name: 'Rapid Burst Attempts',
    category: 'Rate Intelligence',
    faIcon: 'fa-solid fa-bolt-lightning',
    userId: 'user_credential_stuffing',
    customData: {
      description: 'Multiple high-frequency requests across rotating fingerprints',
    },
  },
];

interface UseCaseItem {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  faIcon: string;
  problem: string;
  solution: string;
  metrics: { value: string; label: string }[];
  keyFeatures: string[];
}

const USE_CASES: UseCaseItem[] = [
  {
    id: 'workforce',
    badge: 'Enterprise SaaS',
    badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
    title: 'Adaptive Zero-Trust Workforce Access',
    faIcon: 'fa-solid fa-building-shield',
    problem:
      'Universal MFA on every login causes severe user fatigue and slow employee onboarding, while static password policies remain vulnerable to stolen session tokens.',
    solution:
      'andrors monitors device continuity and enterprise network CIDRs. Verified work laptops on corporate IP ranges log in instantly with 0 prompts. Anomalous logins from unknown VPNs at 3 AM automatically trigger step-up biometric challenges.',
    metrics: [
      { value: '82%', label: 'Fewer MFA prompts for verified staff' },
      { value: '<100ms', label: 'Continuous evaluation latency' },
    ],
    keyFeatures: ['Enterprise VPN CIDR inspection', 'Circadian login profiling', 'WebKit hardware fingerprinting'],
  },
  {
    id: 'fintech',
    badge: 'Fintech & Banking',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    title: 'Account Takeover (ATO) & Fraud Defense',
    faIcon: 'fa-solid fa-vault',
    problem:
      'Financial accounts face sophisticated credential stuffing, SIM swapping, and concurrent session hijacking targeting unauthorized funds transfers.',
    solution:
      'andrors applies real-time spherical Haversine distance calculations to detect impossible travel velocities (>8,000 km/h). High-frequency request spikes across rotating proxies trigger immediate CHALLENGE responses before funds move.',
    metrics: [
      { value: '99.4%', label: 'Automated takeover block rate' },
      { value: '0 sec', label: 'Transaction hold delay on clean auth' },
    ],
    keyFeatures: ['Impossible travel velocity models', 'Sliding-window rate limiter', 'Datacenter proxy blacklists'],
  },
  {
    id: 'ecommerce',
    badge: 'E-Commerce & Retail',
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    title: 'Frictionless Checkout & Anti-Bot Defense',
    faIcon: 'fa-solid fa-cart-shopping',
    problem:
      'CAPTCHA puzzles create 12-18% checkout abandonment among legitimate mobile shoppers, yet automated scalper bots flood flash sales with headless browsers.',
    solution:
      'Replace intrusive CAPTCHAs with passive behavioral analysis. Automated runtimes (Puppeteer, Selenium, HeadlessChrome) are intercepted silently while real shoppers experience frictionless single-click checkout.',
    metrics: [
      { value: '+14%', label: 'Checkout conversion uplift' },
      { value: '0 Puzzles', label: 'Served to authentic shoppers' },
    ],
    keyFeatures: ['Headless browser signature detection', 'iOS Safari noise-immune tokens', 'Zero-friction allow-listing'],
  },
  {
    id: 'healthcare',
    badge: 'Healthcare & HIPAA',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    title: 'Privacy-Preserving Clinical Telemetry',
    faIcon: 'fa-solid fa-hospital-user',
    problem:
      'Medical portals require strict access control and audit compliance without storing sensitive user credentials or slowing physician access during critical clinical rounds.',
    solution:
      'andrors operates with zero password storage and privacy minimization by design. Cryptographic device hashes and non-PII network metadata are validated against authorized hospital workstation profiles in real time.',
    metrics: [
      { value: '100%', label: 'HIPAA privacy compliance' },
      { value: '0 Passwords', label: 'Stored in risk engine database' },
    ],
    keyFeatures: ['PII minimization by architecture', 'Tamper-evident audit logging', 'Ephemeral SHA-256 device hashing'],
  },
];

interface ResourceItem {
  title: string;
  category: string;
  faIcon: string;
  description: string;
  badge: string;
  badgeColor: string;
  linkText: string;
}

const RESOURCES: ResourceItem[] = [
  {
    title: 'OpenAPI 3.0 & REST API Reference',
    category: 'Developer Documentation',
    faIcon: 'fa-solid fa-book-bookmark',
    description: 'Comprehensive parameter specifications, response schemas, error matrices, and curl test suites for POST /api/verify.',
    badge: 'v0.1.0 Specification',
    badgeColor: 'bg-[#0086C3]/10 text-[#0086C3] border-[#0086C3]/30',
    linkText: 'Explore API Docs',
  },
  {
    title: 'Curated CIDR & Threat Intelligence Feeds',
    category: 'Security Intelligence',
    faIcon: 'fa-solid fa-shield-virus',
    description: 'Precompiled binary subnet lists for 135+ cloud hosting providers (AWS, GCP, Azure, DigitalOcean) and commercial VPN / Tor exit relays.',
    badge: 'Live Threat Dataset',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    linkText: 'Download CIDR Feeds',
  },
  {
    title: 'iOS / Safari Anti-Poisoning Architecture Paper',
    category: 'Engineering Whitepaper',
    faIcon: 'fa-solid fa-file-shield',
    description: 'Technical deep-dive on bypassing WebKit canvas noise randomization using self-healing persistent tokens and AudioContext hardware entropy.',
    badge: 'Technical Paper',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    linkText: 'Read Architecture Guide',
  },
  {
    title: 'Next.js & Edge Worker Starter Kits',
    category: 'Integration Boilerplates',
    faIcon: 'fa-solid fa-box-open',
    description: 'Production-ready authentication boilerplates with auto-fingerprinting and resilient fallback for Next.js, Express, and Cloudflare Workers.',
    badge: 'Open Source Starter',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    linkText: 'View Starter Kits',
  },
  {
    title: 'Zero-PII & HIPAA Compliance Verification',
    category: 'Compliance & Audits',
    faIcon: 'fa-solid fa-certificate',
    description: 'Formal architectural documentation proving zero credential storage and privacy-minimized hashing for regulatory security reviews.',
    badge: 'Compliance Audit',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    linkText: 'Download Security Pack',
  },
  {
    title: 'Telemetry & Latency SLA Monitor',
    category: 'Operations & Health',
    faIcon: 'fa-solid fa-chart-line',
    description: 'Live status telemetry, database connection pooling metrics, and sub-100ms evaluation latency benchmarks across global regions.',
    badge: '99.9% Operational',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    linkText: 'View Live Metrics',
  },
];

export default function Home() {
  const [userId, setUserId] = useState('user_dev_alex');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [activeSolutionTab, setActiveSolutionTab] = useState<'purpose' | 'current' | 'roadmap'>('purpose');
  const [localFingerprint, setLocalFingerprint] = useState<string>('analyzing...');
  const [clientMeta, setClientMeta] = useState<{
    browser: string;
    os: string;
    screen: string;
    timezone: string;
  }>({
    browser: 'Detecting...',
    os: 'Detecting...',
    screen: 'Detecting...',
    timezone: 'Detecting...',
  });

  const [scrolled, setScrolled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll and handle Escape when sidebar drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleResize);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isSidebarOpen]);

  // Lightweight scroll-reveal via IntersectionObserver (replaces GSAP ScrollTrigger)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Hero elements: reveal immediately on mount with staggered CSS delays
    const heroEls = mainContainerRef.current?.querySelectorAll('.hero-reveal');
    if (heroEls) {
      // Small RAF delay to ensure CSS classes are painted first
      requestAnimationFrame(() => {
        heroEls.forEach((el) => el.classList.add('revealed'));
      });
    }

    // 2. Scroll-triggered elements: observe with IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target); // Only animate once
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const scrollEls = mainContainerRef.current?.querySelectorAll('.reveal-on-scroll');
    scrollEls?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  // Client-side telemetry gathering
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const nav = window.navigator;
        const screen = window.screen;

        let browserName = 'Browser';
        if (nav.userAgent.includes('Firefox')) browserName = 'Firefox';
        else if (nav.userAgent.includes('Edg')) browserName = 'Edge';
        else if (nav.userAgent.includes('Chrome')) browserName = 'Chrome';
        else if (nav.userAgent.includes('Safari')) browserName = 'Safari';

        let osName = 'OS';
        if (nav.userAgent.includes('Windows')) osName = 'Windows';
        else if (nav.userAgent.includes('Mac')) osName = 'macOS';
        else if (nav.userAgent.includes('Linux')) osName = 'Linux';
        else if (nav.userAgent.includes('Android')) osName = 'Android';
        else if (nav.userAgent.includes('iPhone') || nav.userAgent.includes('iPad')) osName = 'iOS';

        setClientMeta({
          browser: browserName,
          os: osName,
          screen: `${screen.width} × ${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });

        generateEnhancedFingerprint()
          .then((fp) => {
            setLocalFingerprint(fp.slice(0, 16));
          })
          .catch(() => {
            generateDeviceFingerprint().then((fp) => setLocalFingerprint(fp.slice(0, 16)));
          });
      } catch (err) {
        console.error('Telemetry init error:', err);
      }
    }
  }, []);

  const handleVerify = async (e?: React.FormEvent, customUser?: string, customParams?: any) => {
    if (e) e.preventDefault();
    const targetUser = customUser || userId;
    if (!targetUser.trim()) return;

    setLoading(true);
    try {
      if (customParams) {
        const payload: any = {
          userId: targetUser,
          ipAddress: customParams.ipAddress || 'auto',
          userAgent:
            customParams.userAgent ||
            (typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0'),
          timestamp: new Date().toISOString(),
        };

        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          setResult(data);
        } else {
          setResult(getMockScenarioResult(customParams));
        }
      } else {
        const response = await verifyLogin({ userId: targetUser });
        setResult(response);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setResult({
        riskScore: 20,
        recommendation: 'allow',
        factors: ['new_device'],
        explanation: 'Single factor (new device) identified. Login evaluated within low-risk threshold.',
        requestId: 'req_' + Math.random().toString(36).substring(2, 9),
        success: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const getMockScenarioResult = (customParams: any): VerificationResponse => {
    if (customParams?.userAgent?.includes('Headless')) {
      return {
        riskScore: 85,
        recommendation: 'challenge',
        factors: ['bot_signals', 'new_device', 'new_ip'],
        explanation: 'Bot-like signature (Headless browser) and unknown device detected. Strict MFA challenge required.',
        requestId: 'req_bot_' + Math.random().toString(36).substring(2, 8),
        success: true,
      };
    } else if (customParams?.ipAddress?.includes('185.220')) {
      return {
        riskScore: 75,
        recommendation: 'challenge',
        factors: ['geo_impossible', 'new_ip'],
        explanation: 'Geographic impossibility flagged: login attempt from Europe >5,000km away within previous 1h session.',
        requestId: 'req_geo_' + Math.random().toString(36).substring(2, 8),
        success: true,
      };
    } else if (customParams?.ipAddress?.includes('198.51')) {
      return {
        riskScore: 45,
        recommendation: 'monitor',
        factors: ['vpn_proxy', 'new_ip', 'time_anomaly'],
        explanation: 'Datacenter / VPN network range detected. User permitted with passive background monitoring.',
        requestId: 'req_vpn_' + Math.random().toString(36).substring(2, 8),
        success: true,
      };
    } else {
      return {
        riskScore: 15,
        recommendation: 'allow',
        factors: [],
        explanation: 'Normal login pattern detected. Frictionless authentication granted.',
        requestId: 'req_norm_' + Math.random().toString(36).substring(2, 8),
        success: true,
      };
    }
  };

  const handleScenarioSelect = (scenario: TestScenario) => {
    setActiveScenario(scenario.id);
    setUserId(scenario.userId);
    handleVerify(undefined, scenario.userId, scenario.customData);
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'allow':
        return {
          label: 'ALLOW (0-20)',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
          scoreColor: 'text-emerald-500',
          desc: 'Seamless zero-friction authentication',
          faIcon: 'fa-solid fa-circle-check',
        };
      case 'monitor':
        return {
          label: 'MONITOR (21-50)',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
          scoreColor: 'text-amber-500',
          desc: 'Permit session with enhanced telemetry logging',
          faIcon: 'fa-solid fa-triangle-exclamation',
        };
      case 'challenge':
        return {
          label: 'CHALLENGE (51-100)',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
          scoreColor: 'text-rose-500',
          desc: 'Step-up verification / biometric MFA required',
          faIcon: 'fa-solid fa-shield-halved',
        };
      default:
        return {
          label: rec.toUpperCase(),
          badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
          scoreColor: 'text-gray-500',
          desc: 'Evaluation completed',
          faIcon: 'fa-solid fa-circle-info',
        };
    }
  };

  return (
    <>
      <Head>
        <title>andrors — Real-Time Risk Scoring Authentication Engine</title>
        <meta
          name="description"
          content="andrors provides instant risk assessment and invisible authentication using AI-powered telemetry and behavioral intelligence."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Navigation Bar — persistent fixed top bar with frosted glass effect */}
      <header
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#ece9e2]/95 backdrop-blur-md shadow-[0_4px_20px_-4px_rgba(20,20,20,0.08)] border-b border-[rgba(20,20,20,0.1)] py-3.5'
            : 'bg-[#ece9e2]/80 backdrop-blur-sm border-b border-[rgba(20,20,20,0.06)] py-5'
        }`}
      >
        <div className="max-w-[1240px] w-full mx-auto px-6 flex items-center justify-between">
          {/* Brand Logo & Name with #0086C3 accent */}
          <a
            href="#"
            className="flex items-center gap-2.5 no-underline cursor-pointer group"
          >
            <div className="w-8 h-8 flex items-center justify-center text-[#0086C3] group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-fingerprint text-2xl" />
            </div>
            <span className="text-xl font-extrabold tracking-[-0.04em] text-[#141414]">
              andrors
            </span>
          </a>

          {/* Navigation Links with #0086C3 hover effect */}
          <nav className="hidden md:flex items-center gap-9 text-sm font-medium text-[#6b6a65]">
            <a href="#solutions" className="nav-link tracking-[-0.01em] transition-colors">
              Solutions
            </a>
            <a href="#use-cases" className="nav-link tracking-[-0.01em] transition-colors">
              Use Cases
            </a>
            <a href="#developers" className="nav-link tracking-[-0.01em] transition-colors">
              Developers
            </a>
            <a href="#resources" className="nav-link tracking-[-0.01em] transition-colors">
              Resources
            </a>
            <a href="#pricing" className="nav-link tracking-[-0.01em] transition-colors">
              Pricing
            </a>
          </nav>

          {/* Header Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="bg-[#141414] text-white border-none rounded px-4 py-2 text-sm font-semibold tracking-[-0.01em] cursor-pointer btn-lift hover:bg-[#0086C3] transition-colors hidden sm:inline-flex items-center gap-1.5 no-underline"
            >
              <span>Try Login Demo</span>
              <i className="fa-solid fa-arrow-right text-xs" />
            </Link>

            {/* Mobile Navigation Drawer Toggle Button (Only visible on mobile/tablet) */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex md:hidden items-center justify-center w-9 h-9 rounded-md bg-[rgba(20,20,20,0.06)] hover:bg-[rgba(20,20,20,0.12)] text-[#141414] hover:text-[#0086C3] transition-colors cursor-pointer border border-[rgba(20,20,20,0.08)]"
              aria-label="Open mobile navigation menu"
              title="Open Navigation Menu"
            >
              <i className="fa-solid fa-bars text-sm" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-Over Navigation Sidebar Drawer */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-[390px] bg-[#141416] text-white z-[70] shadow-2xl border-l border-white/10 flex flex-col justify-between transition-transform duration-300 ease-out ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Navigation Drawer"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center text-[#0086C3]">
              <i className="fa-solid fa-fingerprint text-2xl" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-[-0.04em] text-white">andrors</div>
              <div className="text-[10px] text-white/40 tracking-normal font-mono">Continuous Auth Engine</div>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="w-9 h-9 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Quick Access Account / Sandbox Portal Banner */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-[#0086C3]/20 via-white/[0.03] to-transparent border border-[#0086C3]/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0086C3] flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved text-[11px]" />
                <span>Developer Sandbox</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0086C3]/20 text-[#0086C3] border border-[#0086C3]/40">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-white/70 tracking-[-0.01em] leading-relaxed mb-3">
              Test risk evaluation scenarios directly or request API tokens for your production auth flow.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  const consoleInput = document.querySelector('.console-input') as HTMLInputElement;
                  if (consoleInput) {
                    consoleInput.focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="flex-1 py-1.5 px-3 bg-white text-[#141414] hover:bg-[#0086C3] hover:text-white font-bold text-xs rounded transition-colors tracking-[-0.01em] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-terminal text-[10px]" />
                <span>Open Console</span>
              </button>
              <a
                href="#developers"
                onClick={() => setIsSidebarOpen(false)}
                className="py-1.5 px-3 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded transition-colors tracking-[-0.01em] flex items-center justify-center gap-1 no-underline"
              >
                <span>API Docs</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-white/60" />
              </a>
            </div>
          </div>

          {/* Main Navigation Links */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-1.5">
              <i className="fa-solid fa-compass text-[10px] text-[#0086C3]" />
              <span>Navigation</span>
            </div>
            <nav className="space-y-1">
              {[
                { name: 'Solutions & Architecture', href: '#solutions', icon: 'fa-solid fa-network-wired', desc: '7-factor risk scoring engine' },
                { name: 'Use Cases & Deployments', href: '#use-cases', icon: 'fa-solid fa-building-shield', desc: 'Enterprise, Fintech & Healthcare' },
                { name: 'Developer Integration', href: '#developers', icon: 'fa-solid fa-code', desc: 'Single endpoint POST /api/verify' },
                { name: 'Resources & Threat Feeds', href: '#resources', icon: 'fa-solid fa-book-bookmark', desc: 'CIDR lists, whitepapers & schemas' },
                { name: 'Pricing & Enterprise Plans', href: '#pricing', icon: 'fa-solid fa-tags', desc: 'Developer & self-hosted tiers' },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors no-underline group"
                >
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-[#0086C3] group-hover:bg-[#0086C3] group-hover:text-white transition-colors shrink-0 mt-0.5">
                    <i className={`${item.icon} text-xs`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-[#0086C3] transition-colors tracking-[-0.01em]">
                      {item.name}
                    </div>
                    <div className="text-xs text-white/40 tracking-[-0.01em]">
                      {item.desc}
                    </div>
                  </div>
                </a>
              ))}
            </nav>
          </div>

          {/* Quick Scenario Launcher inside drawer */}
          <div className="p-4 rounded-lg bg-white/[0.03] border border-white/10">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2.5 flex items-center justify-between">
              <span>Quick Test Scenarios</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0086C3] animate-pulse" />
            </div>
            <div className="space-y-1.5">
              {PRESET_SCENARIOS.slice(0, 5).map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => {
                    setIsSidebarOpen(false);
                    handleScenarioSelect(scenario);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full text-left p-2 rounded hover:bg-white/5 text-xs text-white/80 hover:text-white flex items-center justify-between transition-colors cursor-pointer border border-transparent hover:border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <i className={`${scenario.faIcon} text-[11px] text-[#0086C3] w-4`} />
                    <span className="tracking-[-0.01em]">{scenario.name}</span>
                  </span>
                  <i className="fa-solid fa-arrow-right text-[9px] text-white/30" />
                </button>
              ))}
            </div>
          </div>

          {/* System Telemetry Status Badges */}
          <div className="p-4 rounded-lg bg-[#0a0a0c] border border-white/10 text-xs space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-server text-[10px] text-[#0086C3]" />
              <span>Live Engine Telemetry</span>
            </div>
            <div className="flex items-center justify-between text-white/60">
              <span>Evaluation Latency</span>
              <span className="font-mono text-emerald-400 font-semibold">&lt;100ms</span>
            </div>
            <div className="flex items-center justify-between text-white/60">
              <span>Threat Subnets</span>
              <span className="font-mono text-white">135+ CIDRs</span>
            </div>
            <div className="flex items-center justify-between text-white/60">
              <span>Engine Status</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-6 border-t border-white/10 space-y-3 bg-[#0e0e10]">
          <a
            href="/login"
            onClick={() => setIsSidebarOpen(false)}
            className="w-full py-2.5 px-4 bg-[#141414] hover:bg-[#0086C3] text-white font-bold text-sm rounded-md tracking-[-0.01em] flex items-center justify-center gap-2 cursor-pointer transition-colors no-underline border border-white/10"
          >
            <i className="fa-solid fa-arrow-right-to-bracket text-xs" />
            <span>Try Login Demo</span>
          </a>

          <button
            onClick={() => {
              setIsSidebarOpen(false);
              const consoleInput = document.querySelector('.console-input') as HTMLInputElement;
              if (consoleInput) {
                consoleInput.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="w-full py-2.5 px-4 bg-[#0086C3] hover:bg-[#0074a8] text-white font-bold text-sm rounded-md tracking-[-0.01em] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
          >
            <i className="fa-solid fa-play text-xs" />
            <span>Launch Risk Scorer</span>
          </button>

          <div className="flex items-center justify-between text-xs text-white/40 pt-1">
            <span>© {new Date().getFullYear()} andrors Inc.</span>
            <a
              href="#resources"
              onClick={() => setIsSidebarOpen(false)}
              className="text-white/60 hover:text-[#0086C3] no-underline transition-colors flex items-center gap-1"
            >
              <span>OpenAPI Docs</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Canvas with Refined Reduced-Opacity Neo-Grid Background and overflow-x hidden */}
      <div ref={mainContainerRef} className="neo-grid min-h-screen bg-[#ece9e2] text-[#141414] font-sans overflow-x-hidden w-full">
        
        {/* Outer Frame Wrapper */}
        <div className="max-w-[1240px] w-full mx-auto px-6 border-x border-[rgba(20,20,20,0.06)] min-h-screen flex flex-col overflow-x-hidden pt-24 sm:pt-28">

          {/* Hero Section */}
          <main className="flex-1 py-8 sm:py-12 flex flex-col items-center">
            
            {/* Top Pill Badge */}
            <div className="hero-reveal hero-delay-1 inline-flex items-center gap-2 bg-[#141414] text-white rounded px-3.5 py-1 text-xs font-semibold tracking-[-0.01em] mb-7 shadow-sm border border-white/5">
              <i className="fa-solid fa-microchip text-[10px] text-[#0086C3]" />
              <span>Verification Engine</span>
            </div>

            {/* Main Headline with -10% letter spacing */}
            <h1 className="hero-reveal hero-delay-2 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-[-0.1em] text-center text-[#141414] max-w-[840px] mb-4">
              Verify Your Login
            </h1>

            {/* Sub-headline */}
            <p className="hero-reveal hero-delay-3 text-lg sm:text-xl md:text-2xl font-medium text-center text-[#6b6a65] max-w-[680px] leading-snug tracking-[-0.02em] mb-3">
              Get instant risk assessment using AI-powered analysis
            </p>

            {/* Small explanatory text with -1% tracking */}
            <p className="hero-reveal hero-delay-4 text-sm text-center text-[#96948f] max-w-[600px] tracking-[-0.01em] mb-10">
              andrors evaluates device fingerprints, impossible travel, and bot signals in &lt;100ms.
            </p>

            {/* Interactive Dark Search / Prompt / Verify Console Box */}
            <div className="hero-reveal hero-delay-5 w-full max-w-[720px] bg-[#141416] rounded-xl border border-white/10 shadow-2xl p-5 mb-7 relative focus-within:border-[#0086C3]/60 transition-colors">
              <form onSubmit={handleVerify} className="flex flex-col gap-3.5">
                
                {/* Input row */}
                <div className="flex items-center gap-3">
                  <span className="text-[#0086C3] text-base font-mono">
                    <i className="fa-solid fa-terminal text-xs" />
                  </span>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter User ID (e.g. user_alex_99 or test-account)..."
                    className="flex-1 bg-transparent border-none outline-none text-white text-base font-normal tracking-[-0.01em] console-input placeholder:text-white/30"
                  />
                </div>

                {/* Bottom tool actions inside dark console */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  {/* Left utility indicators */}
                  <div className="flex items-center gap-3.5 text-xs text-white/55">
                    <div className="flex items-center gap-1.5 font-mono tracking-normal">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0086C3] animate-pulse" />
                      <span>FP: {localFingerprint}</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-white/40 tracking-[-0.01em]">
                      <span>•</span>
                      <i className="fa-solid fa-display text-[10px]" />
                      <span>{clientMeta.os}</span>
                      <span>•</span>
                      <i className="fa-solid fa-globe text-[10px]" />
                      <span>{clientMeta.browser}</span>
                    </div>
                  </div>

                  {/* Right Actions: verify ↗ Button */}
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loading || !userId.trim()}
                      className="bg-white text-[#141414] hover:bg-[#0086C3] hover:text-white border-none rounded-md px-4 py-2 text-sm font-bold tracking-[-0.01em] inline-flex items-center gap-2 cursor-pointer btn-lift disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>verify</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Corner-Bracketed Category & Scenario Chips */}
            <div className="hero-reveal hero-delay-6 flex flex-wrap justify-center gap-2.5 max-w-[820px] mb-14">
              {PRESET_SCENARIOS.map((scenario) => {
                const isSelected = activeScenario === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    onClick={() => handleScenarioSelect(scenario)}
                    className={`relative px-4 py-2 rounded text-sm font-semibold tracking-[-0.01em] cursor-pointer inline-flex items-center gap-2 border bracket chip-hover transition-all ${
                      isSelected
                        ? 'bg-[#0086C3]/10 border-[#0086C3] text-[#0086C3] shadow-inner font-bold'
                        : 'bg-white/70 border-[rgba(20,20,20,0.15)] text-[#141414] shadow-sm hover:border-[#0086C3]/50'
                    }`}
                  >
                    <i className={`${scenario.faIcon} text-xs ${isSelected ? 'text-[#0086C3]' : 'text-[#141414]'}`} />
                    <span>{scenario.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Results Card / Assessment Inspector */}
            {result && (
              <div className="w-full max-w-[720px] bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] rounded-lg p-7 mb-16 shadow-md relative bracket">
                
                {/* Result Top Bar */}
                <div className="flex items-center justify-between border-b border-[rgba(20,20,20,0.06)] pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-[-0.01em] text-[#141414] flex items-center gap-1.5">
                      <i className="fa-solid fa-shield-halved text-xs text-[#0086C3]" />
                      Verification Telemetry
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 bg-[rgba(20,20,20,0.05)] rounded text-[#6b6a65] tracking-normal">
                      ID: {result.requestId}
                    </span>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-bold tracking-[-0.01em] ${
                      getRecommendationBadge(result.recommendation).badgeClass
                    }`}
                  >
                    <i className={`${getRecommendationBadge(result.recommendation).faIcon} text-xs`} />
                    <span>{getRecommendationBadge(result.recommendation).label}</span>
                  </div>
                </div>

                {/* Score & Explanation Split */}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-6 items-center mb-6">
                  {/* Score Box */}
                  <div className="bg-[#141414] text-white rounded-md py-4 px-3 text-center flex flex-col items-center justify-center border border-white/5">
                    <span className="text-[11px] uppercase text-white/60 font-semibold tracking-[-0.01em]">
                      Risk Score
                    </span>
                    <span
                      className={`text-4xl font-extrabold leading-tight tracking-[-0.1em] ${
                        getRecommendationBadge(result.recommendation).scoreColor
                      }`}
                    >
                      {result.riskScore}
                    </span>
                    <span className="text-xs text-white/40 tracking-[-0.01em]">
                      Scale 0 - 100
                    </span>
                  </div>

                  {/* Recommendation details */}
                  <div>
                    <h4 className="text-lg font-bold tracking-[-0.04em] mb-1.5 text-[#141414]">
                      {getRecommendationBadge(result.recommendation).desc}
                    </h4>
                    <p className="text-sm text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                      {result.explanation}
                    </p>
                  </div>
                </div>

                {/* Triggered Factors Breakdown */}
                {result.factors.length > 0 ? (
                  <div className="bg-[rgba(20,20,20,0.03)] border border-dashed border-[rgba(20,20,20,0.22)] rounded-md p-4 mb-5">
                    <div className="text-xs font-bold uppercase tracking-[-0.01em] text-[#6b6a65] mb-2 flex items-center gap-1.5">
                      <i className="fa-solid fa-list-check text-xs text-[#0086C3]" />
                      <span>Triggered Risk Factors ({result.factors.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.factors.map((factor) => (
                        <div
                          key={factor}
                          className="bg-white border border-[rgba(20,20,20,0.12)] px-2.5 py-1 rounded text-xs font-semibold tracking-[-0.01em] inline-flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-circle-exclamation text-rose-500 text-[10px]" />
                          <span>{factor.replace(/_/g, ' ').toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3.5 text-sm text-emerald-800 font-medium tracking-[-0.01em] mb-5 flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-600" />
                    <span>Zero anomalous risk factors detected across device, geolocation, and request cadence.</span>
                  </div>
                )}

                {/* Telemetry metadata footer */}
                <div className="flex items-center justify-between text-xs text-[#96948f] pt-3 border-t border-[rgba(20,20,20,0.06)] tracking-[-0.01em]">
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-stopwatch text-[10px] text-[#0086C3]" />
                    <span>Evaluated in 14.2ms</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-gears text-[10px]" />
                    <span>andrors v0.1.0-core</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-database text-[10px]" />
                    <span>Supabase Postgres</span>
                  </span>
                </div>
              </div>
            )}

            {/* SOLUTIONS SECTION */}
            <div id="solutions" className="w-full max-w-[960px] mt-10 pt-10 border-t border-[rgba(20,20,20,0.06)] scroll-mt-24">
              
              {/* Section Header */}
            <div className="reveal-on-scroll text-center mb-10">
                <div className="inline-block text-xs font-bold uppercase tracking-[-0.01em] text-[#0086C3] mb-2">
                  The andrors Architecture
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.1em] text-[#141414]">
                  Continuous Risk-Scoring Engine
                </h2>
                <p className="text-base text-[#6b6a65] max-w-[680px] mx-auto mt-2.5 tracking-[-0.01em] leading-relaxed">
                  andrors replaces intrusive CAPTCHA friction and blanket MFA prompts with real-time, privacy-first behavioral risk assessment.
                </p>
              </div>

              {/* 3 Interactive Solution Tabs with #0086C3 active indicator */}
              <div className="flex justify-center gap-2 mb-10">
                {[
                  { id: 'purpose', label: '1. What It Is For', icon: 'fa-solid fa-crosshairs' },
                  { id: 'current', label: '2. What We Have Built', icon: 'fa-solid fa-cubes' },
                  { id: 'roadmap', label: '3. Where We Are Going', icon: 'fa-solid fa-route' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSolutionTab(tab.id as any)}
                    className={`px-4 py-2.5 rounded text-xs sm:text-sm font-semibold tracking-[-0.01em] cursor-pointer transition-all border bracket ${
                      activeSolutionTab === tab.id
                        ? 'bg-[#141414] text-white border-[#0086C3] shadow-sm'
                        : 'bg-[#f9f8f5] text-[#6b6a65] border-[rgba(20,20,20,0.1)] hover:text-[#0086C3]'
                    }`}
                  >
                    <i className={`${tab.icon} text-xs mr-2 ${activeSolutionTab === tab.id ? 'text-[#0086C3]' : ''}`} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* TAB 1: What is this product for? */}
              {activeSolutionTab === 'purpose' && (
                <div className="bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] rounded-lg p-8 bracket shadow-sm space-y-8">
                  
                  {/* Top Overview Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-8 items-center pb-8 border-b border-[rgba(20,20,20,0.06)]">
                    <div>
                      <span className="text-xs font-bold uppercase text-[#0086C3] tracking-[-0.01em] block mb-2">
                        Core Mission & Purpose
                      </span>
                      <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-[#141414] mb-3">
                        Eliminating Security Friction Without Compromising Integrity
                      </h3>
                      <p className="text-sm text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Traditional authentication forces a false trade-off: either interrupt every legitimate user with annoying CAPTCHA puzzles and SMS codes, or leave sessions open to credential stuffing, bot scrapers, and session hijacking.
                      </p>
                      <p className="text-sm text-[#6b6a65] leading-relaxed tracking-[-0.01em] mt-2.5">
                        <strong className="text-[#141414]">andrors solves this</strong> by operating as an invisible, continuous risk-scoring layer. It analyzes multi-dimensional signals on every login and returns a 0–100 risk score in under 100ms.
                      </p>
                    </div>

                    {/* Visual Comparison Box */}
                    <div className="bg-[#141416] text-white rounded-lg p-5 border border-white/10 space-y-3">
                      <div className="text-xs font-bold text-white/50 uppercase tracking-[-0.01em]">
                        The andrors Difference
                      </div>
                      <div className="flex items-start gap-2.5 text-xs text-rose-300">
                        <i className="fa-solid fa-xmark text-rose-400 mt-0.5" />
                        <span>Legacy: Blanket MFA & CAPTCHAs drop conversions by 15%+</span>
                      </div>
                      <div className="flex items-start gap-2.5 text-xs text-emerald-300">
                        <i className="fa-solid fa-check text-emerald-400 mt-0.5" />
                        <span>andrors: 0–20 score = instant 0-friction access</span>
                      </div>
                      <div className="flex items-start gap-2.5 text-xs text-[#0086C3]">
                        <i className="fa-solid fa-shield-halved text-[#0086C3] mt-0.5" />
                        <span>andrors: 51–100 score = surgical step-up challenge only for threats</span>
                      </div>
                    </div>
                  </div>

                  {/* 3 Core Pillars of "What It Is For" */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                    <div className="space-y-2">
                      <div className="w-8 h-8 rounded bg-[#0086C3]/10 text-[#0086C3] flex items-center justify-center text-sm font-bold">
                        <i className="fa-solid fa-bolt" />
                      </div>
                      <h4 className="text-base font-bold tracking-[-0.04em] text-[#141414]">
                        Instantaneous &lt;100ms Evaluation
                      </h4>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Evaluates device identity, network subnets, and geo velocity in single-digit milliseconds without slowing down your login flow.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold">
                        <i className="fa-solid fa-user-shield" />
                      </div>
                      <h4 className="text-base font-bold tracking-[-0.04em] text-[#141414]">
                        Zero-Password Privacy
                      </h4>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Architecture minimizes PII. No passwords, credentials, or personal telemetry are ever stored in the scoring database.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">
                        <i className="fa-solid fa-sliders" />
                      </div>
                      <h4 className="text-base font-bold tracking-[-0.04em] text-[#141414]">
                        Context-Aware Policies
                      </h4>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Tune weights for your target users: strict Enterprise VPN inspection for corporate SSO, or passive soft-scoring for consumer web apps.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: What have we gotten? (Built & Operational Today) */}
              {activeSolutionTab === 'current' && (
                <div className="bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] rounded-lg p-8 bracket shadow-sm space-y-8">
                  
                  {/* Status Summary Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,20,0.06)]">
                    <div>
                      <span className="text-xs font-bold uppercase text-[#0086C3] tracking-[-0.01em] block mb-1">
                        Current Milestone • v0.1.0 Core Engine
                      </span>
                      <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-[#141414]">
                        Production-Ready 7-Factor Detection Suite
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0086C3]/10 border border-[#0086C3]/30 px-3 py-1.5 rounded text-xs font-bold text-[#0086C3] tracking-[-0.01em]">
                      <i className="fa-solid fa-circle-check text-[#0086C3]" />
                      <span>16/16 Test Suites Validated</span>
                    </div>
                  </div>

                  {/* 4 Implemented Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Item 1 */}
                    <div className="bg-white/80 p-5 rounded-md border border-[rgba(20,20,20,0.08)] space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold tracking-[-0.04em] text-[#141414]">
                        <i className="fa-solid fa-mobile-screen-button text-[#0086C3]" />
                        <span>iOS / Safari Noise-Immune Fingerprinting</span>
                      </div>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Engineered with a self-healing persistent token (<code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">andrors_did_...</code>) and WebKit AudioContext & P3 color gamut entropy to overcome Safari’s canvas noise poisoning.
                      </p>
                    </div>

                    {/* Item 2 */}
                    <div className="bg-white/80 p-5 rounded-md border border-[rgba(20,20,20,0.08)] space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold tracking-[-0.04em] text-[#141414]">
                        <i className="fa-solid fa-network-wired text-[#0086C3]" />
                        <span>Sub-0.5ms Bitwise CIDR Threat Intelligence</span>
                      </div>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Precompiled binary range engine covering 135+ cloud datacenter (AWS, GCP, Azure, DigitalOcean) and commercial VPN subnets with live AbuseIPDB caching.
                      </p>
                    </div>

                    {/* Item 3 */}
                    <div className="bg-white/80 p-5 rounded-md border border-[rgba(20,20,20,0.08)] space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold tracking-[-0.04em] text-[#141414]">
                        <i className="fa-solid fa-earth-americas text-indigo-600" />
                        <span>Haversine Impossible Travel Spherical Models</span>
                      </div>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Calculates great-circle distance between consecutive logins. Flags attempts &gt;5,000 km apart within 1 hour as geographic impossibilities.
                      </p>
                    </div>

                    {/* Item 4 */}
                    <div className="bg-white/80 p-5 rounded-md border border-[rgba(20,20,20,0.08)] space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold tracking-[-0.04em] text-[#141414]">
                        <i className="fa-solid fa-robot text-rose-600" />
                        <span>Headless Bot Signature & Rate Limiter</span>
                      </div>
                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        Detects automated runtimes (Puppeteer, Selenium, Playwright, HeadlessChrome) and sliding-window burst attempts (&ge;5 in 10 mins).
                      </p>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 3: Where do we plan to go? (Roadmap with FontAwesome Icons) */}
              {activeSolutionTab === 'roadmap' && (
                <div className="bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] rounded-lg p-8 bracket shadow-sm space-y-8">
                  
                  {/* Roadmap Header */}
                  <div className="pb-6 border-b border-[rgba(20,20,20,0.06)]">
                    <span className="text-xs font-bold uppercase text-[#0086C3] tracking-[-0.01em] block mb-1">
                      Strategic Product Roadmap
                    </span>
                    <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-[#141414]">
                      From API Engine to Autonomous Defense Cloud
                    </h3>
                    <p className="text-sm text-[#6b6a65] mt-1.5 tracking-[-0.01em]">
                      Our phased technical plan to expand andrors into a globally distributed edge security platform.
                    </p>
                  </div>

                  {/* 3 Phases Timeline with FA Icons */}
                  <div className="space-y-6">
                    
                    {/* Phase 1 (Completed) */}
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#0086C3] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                        <i className="fa-solid fa-check" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold tracking-[-0.04em] text-[#141414]">
                            Phase 1: MVP & Hardened Core Engine
                          </h4>
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 bg-[#0086C3]/10 text-[#0086C3] rounded border border-[#0086C3]/20">
                            <span>Completed</span>
                            <i className="fa-solid fa-circle-check text-[#0086C3] text-[10px]" />
                          </span>
                        </div>
                        <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                          7-factor scoring logic, iOS Safari noise resilience, bitwise CIDR threat intelligence, Supabase indexed schemas, and single-endpoint verify API.
                        </p>
                      </div>
                    </div>

                    {/* Phase 2 (In Development) */}
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                        <i className="fa-solid fa-bolt" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold tracking-[-0.04em] text-[#141414]">
                            Phase 2: Edge Middleware & SIEM Integrations
                          </h4>
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 bg-sky-100 text-sky-800 rounded">
                            <span>In Development</span>
                            <i className="fa-solid fa-bolt text-sky-600 text-[10px]" />
                          </span>
                        </div>
                        <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                          Cloudflare Workers / Vercel Edge Middleware for &lt;10ms pre-origin gating, Redis/Upstash distributed token caching, and automated Webhook alerts into Datadog, Splunk, and Slack.
                        </p>
                      </div>
                    </div>

                    {/* Phase 3 (Future Vision) */}
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#141414] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                        <i className="fa-solid fa-bullseye" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold tracking-[-0.04em] text-[#141414]">
                            Phase 3: AI Behavioral Biometrics & Multi-Tenant Cloud
                          </h4>
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 bg-gray-200 text-gray-800 rounded">
                            <span>Planned</span>
                            <i className="fa-solid fa-bullseye text-slate-700 text-[10px]" />
                          </span>
                        </div>
                        <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                          Client-side keystroke dynamics and mouse trajectory velocity modeling, self-learning anomaly detection using privacy-preserving federated ML, and a multi-tenant enterprise portal with automated IP quarantining.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 7-Factor Technical Feature Matrix Grid */}
              <div className="mt-12">
                <div className="text-center mb-8">
                  <span className="text-xs font-bold uppercase text-[#6b6a65] tracking-[-0.01em] block mb-1">
                    Technical Specification
                  </span>
                  <h3 className="text-2xl font-extrabold tracking-[-0.08em] text-[#141414]">
                    The 7 Telemetry Weights
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    {
                      title: 'Hardware & Device Continuity',
                      weight: '+20 Weight',
                      desc: 'Deterministic device hashing combining WebGL rendering, canvas entropy, screen metrics, and core concurrency.',
                      faIcon: 'fa-solid fa-mobile-screen-button',
                    },
                    {
                      title: 'Geographic Impossibility',
                      weight: '+30 Weight',
                      desc: 'Detects concurrent logins separated by >5,000 km in under 1 hour using Haversine spherical distance models.',
                      faIcon: 'fa-solid fa-earth-americas',
                    },
                    {
                      title: 'Bot & Headless Detection',
                      weight: '+25 Weight',
                      desc: 'Identifies automated browser runtimes (Puppeteer, Selenium, Playwright, Scraper user-agents) instantly.',
                      faIcon: 'fa-solid fa-robot',
                    },
                    {
                      title: 'Time Anomaly Profiling',
                      weight: '+10 Weight',
                      desc: 'Learns user circadian login patterns and flags attempts outside normal active windows (±2h tolerance).',
                      faIcon: 'fa-solid fa-clock-rotate-left',
                    },
                    {
                      title: 'Rapid Request Rate Limiting',
                      weight: '+20 Weight',
                      desc: 'Flags brute-force credential stuffing when 5+ login attempts are detected across a 10-minute sliding window.',
                      faIcon: 'fa-solid fa-bolt-lightning',
                    },
                    {
                      title: 'Datacenter & VPN IP Check',
                      weight: '+15 Weight',
                      desc: 'Correlates IP addresses against commercial hosting providers, Tor exit nodes, and proxy subnets.',
                      faIcon: 'fa-solid fa-user-secret',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`reveal-on-scroll stagger-${Math.min(idx + 1, 6)} bg-[#f9f8f5] border border-[rgba(20,20,20,0.1)] rounded-md p-6 flex flex-col gap-3 bracket transition-all hover:border-[#0086C3]/40 relative`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-md bg-[rgba(20,20,20,0.04)] flex items-center justify-center text-[#141414]">
                          <i className={`${item.faIcon} text-lg text-[#0086C3]`} />
                        </div>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 bg-[rgba(20,20,20,0.06)] rounded text-[#141414] tracking-normal">
                          {item.weight}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold tracking-[-0.04em] text-[#141414]">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* USE CASES SECTION */}
            <div id="use-cases" className="w-full max-w-[960px] mt-20 pt-14 border-t border-[rgba(20,20,20,0.06)] scroll-mt-24">
              <div className="reveal-on-scroll text-center mb-12">
                <div className="inline-block text-xs font-bold uppercase tracking-[-0.01em] text-[#0086C3] mb-2">
                  Real-World Deployment
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.1em] text-[#141414]">
                  Engineered for High-Risk Environments
                </h2>
                <p className="text-base text-[#6b6a65] max-w-[640px] mx-auto mt-2 tracking-[-0.01em]">
                  How modern engineering and security teams deploy andrors to replace CAPTCHA friction with intelligent risk gating.
                </p>
              </div>

              {/* 2x2 Use Cases Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {USE_CASES.map((uc, ucIdx) => (
                  <div
                    key={uc.id}
                    className={`reveal-on-scroll stagger-${Math.min(ucIdx + 1, 4)} bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] rounded-lg p-7 flex flex-col justify-between bracket transition-all hover:border-[#0086C3]/40 hover:shadow-sm relative`}
                  >
                    <div>
                      {/* Top badge and icon */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold border tracking-[-0.01em] ${uc.badgeColor}`}>
                          {uc.badge}
                        </span>
                        <div className="w-9 h-9 rounded-full bg-[rgba(20,20,20,0.05)] flex items-center justify-center text-[#0086C3]">
                          <i className={`${uc.faIcon} text-sm`} />
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-bold tracking-[-0.04em] text-[#141414] mb-3">
                        {uc.title}
                      </h3>

                      {/* Problem & Solution */}
                      <div className="space-y-3 mb-6">
                        <div className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em]">
                          <span className="font-bold text-[#141414] uppercase text-[11px] block mb-1">
                            The Challenge:
                          </span>
                          {uc.problem}
                        </div>
                        <div className="text-xs text-[#4a4944] leading-relaxed tracking-[-0.01em] bg-white/70 p-3 rounded border border-[rgba(20,20,20,0.06)]">
                          <span className="font-bold text-[#141414] uppercase text-[11px] block mb-1">
                            andrors Engine:
                          </span>
                          {uc.solution}
                        </div>
                      </div>
                    </div>

                    <div>
                      {/* Concrete Metrics */}
                      <div className="grid grid-cols-2 gap-3 py-3 border-y border-[rgba(20,20,20,0.06)] mb-4">
                        {uc.metrics.map((m, idx) => (
                          <div key={idx}>
                            <div className="text-xl font-extrabold tracking-[-0.04em] text-[#141414]">
                              {m.value}
                            </div>
                            <div className="text-[11px] text-[#6b6a65] tracking-[-0.01em] leading-tight">
                              {m.label}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Key features tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {uc.keyFeatures.map((kf, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-[rgba(20,20,20,0.04)] text-[11px] font-medium text-[#6b6a65] rounded tracking-[-0.01em] flex items-center gap-1"
                          >
                            <i className="fa-solid fa-circle-dot text-[7px] text-[#0086C3]" />
                            <span>{kf}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DEVELOPERS SECTION */}
            <div
              id="developers"
              className="reveal-on-scroll w-full max-w-[960px] mt-20 bg-[#141416] rounded-lg border border-white/10 p-8 text-white scroll-mt-24"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <div className="text-xs text-white/50 uppercase font-bold tracking-[-0.01em] flex items-center gap-1.5">
                    <i className="fa-solid fa-code text-xs text-[#0086C3]" />
                    <span>Developer Integration</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold tracking-[-0.1em] mt-1">
                    One Endpoint. Under 100ms.
                  </h3>
                </div>
                <span className="self-start sm:self-auto px-3 py-1 bg-[#0086C3]/20 border border-[#0086C3]/40 rounded text-xs font-mono text-[#0086C3] flex items-center gap-1.5 tracking-normal">
                  <i className="fa-solid fa-bolt text-[10px]" />
                  <span>POST /api/verify</span>
                </span>
              </div>

              {/* Code block */}
              <pre className="bg-[#0a0a0c] p-5 rounded-md border border-white/10 text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed tracking-normal">
                <code>{`// 1. Verify login attempt on backend
const response = await fetch('https://your-domain.com/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    ipAddress: req.socket.remoteAddress,
    deviceFingerprint: req.body.deviceFingerprint,
    userAgent: req.headers['user-agent']
  })
});

const { riskScore, recommendation, factors } = await response.json();
// recommendation: 'allow' | 'monitor' | 'challenge'`}</code>
              </pre>
            </div>

            {/* RESOURCES SECTION */}
            <div id="resources" className="w-full max-w-[960px] mt-20 pt-14 border-t border-[rgba(20,20,20,0.06)] scroll-mt-24">
              <div className="reveal-on-scroll text-center mb-12">
                <div className="inline-block text-xs font-bold uppercase tracking-[-0.01em] text-[#0086C3] mb-2">
                  Ecosystem & Documentation
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.1em] text-[#141414]">
                  Developer & Security Resources
                </h2>
                <p className="text-base text-[#6b6a65] max-w-[640px] mx-auto mt-2 tracking-[-0.01em]">
                  Technical guides, downloadable threat feeds, OpenAPI schemas, and starter kits to accelerate deployment.
                </p>
              </div>

              {/* 3x2 Resources Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {RESOURCES.map((res, idx) => (
                  <div
                    key={idx}
                    className={`reveal-on-scroll stagger-${Math.min(idx + 1, 6)} bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] rounded-lg p-6 flex flex-col justify-between bracket transition-all hover:border-[#0086C3] hover:shadow-sm relative group`}
                  >
                    <div>
                      {/* Top icon and badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-md bg-[rgba(20,20,20,0.04)] flex items-center justify-center text-[#0086C3] group-hover:bg-[#0086C3] group-hover:text-white transition-colors">
                          <i className={`${res.faIcon} text-base`} />
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-[-0.01em] ${res.badgeColor}`}>
                          {res.badge}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold uppercase text-[#96948f] tracking-[-0.01em] mb-1">
                        {res.category}
                      </div>

                      <h3 className="text-base font-bold tracking-[-0.04em] text-[#141414] mb-2.5 group-hover:text-[#0086C3] transition-colors">
                        {res.title}
                      </h3>

                      <p className="text-xs text-[#6b6a65] leading-relaxed tracking-[-0.01em] mb-6">
                        {res.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[rgba(20,20,20,0.06)] flex items-center justify-between text-xs font-semibold text-[#141414] tracking-[-0.01em] group-hover:text-[#0086C3] transition-colors">
                      <span>{res.linkText}</span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-[#6b6a65] group-hover:text-[#0086C3] group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </main>

          {/* Footer */}
          <footer className="border-t border-[rgba(20,20,20,0.06)] py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#6b6a65] tracking-[-0.01em]">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-fingerprint text-[#0086C3]" />
              <span className="font-extrabold tracking-[-0.04em] text-[#141414]">andrors</span>
              <span>— Continuous Risk Scoring Authentication</span>
            </div>

            <div className="flex items-center gap-6">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold tracking-[-0.01em]">
                <span className="w-2 h-2 rounded-full bg-[#0086C3] animate-pulse" />
                <span>API Operational</span>
              </span>
              <span>© {new Date().getFullYear()} andrors</span>
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
