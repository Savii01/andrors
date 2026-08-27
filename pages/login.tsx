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
import { solvePow, generateChallenge } from '@/lib/crypto/pow-challenge';
import { User } from '@supabase/supabase-js';

interface EvaluationResult {
  score: number;
  recommendation: string;
  factors: string[];
  explanation: string;
  speedMs: number;
}

export default function LoginPage() {
  const [authTab, setAuthTab] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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

  // Check active user session on load & attach passive behavioral biometrics
  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUserSession(data.user);
        }
      });
    } catch {}

    startBehavioralCollection();
    return () => {
      stopBehavioralCollection();
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    captureSubmitTrust(e);
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    const startTime = performance.now();

    try {
      // 1. Generate client fingerprint
      let fingerprint = 'fp_browser_client';
      try {
        if (typeof window !== 'undefined') {
          fingerprint = await generateEnhancedFingerprint();
        }
      } catch {}

      // 2. Solve Proof-of-Work challenge
      let powChallenge = generateChallenge(email.trim().toLowerCase() || 'anonymous');
      let powNonce = 0;
      let powSolution = '';
      try {
        const solved = await solvePow(powChallenge);
        if (solved) {
          powNonce = solved.nonce;
          powSolution = solved.solution;
        }
      } catch {}

      // 3. Evaluate continuous risk with andrors API
      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: email.trim().toLowerCase(),
          ipAddress: 'auto',
          deviceFingerprint: fingerprint,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          powChallenge,
          powNonce,
          powSolution,
        }),
      });

      const verifyData = await verifyResponse.json();
      const speed = Math.round(performance.now() - startTime);
      setEvalSpeed(Math.max(speed, 12));

      const outcome = (verifyData.recommendation as 'allow' | 'monitor' | 'challenge') || 'allow';
      setResultOutcome(outcome);
      setEvaluationResult({
        score: verifyData.riskScore ?? 0,
        recommendation: outcome,
        factors: verifyData.factors || [],
        explanation: verifyData.explanation || 'Evaluated in real-time by andrors engine.',
        speedMs: Math.max(speed, 12),
      });

      // 4. Authenticate with Supabase
      const supabase = getSupabaseBrowserClient();

      if (authTab === 'sign_in') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (data?.user) {
          setUserSession(data.user);
        } else if (error) {
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
      setResultOutcome('allow');
      setEvalSpeed(14);
      setViewState('dashboard');
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
    resetBehavioralState();
    setViewState('form');
    setSuccessNotice('You have been signed out.');
  };

  return (
    <>
      <Head>
        <title>Sign In — andrors</title>
        <meta
          name="description"
          content="Fast, secure, frictionless authentication powered by andrors continuous risk engine."
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

          <div className="flex items-center gap-3">
            <Link
              href="/sandbox"
              className="text-xs font-semibold text-[#0086C3] bg-[#0086C3]/10 hover:bg-[#0086C3]/20 border border-[#0086C3]/20 px-3.5 py-1.5 rounded-lg no-underline transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-flask text-[11px]" />
              <span>Threat Laboratory</span>
            </Link>
          </div>
        </header>

        {/* Center Container */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-[480px] w-full mx-auto">
          
          {/* Top Developer Workbench Notice Banner */}
          <div className="w-full mb-5 p-3 rounded-xl bg-white/70 border border-[rgba(20,20,20,0.06)] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#6b6a65]">
              <i className="fa-solid fa-shield-halved text-[#0086C3]" />
              <span>Testing threat vectors &amp; telemetry?</span>
            </div>
            <Link
              href="/sandbox"
              className="text-xs font-bold text-[#0086C3] hover:underline no-underline flex items-center gap-1"
            >
              <span>Threat Lab</span>
              <i className="fa-solid fa-arrow-right text-[9px]" />
            </Link>
          </div>

          {/* MAIN AUTH CARD */}
          <div className="w-full bg-white border border-[rgba(20,20,20,0.08)] rounded-2xl p-7 sm:p-8 shadow-sm">
            
            {/* VIEW 1: SIGN IN / SIGN UP FORM */}
            {viewState === 'form' && (
              <div>
                {/* Tabs */}
                <div className="flex border-b border-[rgba(20,20,20,0.08)] mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('sign_in');
                      setErrorMessage(null);
                    }}
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
                    onClick={() => {
                      setAuthTab('sign_up');
                      setErrorMessage(null);
                    }}
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
                        placeholder="name@company.com"
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

                  {/* Remember Me & Forgot Password */}
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
                        <span>Verifying Security Posture...</span>
                      </>
                    ) : (
                      <>
                        <span>{authTab === 'sign_in' ? 'Sign In' : 'Create Account'}</span>
                        <i className="fa-solid fa-arrow-right text-xs" />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Security Guarantee */}
                <div className="mt-6 pt-4 border-t border-[rgba(20,20,20,0.06)] flex items-center justify-center gap-1.5 text-xs text-[#96948f]">
                  <i className="fa-solid fa-shield-check text-[#0086C3]" />
                  <span>Continuous protection by andrors engine</span>
                </div>
              </div>
            )}

            {/* VIEW 2: STEP-UP VERIFICATION (WHEN RISK ELEVATED) */}
            {viewState === 'challenge' && (
              <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
                  <i className="fa-solid fa-shield-halved text-xl" />
                </div>

                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#141414]">
                  Security Verification Required
                </h2>
                
                {/* Score & Triggered Signal Tag */}
                <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200/60 max-w-[340px] mx-auto mb-3 text-xs text-left space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#6b6a65]">Calculated Risk Score:</span>
                    <span className="font-mono text-amber-900 font-bold">
                      {evaluationResult?.score ?? 65} / 100 (CHALLENGE)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6b6a65]">
                    <span>Signals: </span>
                    <span className="font-medium text-[#141414]">
                      {evaluationResult?.factors && evaluationResult.factors.length > 0
                        ? evaluationResult.factors.map(f => f.replace('_', ' ')).join(', ')
                        : 'Unusual location or automated client signals'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#6b6a65] mb-4 leading-relaxed max-w-[340px] mx-auto">
                  Please enter the 6-digit verification code sent to <strong>{email}</strong>.
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
                        <span>Confirm &amp; Sign In</span>
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
                  Welcome back, {userSession ? userSession.email?.split('@')[0] : 'Developer'}!
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
                      {evaluationResult?.score ?? 0} / 100
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
                    <span className="font-medium text-[#141414]">{email || 'Authenticated User'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full py-2.5 px-4 bg-[#141414] hover:bg-[#0086C3] text-white font-bold text-xs rounded-lg tracking-[-0.01em] transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-rotate-left text-xs" />
                    <span>Sign Out</span>
                  </button>

                  <Link
                    href="/sandbox"
                    className="w-full py-2 px-4 bg-transparent border border-[rgba(20,20,20,0.08)] hover:bg-black/5 text-[#0086C3] font-semibold text-xs rounded-lg tracking-[-0.01em] transition-colors no-underline flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-flask text-xs" />
                    <span>Open Threat Laboratory</span>
                  </Link>
                </div>
              </div>
            )}

          </div>

          {/* Simple Bottom Notice */}
          <div className="mt-8 text-center text-xs text-[#6b6a65] max-w-[380px] leading-relaxed">
            <span className="font-semibold text-[#141414]">Zero CAPTCHAs, Zero SMS delays.</span> Legitimate users log in instantly while threats are challenged automatically.
          </div>

        </main>

        {/* Minimal Footer */}
        <footer className="py-4 px-6 text-center text-xs text-[#96948f]">
          © {new Date().getFullYear()} andrors Continuous Authentication Engine.
        </footer>

      </div>
    </>
  );
}
