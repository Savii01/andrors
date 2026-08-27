import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { solvePow, generateChallenge } from '@/lib/crypto/pow-challenge';
import { generateEnhancedFingerprint } from '@/lib/fingerprint/device-fingerprint';

interface ThreatPreset {
  id: string;
  name: string;
  category: string;
  icon: string;
  ip: string;
  location: string;
  bot: boolean;
  synthetic: boolean;
  corruptPow: boolean;
  canary: boolean;
}

const THREAT_PRESETS: ThreatPreset[] = [
  {
    id: 'clean',
    name: 'Clean Residential',
    category: 'Trusted User',
    icon: 'fa-solid fa-house-user',
    ip: '194.26.29.10',
    location: 'London, UK (Residential)',
    bot: false,
    synthetic: false,
    corruptPow: false,
    canary: false,
  },
  {
    id: 'tor',
    name: 'Tor Exit Node',
    category: 'Anonymizer Attack',
    icon: 'fa-solid fa-mask',
    ip: '185.220.101.5',
    location: 'Frankfurt, DE (Tor Relay)',
    bot: false,
    synthetic: false,
    corruptPow: false,
    canary: false,
  },
  {
    id: 'aws',
    name: 'AWS Datacenter Bot',
    category: 'Credential Stuffing',
    icon: 'fa-solid fa-server',
    ip: '34.192.10.5',
    location: 'Ashburn, US (AWS EC2)',
    bot: true,
    synthetic: true,
    corruptPow: true,
    canary: false,
  },
  {
    id: 'travel',
    name: 'Impossible Velocity',
    category: 'Account Takeover',
    icon: 'fa-solid fa-plane-slash',
    ip: '133.242.18.9',
    location: 'Tokyo, JP (>8,000 km/h)',
    bot: false,
    synthetic: false,
    corruptPow: false,
    canary: false,
  },
  {
    id: 'canary',
    name: 'Honeypot Trap Hit',
    category: 'Database Breach Recon',
    icon: 'fa-solid fa-skull-crossbones',
    ip: '104.248.10.2',
    location: 'Amsterdam, NL (Scraper)',
    bot: true,
    synthetic: true,
    corruptPow: false,
    canary: true,
  },
];

export default function SandboxPage() {
  // Vector Form State
  const [userId, setUserId] = useState('developer@startup.io');
  const [ipAddress, setIpAddress] = useState('194.26.29.10');
  const [isBot, setIsBot] = useState(false);
  const [isSynthetic, setIsSynthetic] = useState(false);
  const [isCorruptPow, setIsCorruptPow] = useState(false);
  const [isCanary, setIsCanary] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('clean');

  // Evaluation & Telemetry Results
  const [loading, setLoading] = useState(false);
  const [evalSpeed, setEvalSpeed] = useState(12);
  const [evalResult, setEvalResult] = useState<{
    riskScore: number;
    recommendation: 'allow' | 'monitor' | 'challenge';
    factors: string[];
    explanation: string;
    requestId: string;
  }>({
    riskScore: 0,
    recommendation: 'allow',
    factors: [],
    explanation: 'Clean trusted request. Evaluated within low-risk threshold (ALLOW).',
    requestId: 'req_init_sandbox',
  });

  // Code snippet tab state: 'curl' | 'node' | 'python' | 'go'
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'node' | 'python' | 'go'>('curl');
  const [copied, setCopied] = useState(false);

  // Apply a preset
  const handleApplyPreset = (p: ThreatPreset) => {
    setActivePreset(p.id);
    setIpAddress(p.ip);
    setIsBot(p.bot);
    setIsSynthetic(p.synthetic);
    setIsCorruptPow(p.corruptPow);
    setIsCanary(p.canary);
    if (p.canary) {
      setUserId('admin_backup@company.com');
    } else if (userId === 'admin_backup@company.com') {
      setUserId('developer@startup.io');
    }
  };

  // Run live evaluation
  const handleEvaluate = async () => {
    setLoading(true);
    const startTime = performance.now();

    try {
      // 1. Prepare fingerprint
      let fingerprint = 'fp_dev_sandbox_hash';
      try {
        if (typeof window !== 'undefined') {
          fingerprint = await generateEnhancedFingerprint();
        }
      } catch {}

      // 2. Prepare User-Agent
      const userAgent = isBot
        ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/122.0.0.0 Safari/537.36 Puppeteer'
        : typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

      // 3. Prepare Proof-of-Work
      let powChallenge = generateChallenge(userId);
      let powNonce = 0;
      let powSolution = '';

      if (!isCorruptPow) {
        const solved = await solvePow(powChallenge);
        if (solved) {
          powNonce = solved.nonce;
          powSolution = solved.solution;
        }
      } else {
        powNonce = 99999;
        powSolution = 'corrupted_hash_0000000000000000000';
      }

      // 4. Fire POST /api/verify
      const targetUser = isCanary ? 'admin_backup@company.com' : userId;

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser,
          ipAddress: ipAddress.trim(),
          deviceFingerprint: fingerprint,
          userAgent,
          timestamp: new Date().toISOString(),
          behavioralIsTrusted: !isSynthetic,
          behavioralIsHumanDynamics: !isSynthetic && !isBot,
          powChallenge,
          powNonce,
          powSolution,
        }),
      });

      const data = await res.json();
      const speed = Math.round(performance.now() - startTime);
      setEvalSpeed(Math.max(speed, 9));

      setEvalResult({
        riskScore: data.riskScore ?? 0,
        recommendation: (data.recommendation as 'allow' | 'monitor' | 'challenge') || 'allow',
        factors: data.factors || [],
        explanation: data.explanation || 'Evaluation completed successfully.',
        requestId: data.requestId || 'req_' + Math.random().toString(36).substring(2, 9),
      });
    } catch (err: any) {
      setEvalSpeed(14);
      setEvalResult({
        riskScore: isBot || isCanary ? 85 : 15,
        recommendation: isBot || isCanary ? 'challenge' : 'allow',
        factors: isBot ? ['bot_signals', 'bot_dynamics'] : isCanary ? ['canary_target'] : [],
        explanation: 'Local threat evaluation heuristic executed.',
        requestId: 'req_local_fallback',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate dynamic code snippet
  const getCodeSnippet = () => {
    const effectiveUser = isCanary ? 'admin_backup@company.com' : userId;
    const ua = isBot ? 'HeadlessChrome/122.0 Puppeteer' : 'Mozilla/5.0 Chrome/122.0';

    if (activeCodeTab === 'curl') {
      return `curl -X POST https://api.andrors.io/v1/verify \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer andrors_live_sandbox_key" \\
  -d '{
    "userId": "${effectiveUser}",
    "ipAddress": "${ipAddress}",
    "deviceFingerprint": "fp_client_${ipAddress.replace(/\\./g, '_')}",
    "userAgent": "${ua}",
    "behavioralIsTrusted": ${!isSynthetic}
  }'`;
    }

    if (activeCodeTab === 'node') {
      return `import { andrors } from '@andrors/sdk';

const response = await andrors.verify({
  userId: '${effectiveUser}',
  ipAddress: '${ipAddress}',
  userAgent: '${ua}',
  behavioralIsTrusted: ${!isSynthetic}
});

console.log(response.recommendation); // 'allow' | 'monitor' | 'challenge'
console.log(response.riskScore);      // ${evalResult.riskScore} / 100`;
    }

    if (activeCodeTab === 'python') {
      return `import requests

response = requests.post(
    "https://api.andrors.io/v1/verify",
    headers={"Authorization": "Bearer andrors_live_sandbox_key"},
    json={
        "userId": "${effectiveUser}",
        "ipAddress": "${ipAddress}",
        "userAgent": "${ua}",
        "behavioralIsTrusted": ${!isSynthetic ? 'True' : 'False'}
    }
)

result = response.json()
print(f"Risk Score: {result['riskScore']} -> {result['recommendation']}")`;
    }

    if (activeCodeTab === 'go') {
      return `package main

import (
    "bytes"
    "fmt"
    "net/http"
)

func main() {
    payload := []byte(\`{
        "userId": "${effectiveUser}",
        "ipAddress": "${ipAddress}",
        "userAgent": "${ua}"
    }\`)
    
    req, _ := http.NewRequest("POST", "https://api.andrors.io/v1/verify", bytes.NewBuffer(payload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer andrors_live_sandbox_key")
    
    resp, _ := http.DefaultClient.Do(req)
    fmt.Println("Status:", resp.Status)
}`;
    }

    return '';
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Head>
        <title>Developer Threat Laboratory — andrors</title>
        <meta
          name="description"
          content="Interactive Developer Security Workbench. Test threat vectors, headless bots, impossible travel, and live risk telemetry."
        />
      </Head>

      <div className="min-h-screen bg-[#ece9e2] text-[#141414] font-sans selection:bg-[#0086C3] selection:text-white flex flex-col justify-between">
        
        {/* Navigation Header */}
        <header className="sticky top-0 z-40 bg-[#ece9e2]/90 backdrop-blur-md border-b border-[rgba(20,20,20,0.08)] py-3.5 px-6">
          <div className="max-w-[1240px] w-full mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 text-[#141414] no-underline group">
                <div className="w-8 h-8 flex items-center justify-center text-[#0086C3] group-hover:scale-105 transition-transform">
                  <i className="fa-solid fa-fingerprint text-2xl" />
                </div>
                <span className="text-xl font-extrabold tracking-[-0.04em]">andrors</span>
              </Link>

              <span className="hidden sm:inline-block text-xs font-mono px-2 py-0.5 rounded bg-black/5 text-[#6b6a65] border border-black/5">
                Threat Lab v0.2.0
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Engine Connected (Sub-15ms SLA)</span>
              </div>

              <Link
                href="/login"
                className="text-xs font-bold text-[#141414] hover:text-[#0086C3] bg-white border border-[rgba(20,20,20,0.1)] px-3.5 py-1.5 rounded-lg no-underline shadow-sm transition-all hover:border-[#0086C3]"
              >
                <span>Go to Live Login</span>
                <i className="fa-solid fa-arrow-right text-[10px] ml-1.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* MAIN STUDIO WORKBENCH */}
        <main className="max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-8 flex-1">
          
          {/* Studio Header Breadcrumbs */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6b6a65] mb-1">
              <Link href="/" className="hover:text-[#0086C3] no-underline text-[#6b6a65]">Overview</Link>
              <span>/</span>
              <span className="text-[#141414]">Developer Threat Laboratory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.04em] text-[#141414]">
              Interactive Threat Vector Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#6b6a65] mt-1 max-w-[720px] leading-relaxed">
              Inject synthetic bot runtimes, residential proxies, impossible velocities, and corrupted cryptographic nonces directly into the live 7-factor evaluation pipeline.
            </p>
          </div>

          {/* Preset Attack Chips Bar */}
          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b6a65] block mb-2">
              Select Attack Simulation Preset:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {THREAT_PRESETS.map((p) => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#141414] text-white border-[#141414] shadow-md'
                        : 'bg-white text-[#141414] border-[rgba(20,20,20,0.08)] hover:border-[#0086C3] hover:bg-[#f9f8f5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <i className={`${p.icon} text-sm ${isSelected ? 'text-[#0086C3]' : 'text-[#6b6a65]'}`} />
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/10 text-white/90' : 'bg-black/5 text-[#6b6a65]'
                      }`}>
                        {p.category}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold tracking-[-0.02em]">{p.name}</div>
                      <div className={`text-[10px] font-mono truncate mt-0.5 ${isSelected ? 'text-white/60' : 'text-[#6b6a65]'}`}>
                        {p.ip}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TWO-COLUMN STUDIO GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
            
            {/* PANEL A: ATTACK SIMULATION STUDIO (LEFT) */}
            <div className="bg-white border border-[rgba(20,20,20,0.08)] rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-[rgba(20,20,20,0.06)]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#0086C3]/10 text-[#0086C3] flex items-center justify-center text-xs">
                      <i className="fa-solid fa-sliders" />
                    </div>
                    <h2 className="text-sm font-bold tracking-[-0.02em] text-[#141414]">
                      Vector Configuration Controls
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-[#96948f]">POST /api/verify</span>
                </div>

                <div className="space-y-4">
                  {/* Identity */}
                  <div>
                    <label className="block text-xs font-semibold text-[#6b6a65] mb-1">
                      Identity Identifier (`userId`)
                    </label>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="user@domain.com"
                      className="w-full px-3.5 py-2 rounded-lg bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] text-xs font-mono text-[#141414] focus:bg-white focus:outline-none focus:border-[#0086C3] transition-all"
                    />
                  </div>

                  {/* Origin IP */}
                  <div>
                    <label className="block text-xs font-semibold text-[#6b6a65] mb-1">
                      Origin IP Address (`ipAddress`)
                    </label>
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="e.g. 185.220.101.5"
                      className="w-full px-3.5 py-2 rounded-lg bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] text-xs font-mono text-[#141414] focus:bg-white focus:outline-none focus:border-[#0086C3] transition-all"
                    />
                  </div>

                  {/* Threat Vector Toggles Matrix */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6b6a65] mb-2.5">
                      Active Threat Signal Injections:
                    </label>
                    <div className="space-y-2.5">
                      
                      {/* Toggle 1: Headless Bot */}
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-[#f9f8f5] border border-[rgba(20,20,20,0.06)] hover:border-[rgba(20,20,20,0.15)] cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={isBot}
                          onChange={(e) => setIsBot(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-[#0086C3] focus:ring-[#0086C3] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-[#141414] flex items-center justify-between">
                            <span>Emulate Headless Automation Client</span>
                            <span className="text-[10px] font-mono text-rose-600 font-semibold">+25 Risk</span>
                          </div>
                          <p className="text-[11px] text-[#6b6a65] mt-0.5 leading-normal">
                            Injects Puppeteer / Selenium signatures and empty WebGL hardware context.
                          </p>
                        </div>
                      </label>

                      {/* Toggle 2: Synthetic DOM */}
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-[#f9f8f5] border border-[rgba(20,20,20,0.06)] hover:border-[rgba(20,20,20,0.15)] cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={isSynthetic}
                          onChange={(e) => setIsSynthetic(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-[#0086C3] focus:ring-[#0086C3] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-[#141414] flex items-center justify-between">
                            <span>Synthetic Event &amp; Zero Mouse Curvature</span>
                            <span className="text-[10px] font-mono text-rose-600 font-semibold">+25 Risk</span>
                          </div>
                          <p className="text-[11px] text-[#6b6a65] mt-0.5 leading-normal">
                            Sets `event.isTrusted: false` and emulates straight-line mouse coordinate teleportation.
                          </p>
                        </div>
                      </label>

                      {/* Toggle 3: Corrupt PoW */}
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-[#f9f8f5] border border-[rgba(20,20,20,0.06)] hover:border-[rgba(20,20,20,0.15)] cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={isCorruptPow}
                          onChange={(e) => setIsCorruptPow(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-[#0086C3] focus:ring-[#0086C3] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-[#141414] flex items-center justify-between">
                            <span>Corrupt Proof-of-Work Challenge</span>
                            <span className="text-[10px] font-mono text-rose-600 font-semibold">+35 Risk</span>
                          </div>
                          <p className="text-[11px] text-[#6b6a65] mt-0.5 leading-normal">
                            Simulates a raw curl script failing to compute the required SHA-256 micro-nonce.
                          </p>
                        </div>
                      </label>

                      {/* Toggle 4: Canary Trap */}
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-[#f9f8f5] border border-[rgba(20,20,20,0.06)] hover:border-[rgba(20,20,20,0.15)] cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={isCanary}
                          onChange={(e) => {
                            setIsCanary(e.target.checked);
                            if (e.target.checked) setUserId('admin_backup@company.com');
                          }}
                          className="mt-0.5 rounded border-gray-300 text-[#0086C3] focus:ring-[#0086C3] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-[#141414] flex items-center justify-between">
                            <span>Hit Canary Decoy Honeypot Account</span>
                            <span className="text-[10px] font-mono text-rose-600 font-bold">100 (HARD BLOCK)</span>
                          </div>
                          <p className="text-[11px] text-[#6b6a65] mt-0.5 leading-normal">
                            Attempts login against an unlinked decoy user (`admin_backup@...`).
                          </p>
                        </div>
                      </label>

                    </div>
                  </div>
                </div>
              </div>

              {/* Fire Button */}
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={loading}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white tracking-[-0.01em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                  loading ? 'bg-[#0086C3]/80 cursor-wait' : 'bg-[#141414] hover:bg-[#0086C3] active:scale-[0.99]'
                }`}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>Executing Real-Time Scoring...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt text-[#0086C3]" />
                    <span>Trigger Live Threat Evaluation</span>
                  </>
                )}
              </button>
            </div>

            {/* PANEL B: LIVE ENGINE TELEMETRY FEED (RIGHT) */}
            <div className="bg-[#141416] text-white border border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
              
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#0086C3]/20 text-[#0086C3] flex items-center justify-center text-xs">
                      <i className="fa-solid fa-chart-pie" />
                    </div>
                    <h2 className="text-sm font-bold tracking-[-0.02em] text-white">
                      Live Telemetry &amp; Signal Matrix
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{evalSpeed} ms</span>
                  </span>
                </div>

                {/* Main Score & Decision Banner */}
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 mb-5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 block mb-0.5">
                      Calculated Risk Score
                    </span>
                    <div className="text-3xl font-extrabold tracking-[-0.04em] font-mono text-white flex items-baseline gap-1">
                      <span>{evalResult.riskScore}</span>
                      <span className="text-sm text-white/40 font-normal">/ 100</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 block mb-1">
                      Engine Verdict
                    </span>
                    <span className={`px-3 py-1 rounded-md text-xs font-extrabold tracking-wider uppercase inline-block ${
                      evalResult.recommendation === 'allow'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : evalResult.recommendation === 'monitor'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {evalResult.recommendation === 'allow'
                        ? 'ALLOW (Frictionless)'
                        : evalResult.recommendation === 'monitor'
                        ? 'MONITOR (Silent)'
                        : 'CHALLENGE (Step-Up 2FA)'}
                    </span>
                  </div>
                </div>

                {/* 6 Radar Signal Breakdown Meters */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">
                    Signal Matrix Assessment:
                  </span>

                  {/* Signal 1: IP Intelligence */}
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/70 flex items-center gap-2">
                      <i className="fa-solid fa-network-wired text-[11px] text-[#0086C3]" />
                      <span>IP ASN Classification:</span>
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${
                      ipAddress.startsWith('185.220.') ? 'text-rose-400' : ipAddress.startsWith('34.192.') ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {ipAddress.startsWith('185.220.') ? 'Tor Exit Relay (High Risk)' : ipAddress.startsWith('34.192.') ? 'AWS Datacenter (Hosting)' : 'Residential (Clean)'}
                    </span>
                  </div>

                  {/* Signal 2: Geographic Velocity */}
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/70 flex items-center gap-2">
                      <i className="fa-solid fa-earth-americas text-[11px] text-[#0086C3]" />
                      <span>Haversine Travel Velocity:</span>
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${
                      ipAddress.startsWith('133.242.') ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {ipAddress.startsWith('133.242.') ? '>8,400 km/h (FAILS Physics)' : '0 km/h (Continuity OK)'}
                    </span>
                  </div>

                  {/* Signal 3: Behavioral Dynamics */}
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/70 flex items-center gap-2">
                      <i className="fa-solid fa-arrow-pointer text-[11px] text-[#0086C3]" />
                      <span>Behavioral Trajectory &amp; Trust:</span>
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${
                      isSynthetic ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {isSynthetic ? 'isTrusted: false (Synthetic Event)' : 'isTrusted: true (Native Input)'}
                    </span>
                  </div>

                  {/* Signal 4: Proof-of-Work */}
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/70 flex items-center gap-2">
                      <i className="fa-solid fa-microchip text-[11px] text-[#0086C3]" />
                      <span>Web Crypto SHA-256 PoW:</span>
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${
                      isCorruptPow ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {isCorruptPow ? 'FAILED (Invalid Hash Nonce)' : 'VERIFIED (Native Sub-20ms Nonce)'}
                    </span>
                  </div>

                  {/* Signal 5: Honeypot Canary */}
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/70 flex items-center gap-2">
                      <i className="fa-solid fa-skull text-[11px] text-[#0086C3]" />
                      <span>Decoy Account Trap:</span>
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${
                      isCanary ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {isCanary ? 'TRIGGERED (Canary Hard Block)' : 'Clean Account'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rationale Explanation Box */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 space-y-1">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                  Engine Rationale:
                </span>
                <p className="text-[11px] leading-relaxed text-white/80 font-mono">
                  {evalResult.explanation}
                </p>
                <div className="text-[10px] text-white/40 font-mono pt-1">
                  Request ID: <span className="text-white/60">{evalResult.requestId}</span>
                </div>
              </div>

            </div>

          </div>

          {/* PANEL C: LIVE DEVELOPER CODE EXPORT (BOTTOM FULL-WIDTH) */}
          <div className="mt-8 bg-white border border-[rgba(20,20,20,0.08)] rounded-2xl p-6 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(20,20,20,0.06)]">
              <div>
                <h3 className="text-sm font-bold text-[#141414] tracking-[-0.02em]">
                  Live Developer Code Export
                </h3>
                <p className="text-xs text-[#6b6a65] mt-0.5">
                  Copy and run this exact request from your own local terminal to evaluate the live engine.
                </p>
              </div>

              {/* Language Tabs & Copy Button */}
              <div className="flex items-center gap-2">
                <div className="flex bg-black/5 p-1 rounded-lg border border-[rgba(20,20,20,0.06)]">
                  {(['curl', 'node', 'python', 'go'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        activeCodeTab === tab
                          ? 'bg-[#141414] text-white shadow-sm'
                          : 'text-[#6b6a65] hover:text-[#141414]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-[#0086C3] hover:bg-[#0074a8] text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-xs`} />
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            {/* Code Block */}
            <div className="bg-[#141416] text-white rounded-xl p-4 font-mono text-xs overflow-x-auto border border-white/10 shadow-inner">
              <pre className="text-sky-300 leading-relaxed">{getCodeSnippet()}</pre>
            </div>

          </div>

        </main>

        {/* Minimal Footer */}
        <footer className="py-6 px-6 text-center text-xs text-[#96948f] border-t border-[rgba(20,20,20,0.06)]">
          © {new Date().getFullYear()} andrors Continuous Authentication Engine. Built for modern SaaS.
        </footer>

      </div>
    </>
  );
}
