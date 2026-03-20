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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-5">
      <div className="text-xs font-medium text-[#71717a] uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold text-[#f4f4f5] tracking-tight">{value}</div>
      {sub && <div className="text-xs text-[#52525b] mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardContent() {
  const [token, setToken] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sync'>('overview');

  const fetchAll = useCallback(async (adminToken: string) => {
    setLoading(true);
    setError('');
    const headers = { 'x-admin-token': adminToken };

    try {
      const [statsRes, usersRes, syncRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers }),
        fetch(`${API_BASE}/admin/users`, { headers }),
        fetch(`${API_BASE}/admin/sync`, { headers }),
      ]);

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
    }
    setLoading(false);
  }, []);

  // Auto-auth from URL param or localStorage
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

  if (!isAuthed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[#f4f4f5] mb-6 text-center">Dashboard</h1>
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
          {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  const proCount =
    stats?.subscriptions.find(s => s.status === 'active' && s.plan === 'pro')?.count ?? 0;

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'users' as const, label: 'Users' },
    { id: 'sync' as const, label: 'Sync' },
  ];

  const maxVolume = syncData ? Math.max(...syncData.dailyVolume.map(d => d.count), 1) : 1;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">Dashboard</h1>
          <p className="text-sm text-[#52525b] mt-1">
            Last updated: {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : '—'}
          </p>
        </div>
        <button
          onClick={() => fetchAll(token)}
          className="px-4 py-2 bg-[#18181b] border border-white/10 rounded-lg text-sm text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#18181b] rounded-lg mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#27272a] text-[#f4f4f5]'
                : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            <StatCard
              label="Total Users"
              value={stats.users.total}
              sub={`+${stats.users.newLast7Days} this week`}
            />
            <StatCard label="Pro Subscribers" value={proCount} />
            <StatCard label="Devices" value={stats.devices.total} />
            <StatCard
              label="Sync (24h)"
              value={stats.sync.last24h}
              sub={`${stats.sync.totalEntries} total`}
            />
            <StatCard label="Shared Notes" value={stats.sharedNotes} />
            <StatCard label="Newsletter" value={stats.newsletter} sub="subscribers" />
          </div>

          {/* Sync volume chart */}
          {syncData && syncData.dailyVolume.length > 0 && (
            <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-5">
              <div className="text-xs font-medium text-[#71717a] uppercase tracking-wider mb-4">
                Sync Volume (7 days)
              </div>
              <div className="flex items-end gap-1 h-32">
                {syncData.dailyVolume.map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-[#52525b] tabular-nums">{d.count}</div>
                    <div
                      className="w-full bg-accent/80 rounded-sm min-h-[2px]"
                      style={{ height: `${(d.count / maxVolume) * 100}%` }}
                    />
                    <div className="text-[10px] text-[#52525b]">
                      {new Date(d.day + 'T00:00').toLocaleDateString('en', { weekday: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="rounded-xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs uppercase tracking-wider">
                  Devices
                </th>
                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[#f4f4f5]">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.subscription ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          u.subscription.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-[#27272a] text-[#71717a]'
                        }`}
                      >
                        {u.subscription.plan} ({u.subscription.status})
                      </span>
                    ) : (
                      <span className="text-[#52525b]">Free</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#a1a1aa]">{u.deviceCount}</td>
                  <td className="px-4 py-3 text-[#71717a]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sync */}
      {activeTab === 'sync' && syncData && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Note Syncs" value={syncData.recentActivity.length} sub="recent" />
            <StatCard label="Tag Syncs" value={syncData.tagSyncEntries} />
            <StatCard label="Notebook Syncs" value={syncData.notebookSyncEntries} />
          </div>

          <div className="rounded-xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-medium text-[#71717a] uppercase tracking-wider">
                Recent Activity
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {syncData.recentActivity.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-2.5 border-b border-white/[0.03] text-sm"
                >
                  <span
                    className={`w-16 text-xs font-medium ${
                      entry.operation === 'create'
                        ? 'text-emerald-400'
                        : entry.operation === 'delete'
                          ? 'text-red-400'
                          : 'text-blue-400'
                    }`}
                  >
                    {entry.operation}
                  </span>
                  <span className="text-[#71717a] font-mono text-xs truncate flex-1">
                    {entry.noteId}
                  </span>
                  <span className="text-[#52525b] text-xs whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
