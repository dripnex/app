'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'https://api.readied.app';

interface Stats {
  users: { total: number; newLast7Days: number };
  subscriptions: Array<{ status: string; plan: string; count: number }>;
  devices: { total: number };
  sync: { totalEntries: number; last24h: number };
  sharedNotes: number;
  newsletter: number;
  timestamp: string;
}

interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  subscription: { status: string; plan: string } | null;
  deviceCount: number;
}

interface SyncData {
  recentActivity: Array<{
    userId: string;
    noteId: string;
    operation: string;
    createdAt: string;
  }>;
  dailyVolume: Array<{ day: string; count: number }>;
  tagSyncEntries: number;
  notebookSyncEntries: number;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-5 flex flex-col justify-between min-h-[120px]">
      <div className="text-[11px] font-medium text-[#52525b] uppercase tracking-wider">{label}</div>
      <div>
        <div
          className={`text-3xl font-bold tracking-tight ${accent ? 'text-accent' : 'text-[#f4f4f5]'}`}
        >
          {value}
        </div>
        {sub && <div className="text-[11px] text-[#3f3f46] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardContent() {
  const [token, setToken] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sync'>('overview');
  const [apiHealth, setApiHealth] = useState<'ok' | 'error' | 'checking'>('checking');

  const fetchAll = useCallback(async (adminToken: string) => {
    setLoading(true);
    setError('');
    const headers = { 'x-admin-token': adminToken };

    try {
      const [statsRes, usersRes, syncRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers }),
        fetch(`${API_BASE}/admin/users`, { headers }),
        fetch(`${API_BASE}/admin/sync`, { headers }),
        fetch(`${API_BASE}/health`),
      ]);

      setApiHealth(healthRes.ok ? 'ok' : 'error');

      if (!statsRes.ok) {
        setError(statsRes.status === 401 ? 'Invalid admin token' : 'Failed to fetch');
        setLoading(false);
        return;
      }

      const [statsData, usersData, syncDataRes] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        syncRes.json(),
      ]);

      setStats(statsData);
      setUsers(usersData.users);
      setSyncData(syncDataRes);
      setIsAuthed(true);
    } catch {
      setError('Connection error');
      setApiHealth('error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const saved = localStorage.getItem('readied-admin-token');
    const t = urlToken || saved || '';
    if (t) {
      setToken(t);
      localStorage.setItem('readied-admin-token', t);
      fetchAll(t);
    }
  }, [fetchAll]);

  const handleLogin = () => {
    if (!token.trim()) return;
    localStorage.setItem('readied-admin-token', token.trim());
    fetchAll(token.trim());
  };

  // ── Login screen ────────────────────────────────────────────────────────────

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#09090b]">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#f4f4f5] mb-1">Admin Dashboard</h1>
          <p className="text-sm text-[#52525b] mb-8">Enter your admin token to continue</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Admin token"
              className="flex-1 px-4 py-2.5 bg-[#18181b] border border-white/10 rounded-lg text-[#f4f4f5] text-sm focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '...' : 'Enter'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  const proCount =
    stats?.subscriptions.find(s => s.status === 'active' && s.plan === 'pro')?.count ?? 0;
  const freeCount = (stats?.users.total ?? 0) - proCount;
  const conversionRate =
    stats && stats.users.total > 0 ? ((proCount / stats.users.total) * 100).toFixed(1) : '0';

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'users' as const, label: 'Users' },
    { id: 'sync' as const, label: 'Sync' },
  ];

  const maxVolume = syncData ? Math.max(...syncData.dailyVolume.map(d => d.count), 1) : 1;

  return (
    <div className="flex min-h-screen bg-[#09090b]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0f0f11] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#f4f4f5]">readied</span>
            <span className="text-[10px] font-medium text-[#52525b] bg-[#18181b] px-1.5 py-0.5 rounded">
              admin
            </span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-white/[0.06] text-[#f4f4f5] font-medium'
                  : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-white/[0.03]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">
          {/* API Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <div
              className={`w-1.5 h-1.5 rounded-full ${apiHealth === 'ok' ? 'bg-emerald-400' : apiHealth === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`}
            />
            <span className="text-[#52525b]">
              API {apiHealth === 'ok' ? 'Healthy' : apiHealth === 'error' ? 'Down' : '...'}
            </span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('readied-admin-token');
              setIsAuthed(false);
              setToken('');
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-[#3f3f46] hover:text-[#71717a] transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-bold text-[#f4f4f5] tracking-tight">
                {activeTab === 'overview'
                  ? 'Overview'
                  : activeTab === 'users'
                    ? 'Users'
                    : 'Sync Activity'}
              </h1>
              <p className="text-xs text-[#3f3f46] mt-1">
                {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : ''}
              </p>
            </div>
            <button
              onClick={() => fetchAll(token)}
              disabled={loading}
              className="px-3 py-1.5 bg-[#18181b] border border-white/[0.06] rounded-lg text-xs text-[#71717a] hover:text-[#f4f4f5] hover:border-white/10 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Refresh'}
            </button>
          </div>

          {/* ── Overview Tab ───────────────────────────────────────────────────── */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard
                  label="Total Users"
                  value={stats.users.total}
                  sub={`+${stats.users.newLast7Days} this week`}
                />
                <StatCard label="Pro" value={proCount} accent />
                <StatCard label="Free" value={freeCount} />
                <StatCard label="Conversion" value={`${conversionRate}%`} sub="free → pro" />
                <StatCard label="Devices" value={stats.devices.total} />
              </div>

              {/* Second row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Sync (24h)"
                  value={stats.sync.last24h}
                  sub={`${stats.sync.totalEntries} total`}
                />
                <StatCard label="Shared Notes" value={stats.sharedNotes} />
                <StatCard label="Newsletter" value={stats.newsletter} sub="subscribers" />
                <StatCard
                  label="Tag + Notebook Sync"
                  value={(syncData?.tagSyncEntries ?? 0) + (syncData?.notebookSyncEntries ?? 0)}
                  sub={`${syncData?.tagSyncEntries ?? 0} tags, ${syncData?.notebookSyncEntries ?? 0} notebooks`}
                />
              </div>

              {/* Sync volume chart */}
              {syncData && syncData.dailyVolume.length > 0 && (
                <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-6">
                  <div className="text-[11px] font-medium text-[#52525b] uppercase tracking-wider mb-6">
                    Sync Volume — Last 7 Days
                  </div>
                  <div className="flex items-end gap-2 h-40">
                    {syncData.dailyVolume.map(d => {
                      const pct = (d.count / maxVolume) * 100;
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                          <div className="text-xs text-[#52525b] tabular-nums font-medium">
                            {d.count}
                          </div>
                          <div
                            className="w-full bg-accent rounded-t-md transition-all min-h-[4px]"
                            style={{ height: `${Math.max(pct, 3)}%` }}
                          />
                          <div className="text-[10px] text-[#3f3f46]">
                            {new Date(d.day + 'T12:00').toLocaleDateString('en', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com', icon: '💳' },
                  { label: 'Cloudflare Workers', url: 'https://dash.cloudflare.com', icon: '⚡' },
                  {
                    label: 'Turso Database',
                    url: 'https://app.turso.tech',
                    icon: '🗄️',
                  },
                  {
                    label: 'Vercel Deploys',
                    url: 'https://vercel.com/indiehacklab/readide',
                    icon: '▲',
                  },
                ].map(link => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#18181b] border border-white/[0.06] text-sm text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-white/10 transition-colors"
                  >
                    <span className="text-base">{link.icon}</span>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Users Tab ──────────────────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <div className="rounded-xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">
                  All Users ({users.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-5 py-3 text-[#3f3f46] font-medium text-xs">
                        Email
                      </th>
                      <th className="text-left px-5 py-3 text-[#3f3f46] font-medium text-xs">
                        Plan
                      </th>
                      <th className="text-left px-5 py-3 text-[#3f3f46] font-medium text-xs">
                        Devices
                      </th>
                      <th className="text-left px-5 py-3 text-[#3f3f46] font-medium text-xs">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr
                        key={u.id}
                        className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors"
                      >
                        <td className="px-5 py-3 text-[#e4e4e7] font-medium">{u.email}</td>
                        <td className="px-5 py-3">
                          {u.subscription ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                                u.subscription.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-[#27272a] text-[#52525b]'
                              }`}
                            >
                              {u.subscription.status === 'active' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              )}
                              {u.subscription.plan}
                            </span>
                          ) : (
                            <span className="text-[#3f3f46] text-xs">Free</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[#71717a] tabular-nums">{u.deviceCount}</td>
                        <td className="px-5 py-3 text-[#52525b] tabular-nums">
                          {new Date(u.createdAt).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Sync Tab ───────────────────────────────────────────────────────── */}
          {activeTab === 'sync' && syncData && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Note Syncs" value={syncData.recentActivity.length} sub="recent" />
                <StatCard label="Tag Syncs" value={syncData.tagSyncEntries} />
                <StatCard label="Notebook Syncs" value={syncData.notebookSyncEntries} />
              </div>

              <div className="rounded-xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.06]">
                  <span className="text-xs font-medium text-[#52525b] uppercase tracking-wider">
                    Recent Sync Activity
                  </span>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {syncData.recentActivity.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#3f3f46] text-sm">
                      No sync activity yet
                    </div>
                  ) : (
                    syncData.recentActivity.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-5 py-2.5 border-b border-white/[0.03] text-sm hover:bg-white/[0.01]"
                      >
                        <span
                          className={`inline-flex items-center justify-center w-16 text-[11px] font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 ${
                            entry.operation === 'create'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : entry.operation === 'delete'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {entry.operation}
                        </span>
                        <span className="text-[#52525b] font-mono text-xs truncate flex-1">
                          {entry.noteId.slice(0, 8)}...
                        </span>
                        <span className="text-[#3f3f46] text-xs whitespace-nowrap tabular-nums">
                          {new Date(entry.createdAt).toLocaleString('en', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
