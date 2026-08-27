import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSupabaseBrowserClient } from '@/lib/client/supabase-browser';
import { User } from '@supabase/supabase-js';

interface LoginAttempt {
  id?: string;
  user_id: string;
  ip_address: string;
  device_fingerprint: string;
  timestamp: string;
  geographic_location: { city?: string; country?: string } | null;
  risk_score: number;
  recommendation: 'allow' | 'monitor' | 'challenge';
  factors: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginHistory, setLoginHistory] = useState<LoginAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchLoginHistory = async (userEmail: string) => {
    setHistoryLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('user_id', userEmail.toLowerCase())
        .order('timestamp', { ascending: false })
        .limit(5);
      if (data) setLoginHistory(data);
    } catch {}
    setHistoryLoading(false);
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
        return;
      }
      setUser(session.user);
      setLoading(false);
      if (session.user.email) fetchLoginHistory(session.user.email);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        setLoading(false);
        if (session.user.email) fetchLoginHistory(session.user.email);
      } else if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getRiskColor = (recommendation: string) => {
    if (recommendation === 'challenge') return 'bg-rose-100 text-rose-800';
    if (recommendation === 'monitor') return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-100 text-emerald-800';
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 51) return 'text-rose-600';
    if (score >= 21) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ece9e2] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#6b6a65] text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-[#0086C3]" />
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard — andrors</title>
        <meta name="description" content="Your andrors security dashboard — live risk history and session overview." />
      </Head>

      <div className="min-h-screen bg-[#ece9e2] text-[#141414] font-sans selection:bg-[#0086C3] selection:text-white">

        {/* Navbar */}
        <header className="py-4 px-6 max-w-[1100px] w-full mx-auto flex items-center justify-between border-b border-[rgba(20,20,20,0.06)]">
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
              <span>Threat Lab</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold text-[#6b6a65] hover:text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-none px-2 py-1.5"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-[11px]" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="max-w-[1100px] w-full mx-auto px-6 py-10 space-y-8">

          {/* Welcome + session summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0086C3]">Session Active</span>
              <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-[#141414] mt-0.5">
                Welcome back, {user?.email?.split('@')[0]}
              </h1>
              <p className="text-sm text-[#6b6a65] mt-1">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
              <i className="fa-solid fa-circle-check text-emerald-500" />
              <span>Identity Verified</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-[rgba(20,20,20,0.08)] p-5 shadow-sm space-y-1">
              <div className="text-xs font-semibold text-[#6b6a65] uppercase tracking-wider">Auth Method</div>
              <div className="text-lg font-extrabold tracking-[-0.04em] text-[#141414]">Password</div>
              <div className="text-xs text-[#96948f]">Risk-evaluated at sign-in</div>
            </div>
            <div className="bg-white rounded-xl border border-[rgba(20,20,20,0.08)] p-5 shadow-sm space-y-1">
              <div className="text-xs font-semibold text-[#6b6a65] uppercase tracking-wider">Login Events</div>
              <div className="text-lg font-extrabold tracking-[-0.04em] text-[#141414]">
                {historyLoading ? '—' : loginHistory.length}
              </div>
              <div className="text-xs text-[#96948f]">Recorded in last 5</div>
            </div>
            <div className="bg-white rounded-xl border border-[rgba(20,20,20,0.08)] p-5 shadow-sm space-y-1">
              <div className="text-xs font-semibold text-[#6b6a65] uppercase tracking-wider">Last Risk Score</div>
              <div className={`text-lg font-extrabold tracking-[-0.04em] font-mono ${
                loginHistory.length > 0 ? getRiskScoreColor(loginHistory[0].risk_score) : 'text-[#141414]'
              }`}>
                {historyLoading ? '—' : loginHistory.length > 0 ? `${loginHistory[0].risk_score} / 100` : 'No data'}
              </div>
              <div className="text-xs text-[#96948f]">Most recent evaluation</div>
            </div>
          </div>

          {/* Login history table */}
          <div className="bg-white rounded-xl border border-[rgba(20,20,20,0.08)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(20,20,20,0.06)] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold tracking-[-0.04em] text-[#141414]">Login History</h2>
                <p className="text-xs text-[#6b6a65] mt-0.5">Last 5 evaluated login attempts</p>
              </div>
              <i className="fa-solid fa-shield-halved text-[#0086C3]" />
            </div>

            {historyLoading ? (
              <div className="px-6 py-10 text-center text-sm text-[#6b6a65] flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-[#0086C3]" />
                <span>Loading history...</span>
              </div>
            ) : loginHistory.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#6b6a65]">
                <i className="fa-solid fa-clock-rotate-left text-2xl text-[#0086C3]/30 mb-3 block" />
                <p>No login history found.</p>
                <p className="text-xs mt-1 text-[#96948f]">History is recorded per-request using your email as the user ID.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(20,20,20,0.05)]">
                {loginHistory.map((attempt, i) => (
                  <div key={attempt.id || i} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#141414]">
                        {formatTimestamp(attempt.timestamp)}
                      </div>
                      <div className="text-xs text-[#6b6a65]">
                        {attempt.geographic_location?.city
                          ? `${attempt.geographic_location.city}, ${attempt.geographic_location.country}`
                          : attempt.ip_address}
                        {' · '}
                        <span className="font-mono text-[11px]">{attempt.ip_address}</span>
                      </div>
                      {attempt.factors && attempt.factors.length > 0 && (
                        <div className="text-[11px] text-[#96948f]">
                          Signals: {attempt.factors.map(f => f.replace(/_/g, ' ')).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-sm font-bold ${getRiskScoreColor(attempt.risk_score)}`}>
                        {attempt.risk_score}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${getRiskColor(attempt.recommendation)}`}>
                        {attempt.recommendation}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Engine status footer */}
          <div className="flex items-center gap-2 text-xs text-[#96948f]">
            <i className="fa-solid fa-circle text-emerald-400 text-[8px]" />
            <span>andrors continuous risk engine — active</span>
            <span className="ml-auto">
              <Link href="/sandbox" className="text-[#0086C3] hover:underline no-underline font-semibold">
                Open Threat Laboratory →
              </Link>
            </span>
          </div>

        </main>
      </div>
    </>
  );
}
