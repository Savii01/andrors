import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/client/supabase-browser';
import { generateEnhancedFingerprint } from '@/lib/fingerprint/device-fingerprint';
import {
  startBehavioralCollection,
  stopBehavioralCollection,
  captureSubmitTrust,
  resetBehavioralState,
} from '@/lib/fingerprint/behavioral-dynamics';
import { User } from '@supabase/supabase-js';

interface EvaluationResult {
  score: number;
  recommendation: string;
  factors: string[];
  explanation: string;
  speedMs: number;
}

interface ScenarioPreset {
  id: string;
  name: string;
  badge: string;
  expectedOutcome: 'allow' | 'monitor' | 'challenge';
  email: string;
  ipAddress: string;
  deviceFingerprint: string;
  userAgent: string;
}

const DEMO_PRESETS: ScenarioPreset[] = [
  {
    id: 'normal',
    name: 'Normal User',
    badge: 'Instant Login',
    expectedOutcome: 'allow',
    email: 'alex@company.com',
    ipAddress: '194.26.29.10',
    deviceFingerprint: 'fp_alex_laptop',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  },
  {
    id: 'new_device',
    name: 'New Device',
    badge: 'Silent Verify',
    expectedOutcome: 'monitor',
    email: 'alex@company.com',
    ipAddress: '82.165.197.1',
    deviceFingerprint: 'fp_alex_new_tablet',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  },
  {
    id: 'travel',
    name: 'Unusual Location',
    badge: 'Code Prompt',
    expectedOutcome: 'challenge',
    email: 'alex@company.com',
    ipAddress: '133.242.18.9',
    deviceFingerprint: 'fp_unrecognized_device',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
  },
  {
    id: 'bot',
    name: 'Bot Attempt',
    badge: 'Blocked / Code Prompt',
    expectedOutcome: 'challenge',
    email: 'alex@company.com',
    ipAddress: '34.192.10.5',
    deviceFingerprint: 'fp_headless_bot',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/122.0.0.0 Safari/537.36 Puppeteer',
  },
];

export default function LoginPage() {
  const [authTab, setAuthTab] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('alex@company.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [activePreset, setActivePreset] = useState<ScenarioPreset>(DEMO_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // View state: 'form' | 'dashboard' | 'challenge'
  const [viewState, setViewState] = useState<'form' | 'dashboard' | 'challenge'>('form');
  const [resultOutcome, setResultOutcome] = useState<'allow' | 'monitor' | 'challenge'>('allow');
  const [evalSpeed, setEvalSpeed] = useState(14);
  const [userSession, setUserSession] = useState<User | null>(null);

  // 6-digit OTP code for challenge state
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // Check active user session on load
  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUserSession(data.user);
        }
      });
    } catch {}
  }, []);

  // Start/stop passive behavioral collection
  useEffect(() => {
    startBehavioralCollection();
    return () => stopBehavioralCollection();
  }, []);

  const handleSelectPreset = (preset: ScenarioPreset) => {
    setActivePreset(preset);
    setEmail(preset.email);
    setPassword('password123');
    setErrorMessage(null);
    setSuccessNotice(null);
    setViewState('form');
    setOtpCode(['', '', '', '', '', '']);
    resetBehavioralState();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    captureSubmitTrust(e);
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    const startTime = performance.now();

    try {
      // Step 1: Evaluate login with andrors API
      let fingerprint = activePreset.deviceFingerprint;
      try {
        if (typeof window !== 'undefined' && activePreset.id === 'normal') {
          fingerprint = await generateEnhancedFingerprint();
        }
      } catch {}

      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: email.trim().toLowerCase(),
          ipAddress: activePreset.ipAddress,
          deviceFingerprint: fingerprint,
          userAgent: activePreset.userAgent || window.navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });

      const verifyData = await verifyResponse.json();
      const speed = Math.round(performance.now() - startTime);
      setEvalSpeed(Math.max(speed, 12));

      const outcome = (verifyData.recommendation as 'allow' | 'monitor' | 'challenge') || activePreset.expectedOutcome;
      setResultOutcome(outcome);
      setEvaluationResult({
        score: verifyData.riskScore ?? (activePreset.expectedOutcome === 'allow' ? 0 : activePreset.expectedOutcome === 'monitor' ? 35 : 75),
        recommendation: outcome,
        factors: verifyData.factors || (activePreset.expectedOutcome === 'allow' ? [] : activePreset.expectedOutcome === 'monitor' ? ['new_device', 'new_ip'] : ['unusual_location', 'bot_signals']),
        explanation: verifyData.explanation || 'Evaluated in real-time by andrors engine.',
        speedMs: Math.max(speed, 12),
      });

      // Step 2: Authenticate with Supabase
      const supabase = getSupabaseBrowserClient();

      if (authTab === 'sign_in') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (data?.user) {
          setUserSession(data.user);
        } else if (error && activePreset.id === 'normal' && !email.includes('@company.com')) {
          setLoading(false);
          setErrorMessage(error.message);
          return;
        }
      } else {
        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (data?.user) {
          setUserSession(data.user);
          if (data.session === null) {
            setSuccessNotice('Account created! Please check your email to verify your address.');
          }
        } else if (error) {
          setLoading(false);
          setErrorMessage(error.message);
          return;
        }
      }

      setLoading(false);

      if (outcome === 'challenge') {
        setViewState('challenge');
      } else {
        setViewState('dashboard');
      }
    } catch (err: any) {
      setLoading(false);
      setResultOutcome(activePreset.expectedOutcome);
      setEvalSpeed(14);
      if (activePreset.expectedOutcome === 'challenge') {
        setViewState('challenge');
      } else {
        setViewState('dashboard');
      }
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const updated = [...otpCode];
    updated[index] = value;
    setOtpCode(updated);

    if (value && index < 5) {
      const nextBox = document.getElementById(`digit-${index + 1}`);
      nextBox?.focus();
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setViewState('dashboard');
    }, 500);
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setUserSession(null);
    } catch {}
    setViewState('form');
    setSuccessNotice('You have been signed out.');
  };

  return (
    <>
      <Head>
        <title>Sign In — andrors</title>
        <meta
          name="description"
          content="Fast, secure, frictionless authentication powered by andrors."
        />
      </Head>

      <div className="min-h-screen bg-[#ece9e2] text-[#141414] font-sans flex flex-col justify-between selection:bg-[#0086C3] selection:text-white">
        
        {/* Navigation Header */}
        <header className="py-4 px-6 max-w-[1100px] w-full mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#141414] no-underline group">
            <div className="w-8 h-8 flex items-center justify-center text-[#0086C3] group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-fingerprint text-2xl" />
            </div>
            <span className="text-xl font-extrabold tracking-[-0.04em]">andrors</span>
          </Link>

          <Link
            href="/"
            className="text-xs font-semibold text-[#6b6a65] hover:text-[#0086C3] no-underline transition-colors flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-left text-[10px]" />
            <span>Back to Overview</span>
          </Link>
        </header>

        {/* Center Container */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-[480px] w-full mx-auto">
          
          {/* Quick Scenario Pills (Clean, intuitive demo buttons) */}
          <div className="w-full mb-5">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b6a65]">
                Try a Demo Scenario:
              </span>
              <span className="text-[11px] text-[#0086C3] font-medium">
                {activePreset.badge}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/5 rounded-lg border border-[rgba(20,20,20,0.06)]">
              {DEMO_PRESETS.map((p) => {
                const isSelected = activePreset.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`py-1.5 px-2 rounded-md text-xs font-semibold tracking-[-0.01em] transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-[#141414] text-white shadow-sm'
                        : 'bg-transparent text-[#6b6a65] hover:text-[#141414] hover:bg-black/5'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MAIN CARD */}
          <div className="w-full bg-white border border-[rgba(20,20,20,0.08)] rounded-2xl p-7 sm:p-8 shadow-sm">
            
            {/* VIEW 1: SIGN IN / SIGN UP FORM */}
            {viewState === 'form' && (
              <div>
                {/* Tabs */}
                <div className="flex border-b border-[rgba(20,20,20,0.08)] mb-6">
                  <button
                    type="button"
                    onClick={() => setAuthTab('sign_in')}
                    className={`pb-3 text-sm font-bold tracking-[-0.02em] transition-colors cursor-pointer relative ${
                      authTab === 'sign_in' ? 'text-[#141414]' : 'text-[#96948f] hover:text-[#141414]'
                    }`}
                  >
                    <span>Sign In</span>
                    {authTab === 'sign_in' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0086C3] rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthTab('sign_up')}
                    className={`pb-3 ml-6 text-sm font-bold tracking-[-0.02em] transition-colors cursor-pointer relative ${
                      authTab === 'sign_up' ? 'text-[#141414]' : 'text-[#96948f] hover:text-[#141414]'
                    }`}
                  >
                    <span>Create Account</span>
                    {authTab === 'sign_up' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0086C3] rounded-full" />
                    )}
                  </button>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Success Banner */}
                {successNotice && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500" />
                    <span>{successNotice}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-[#6b6a65] mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#96948f]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] text-sm text-[#141414] focus:outline-none focus:bg-white focus:border-[#0086C3] focus:ring-1 focus:ring-[#0086C3] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-[#6b6a65] mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#96948f]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-[#f9f8f5] border border-[rgba(20,20,20,0.12)] text-sm text-[#141414] focus:outline-none focus:bg-white focus:border-[#0086C3] focus:ring-1 focus:ring-[#0086C3] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#96948f] hover:text-[#141414] transition-colors p-1 cursor-pointer bg-transparent border-none"
                        aria-label="Toggle password visibility"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-gray-300 text-[#0086C3] focus:ring-[#0086C3] cursor-pointer"
                      />
                      <span className="text-xs text-[#6b6a65]">Remember this device</span>
                    </label>

                    {authTab === 'sign_in' && (
                      <span className="text-xs text-[#0086C3] hover:underline cursor-pointer">
                        Forgot password?
                      </span>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-sm text-white tracking-[-0.01em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm mt-2 ${
                      loading ? 'bg-[#0086C3]/90 cursor-wait' : 'bg-[#141414] hover:bg-[#0086C3]'
                    }`}
                  >
                    {loading ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>{authTab === 'sign_in' ? 'Sign In' : 'Create Account'}</span>
                        <i className="fa-solid fa-arrow-right text-xs" />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Security Badge */}
                <div className="mt-6 pt-4 border-t border-[rgba(20,20,20,0.06)] flex items-center justify-center gap-1.5 text-xs text-[#96948f]">
                  <i className="fa-solid fa-shield-check text-[#0086C3]" />
                  <span>Continuous protection by andrors</span>
                </div>
              </div>
            )}

            {/* VIEW 2: STEP-UP VERIFICATION (WHEN UNUSUAL TRAVEL OR BOT DETECTED) */}
            {viewState === 'challenge' && (
              <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
                  <i className="fa-solid fa-shield-halved text-xl" />
                </div>

                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#141414]">
                  Quick Verification Required
                </h2>
                {/* Score & Triggered Signal Tag */}
                <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200/60 max-w-[340px] mx-auto mb-5 text-xs text-left space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#6b6a65]">Calculated Risk Score:</span>
                    <span className="font-mono text-amber-900 font-bold">
                      {evaluationResult?.score ?? 65} / 100 (CHALLENGE)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6b6a65]">
                    <span>Reason: </span>
                    <span className="font-medium text-[#141414]">
                      {evaluationResult?.factors && evaluationResult.factors.length > 0
                        ? evaluationResult.factors.map(f => f.replace('_', ' ')).join(', ')
                        : 'Unusual location or automated client signals'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#6b6a65] mb-4 leading-relaxed max-w-[340px] mx-auto">
                  Please enter the 6-digit code sent to <strong>{email}</strong> to continue.
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="flex justify-between gap-2 max-w-[320px] mx-auto">
                    {otpCode.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`digit-${idx}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpInput(idx, e.target.value)}
                        className="w-10 h-11 text-center text-lg font-bold font-mono bg-[#f9f8f5] border border-[rgba(20,20,20,0.15)] rounded-lg text-[#141414] focus:bg-white focus:outline-none focus:border-[#0086C3] focus:ring-1 focus:ring-[#0086C3]"
                      />
                    ))}
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setOtpCode(['8', '4', '2', '9', '1', '7'])}
                      className="text-xs text-[#0086C3] hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      Fill sample code: 842917
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingOtp}
                    className="w-full py-3 px-4 bg-[#0086C3] hover:bg-[#0074a8] text-white font-bold text-sm rounded-lg tracking-[-0.01em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm & Sign In</span>
                        <i className="fa-solid fa-arrow-right text-xs" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewState('form')}
                    className="text-xs text-[#96948f] hover:text-[#141414] cursor-pointer bg-transparent border-none p-1"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              </div>
            )}

            {/* VIEW 3: SUCCESS DASHBOARD */}
            {viewState === 'dashboard' && (
              <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4">
                  <i className="fa-solid fa-circle-check text-2xl" />
                </div>

                <h2 className="text-xl font-extrabold tracking-[-0.04em] text-[#141414]">
                  Welcome back, {userSession ? userSession.email?.split('@')[0] : 'Alex'}!
                </h2>
                
                <p className="text-xs text-[#6b6a65] mt-1 mb-5">
                  {resultOutcome === 'monitor'
                    ? 'Signed in seamlessly. New device recorded in your security history.'
                    : 'You were signed in instantly with zero friction.'}
                </p>

                {/* Live Risk Scoring & Verification Stats */}
                <div className="p-4 bg-[#f9f8f5] rounded-xl border border-[rgba(20,20,20,0.06)] text-xs text-[#6b6a65] space-y-2.5 mb-6">
                  <div className="flex items-center justify-between">
                    <span>Risk Evaluation:</span>
                    <span className="font-semibold text-emerald-600">Passed in {evalSpeed} ms</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Calculated Risk Score:</span>
                    <span className="font-mono font-bold text-[#141414]">
                      {evaluationResult?.score ?? (resultOutcome === 'allow' ? 0 : 35)} / 100
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Engine Decision:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      resultOutcome === 'monitor'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {resultOutcome === 'monitor' ? 'MONITOR (Silent)' : 'ALLOW (Frictionless)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[rgba(20,20,20,0.06)]">
                    <span>Triggered Signals:</span>
                    <span className="font-medium text-[#141414] truncate max-w-[200px]">
                      {evaluationResult?.factors && evaluationResult.factors.length > 0
                        ? evaluationResult.factors.join(', ')
                        : 'None (Trusted Baseline)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Account:</span>
                    <span className="font-medium text-[#141414]">{email}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full py-2.5 px-4 bg-[#141414] hover:bg-[#0086C3] text-white font-bold text-xs rounded-lg tracking-[-0.01em] transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-rotate-left text-xs" />
                    <span>Sign Out & Try Again</span>
                  </button>

                  <Link
                    href="/"
                    className="w-full py-2 px-4 bg-transparent border border-[rgba(20,20,20,0.08)] hover:bg-black/5 text-[#6b6a65] font-semibold text-xs rounded-lg tracking-[-0.01em] transition-colors no-underline flex items-center justify-center gap-1.5"
                  >
                    <span>Return to Homepage</span>
                  </Link>
                </div>
              </div>
            )}

          </div>

          {/* Simple Bottom Benefit Notice */}
          <div className="mt-8 text-center text-xs text-[#6b6a65] max-w-[380px] leading-relaxed">
            <span className="font-semibold text-[#141414]">Zero CAPTCHAs, Zero SMS delays.</span> Legitimate users log in instantly while threats are stopped automatically.
          </div>

        </main>

        {/* Minimal Footer */}
        <footer className="py-4 px-6 text-center text-xs text-[#96948f]">
          © {new Date().getFullYear()} andrors. All rights reserved.
        </footer>

      </div>
    </>
  );
}
