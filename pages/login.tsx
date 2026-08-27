import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSupabaseBrowserClient } from '@/lib/client/supabase-browser';
import { generateEnhancedFingerprint } from '@/lib/fingerprint/device-fingerprint';
import {
  startBehavioralCollection,
  stopBehavioralCollection,
  captureSubmitTrust,
} from '@/lib/fingerprint/behavioral-dynamics';
import { solvePow, generateChallenge } from '@/lib/crypto/pow-challenge';

interface EvaluationResult {
  score: number;
  recommendation: string;
  factors: string[];
  explanation: string;
  speedMs: number;
}

export default function LoginPage() {
  const router = useRouter();
  const [authTab, setAuthTab] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [viewState, setViewState] = useState<'form' | 'challenge'>('form');
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) router.replace('/dashboard');
      });
    } catch {}
    startBehavioralCollection();
    return () => stopBehavioralCollection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    captureSubmitTrust(e);
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    const startTime = performance.now();

    try {
      let fingerprint = 'fp_browser_client';
      try {
        if (typeof window !== 'undefined') {
          fingerprint = await generateEnhancedFingerprint();
        }
      } catch {}

      const powChallenge = generateChallenge(email.trim().toLowerCase() || 'anonymous');
      let powNonce = 0;
      let powSolution = '';
      try {
        const solved = await solvePow(powChallenge);
        if (solved) { powNonce = solved.nonce; powSolution = solved.solution; }
      } catch {}

      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: email.trim().toLowerCase(),
          ipAddress: 'auto',
          deviceFingerprint: fingerprint,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          powChallenge, powNonce, powSolution,
        }),
      });

      const verifyData = await verifyResponse.json();
      const speed = Math.round(performance.now() - startTime);
      const outcome = (verifyData.recommendation as 'allow' | 'monitor' | 'challenge') || 'allow';

      setEvaluationResult({
        score: verifyData.riskScore ?? 0,
        recommendation: outcome,
        factors: verifyData.factors || [],
        explanation: verifyData.explanation || 'Evaluated in real-time by andrors engine.',
        speedMs: Math.max(speed, 12),
      });

      if (outcome === 'challenge') {
        const supabase = getSupabaseBrowserClient();
        const redirectUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard`
          : undefined;

        const { error: linkError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: redirectUrl },
        });

        if (linkError) {
          setErrorMessage('Could not send verification link. Please try again.');
          setLoading(false);
          return;
        }

        setLoading(false);
        setViewState('challenge');
        return;
      }

      const supabase = getSupabaseBrowserClient();

      if (authTab === 'sign_in') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) { setLoading(false); setErrorMessage(error.message); return; }
        if (data?.user) {
          router.push('/dashboard');
          return;
        }
      } else {
        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) { setLoading(false); setErrorMessage(error.message); return; }
        if (data?.session) { router.push('/dashboard'); return; }
        if (data?.user && !data.session) {
          setLoading(false);
          setSuccessNotice('Account created! Check your email to confirm your address before signing in.');
          return;
        }
      }

      setLoading(false);
    } catch {
      setLoading(false);
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };

  const handleResendMagicLink = async () => {
    setIsSendingLink(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard`
        : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) setErrorMessage('Failed to resend link. Please try again.');
      else setSuccessNotice('A new link has been sent to your email.');
    } catch {
      setErrorMessage('Failed to resend link. Please try again.');
    } finally {
      setIsSendingLink(false);
    }
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

            {/* VIEW 2: MAGIC LINK WAITING SCREEN (HIGH RISK) */}
            {viewState === 'challenge' && (
              <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
                  <i className="fa-solid fa-envelope-circle-check text-xl" />
                </div>

                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#141414]">Check Your Email</h2>

                {/* Risk score context box */}
                <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200/60 max-w-[340px] mx-auto my-4 text-xs text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6b6a65] font-medium">Risk Score:</span>
                    <span className="font-mono text-amber-900 font-bold">
                      {evaluationResult?.score ?? 65} / 100 — Step-Up Required
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6b6a65]">
                    <span>Signals: </span>
                    <span className="font-medium text-[#141414]">
                      {evaluationResult?.factors && evaluationResult.factors.length > 0
                        ? evaluationResult.factors.map(f => f.replace(/_/g, ' ')).join(', ')
                        : 'Unusual conditions detected'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#6b6a65] mb-1.5 leading-relaxed max-w-[320px] mx-auto">
                  andrors detected elevated risk for this login attempt. A secure sign-in link has been sent to:
                </p>
                <p className="text-sm font-bold text-[#141414] mb-5">{email}</p>
                <p className="text-xs text-[#96948f] mb-6 leading-relaxed max-w-[300px] mx-auto">
                  Click the link in your email to complete sign-in. This page will remain open.
                </p>

                {errorMessage && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successNotice && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500" />
                    <span>{successNotice}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleResendMagicLink}
                    disabled={isSendingLink}
                    className="w-full py-2.5 px-4 bg-[#141414] hover:bg-[#0086C3] text-white font-bold text-xs rounded-lg tracking-[-0.01em] transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                  >
                    {isSendingLink ? (
                      <><i className="fa-solid fa-circle-notch fa-spin text-sm" /><span>Sending...</span></>
                    ) : (
                      <><i className="fa-solid fa-rotate-right text-xs" /><span>Resend Link</span></>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewState('form'); setErrorMessage(null); setSuccessNotice(null); }}
                    className="text-xs text-[#96948f] hover:text-[#141414] cursor-pointer bg-transparent border-none p-1 transition-colors"
                  >
                    ← Use a different email
                  </button>
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
