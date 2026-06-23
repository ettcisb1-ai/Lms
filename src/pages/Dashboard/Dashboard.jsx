import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, BookOpen, Video, DollarSign, CreditCard,
  XCircle, UserPlus, RefreshCw, TrendingUp, TrendingDown,
  LogIn, UploadCloud, Activity, AlertCircle
} from 'lucide-react';
import { ShimmerDashboard } from '../../components/Shimmer/Shimmer';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ADMIN_ENDPOINTS } from '../../utils/api';
import './Dashboard.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

const initials = (name) =>
  (name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const AVATAR_COLORS = ['blue', 'purple', 'pink', 'green', 'yellow', 'teal'];
const avatarColor = (name) => {
  let h = 0;
  for (const c of (name || '')) h = (h + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
};

const fmt = (n) => (n ?? 0).toLocaleString();

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon, colorClass, trend, trendUp, sub }) => (
  <div className={`db-stat-card ${colorClass}`}>
    <div className="db-stat-top">
      <div className="db-stat-icon">{icon}</div>
      {trend && (
        <span className={`db-stat-trend ${trendUp ? 'up' : 'down'}`}>
          {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend}
        </span>
      )}
    </div>
    <div className="db-stat-value">{value}</div>
    <div className="db-stat-label">{title}</div>
    {sub && <div className="db-stat-sub">{sub}</div>}
  </div>
);

const ChartCard = ({ title, subtitle, children }) => (
  <div className="db-chart-card">
    <div className="db-chart-header">
      <div>
        <h3 className="db-chart-title">{title}</h3>
        {subtitle && <p className="db-chart-sub">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const SectionTitle = ({ icon, label }) => (
  <div className="db-section-title">
    {icon}
    <span>{label}</span>
  </div>
);

const EmptyState = ({ message }) => (
  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#a0aec0', fontSize: 13 }}>
    {message}
  </div>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [activeActivity, setActiveActivity] = useState('logins');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(ADMIN_ENDPOINTS.DASHBOARD, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load dashboard');
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const activity = data?.activity || {};

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return <ShimmerDashboard />;

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="dashboard-page">
        <div className="db-header">
          <div>
            <h2 className="db-title">Dashboard</h2>
            <p className="db-subtitle">Could not load data</p>
          </div>
          <button className="db-refresh-btn" onClick={fetchDashboard}>
            <RefreshCw size={14} /><span>Retry</span>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1.25rem 1.5rem', color: '#c53030', background: '#fff5f5', borderRadius: 12, marginTop: '1rem', border: '1px solid #fed7d7' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: 14 }}>{error}</span>
        </div>
      </div>
    );
  }

  // ── Subscription breakdown for chart ──────────────────────────────────────────
  const subChartData = [
    { label: 'Active', count: stats.activeSubscriptions || 0 },
    { label: 'Expired', count: stats.expiredSubscriptions || 0 },
    { label: 'Free', count: Math.max(0, (stats.totalUsers || 0) - (stats.activeSubscriptions || 0) - (stats.expiredSubscriptions || 0)) },
  ];

  return (
    <div className="dashboard-page">

      {/* Header */}
      <div className="db-header">
        <div>
          <h2 className="db-title">Dashboard</h2>
          <p className="db-subtitle">
            {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} · Live Overview
          </p>
        </div>
        <button className="db-refresh-btn" onClick={fetchDashboard}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── 7 Stat Cards ──────────────────────────────────────────────── */}
      <div className="db-stats-grid">
        <StatCard title="Total Users" value={fmt(stats.totalUsers)} icon={<Users size={20} />} colorClass="blue" sub="registered accounts" />
        <StatCard title="Active Users" value={fmt(stats.activeUsers)} icon={<UserCheck size={20} />} colorClass="green" sub="logged in last 24h" />
        <StatCard title="Total Courses" value={fmt(stats.totalCourses)} icon={<BookOpen size={20} />} colorClass="purple" sub="in the library" />
        <StatCard title="Total Videos" value={fmt(stats.totalVideos)} icon={<Video size={20} />} colorClass="indigo" sub="in video library" />
        <StatCard title="Active Subscriptions" value={fmt(stats.activeSubscriptions)} icon={<CreditCard size={20} />} colorClass="teal" sub="paying members" />
        <StatCard title="Expired Subscriptions" value={fmt(stats.expiredSubscriptions)} icon={<XCircle size={20} />} colorClass="red" sub="need renewal" />
        <StatCard title="New Registrations" value={fmt(stats.newRegistrations)} icon={<UserPlus size={20} />} colorClass="pink" sub="last 30 days" />
        <StatCard title="Revenue" value="—" icon={<DollarSign size={20} />} colorClass="amber" sub="no payment model yet" />
      </div>

      {/* ── Charts Row 1: DAU + User Growth ───────────────────────────── */}
      <div className="db-charts-row-2">
        <ChartCard title="Daily Active Users" subtitle="Unique logins — last 8 days">
          {(charts.dailyActiveUsers || []).length === 0 ? (
            <EmptyState message="No login activity recorded in the last 8 days" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts.dailyActiveUsers} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4299e1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4299e1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf2f7" strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #edf2f7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }} cursor={{ stroke: '#4299e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="users" stroke="#4299e1" strokeWidth={2.5} fill="url(#dauGrad)" dot={{ r: 4, fill: '#4299e1' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="User Growth" subtitle="Cumulative registrations by month">
          {(charts.userGrowth || []).length === 0 ? (
            <EmptyState message="No user registration data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={charts.userGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf2f7" strokeDasharray="3 3" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Total Users']} contentStyle={{ borderRadius: 8, border: '1px solid #edf2f7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }} />
                <Line type="monotone" dataKey="total" stroke="#ed8936" strokeWidth={2.5} dot={{ r: 5, fill: '#ed8936' }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 2: Course Popularity + Subscription Breakdown ──── */}
      <div className="db-charts-row-2">
        <ChartCard title="Course Popularity" subtitle="Top 5 courses by enrolled students">
          {(charts.coursePopularity || []).length === 0 ? (
            <EmptyState message="No course enrollment data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.coursePopularity} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#edf2f7" strokeDasharray="3 3" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={110} />
                <Tooltip formatter={(v) => [v, 'Students']} contentStyle={{ borderRadius: 8, border: '1px solid #edf2f7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }} cursor={{ fill: 'rgba(72,187,120,0.08)' }} />
                <Bar dataKey="students" fill="#48bb78" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Subscription Breakdown" subtitle="Active · Expired · Free users">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={subChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#edf2f7" strokeDasharray="3 3" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0aec0', fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Users']} contentStyle={{ borderRadius: 8, border: '1px solid #edf2f7', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }} cursor={{ fill: 'rgba(159,122,234,0.08)' }} />
              <Bar dataKey="count" fill="#9f7aea" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Recent Activities ──────────────────────────────────────────── */}
      <div className="db-activity-section">
        <div className="db-activity-tabs">
          <SectionTitle icon={<Activity size={16} />} label="Recent Activity" />
          <div className="db-tab-btns">
            {[
              { key: 'logins', icon: <LogIn size={13} />, label: 'Latest Logins' },
              { key: 'videos', icon: <UploadCloud size={13} />, label: 'Videos' },
              { key: 'registrations', icon: <UserPlus size={13} />, label: 'Registrations' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`db-tab-btn ${activeActivity === tab.key ? 'active' : ''}`}
                onClick={() => setActiveActivity(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Latest Logins */}
        {activeActivity === 'logins' && (
          <div className="db-activity-list">
            {(activity.recentLogins || []).length === 0 ? (
              <EmptyState message="No login activity recorded yet" />
            ) : activity.recentLogins.map((item, i) => (
              <div key={`login-${item._id || i}-${i}`} className="db-activity-row">
                <div className={`db-avatar ${avatarColor(item.name)}`}>{initials(item.name)}</div>
                <div className="db-activity-info">
                  <span className="db-activity-name">{item.name}</span>
                  <span className="db-activity-meta">{item.email} · {item.device || 'Unknown device'}</span>
                </div>
                <span className="db-activity-time">{timeAgo(item.time)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recently Uploaded Videos */}
        {activeActivity === 'videos' && (
          <div className="db-activity-list">
            {(activity.recentVideos || []).length === 0 ? (
              <EmptyState message="No videos uploaded yet" />
            ) : activity.recentVideos.map((item, i) => (
              <div key={`video-${item._id || i}-${i}`} className="db-activity-row">
                <div className="db-video-icon"><Video size={16} /></div>
                <div className="db-activity-info">
                  <span className="db-activity-name">{item.title}</span>
                  <span className="db-activity-meta">
                    {item.course?.title || 'Unknown course'} · {item.size || 'Unknown size'}
                  </span>
                </div>
                <span className="db-activity-time">{timeAgo(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* New Registrations */}
        {activeActivity === 'registrations' && (
          <div className="db-activity-list">
            {(activity.recentRegistrations || []).length === 0 ? (
              <EmptyState message="No recent registrations" />
            ) : activity.recentRegistrations.map((item, i) => (
              <div key={`reg-${item._id || i}-${i}`} className="db-activity-row">
                <div className={`db-avatar ${avatarColor(item.name)}`}>{initials(item.name)}</div>
                <div className="db-activity-info">
                  <span className="db-activity-name">{item.name}</span>
                  <span className="db-activity-meta">{item.email}</span>
                </div>
                <span className={`db-plan-badge ${item.planType === 'Pro' ? 'pro' : 'free'}`}>
                  {item.planType || 'Free'}
                </span>
                <span className="db-activity-time">{timeAgo(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;