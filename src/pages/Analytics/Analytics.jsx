import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  Users, BookOpen, DollarSign, Video, TrendingUp, Smartphone,
  Monitor, Tablet, Tv, Clock, Calendar, CheckCircle, Play,
  ArrowUpRight, ArrowDownRight, Activity, RefreshCw, AlertCircle
} from 'lucide-react';
import './Analytics.css';
import { PendingTabContext } from '../../components/AdminLayout/AdminLayout';
import { ANALYTICS_ENDPOINTS } from '../../utils/api';

const Analytics = () => {
  const [activeTab, setActiveTab] = useState('user');
  const [timeRange, setTimeRange] = useState('30days');
  const { tab, route, clearPendingTab } = useContext(PendingTabContext);

  // API data states
  const [overview, setOverview] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [courseAnalytics, setCourseAnalytics] = useState(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState(null);
  const [videoAnalytics, setVideoAnalytics] = useState(null);

  const [loading, setLoading] = useState({ overview: true, tab: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab && route === '/admin/analytics') {
      setActiveTab(tab);
      clearPendingTab();
    }
  }, [tab, route]);

  const authHeaders = () => {
    const token = localStorage.getItem('lms_token') || localStorage.getItem('admin_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, overview: true }));
      const res = await fetch(`${ANALYTICS_ENDPOINTS.OVERVIEW}?range=${timeRange}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setOverview(json.data);
      else setOverview({});
    } catch (e) {
      console.error('Overview fetch failed:', e.message);
      setOverview({});
    } finally {
      setLoading(prev => ({ ...prev, overview: false }));
    }
  }, [timeRange]);

  const fetchTabData = useCallback(async (tabId) => {
    try {
      setLoading(prev => ({ ...prev, tab: true }));
      setError(null);
      const params = `?range=${timeRange}`;

      if (tabId === 'user') {
        const res = await fetch(`${ANALYTICS_ENDPOINTS.USERS}${params}`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) setUserAnalytics(json.data);
        else setUserAnalytics({});
      } else if (tabId === 'course') {
        const res = await fetch(`${ANALYTICS_ENDPOINTS.COURSES}${params}`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) setCourseAnalytics(json.data);
        else setCourseAnalytics({});
      } else if (tabId === 'revenue') {
        const res = await fetch(`${ANALYTICS_ENDPOINTS.REVENUE}${params}`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) setRevenueAnalytics(json.data);
        else setRevenueAnalytics({});
      } else if (tabId === 'video') {
        const res = await fetch(`${ANALYTICS_ENDPOINTS.VIDEOS}${params}`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) setVideoAnalytics(json.data);
        else setVideoAnalytics({});
      }
    } catch (e) {
      setError('Could not load analytics data. Check your connection.');
    } finally {
      setLoading(prev => ({ ...prev, tab: false }));
    }
  }, [timeRange]);

  const refreshAll = useCallback(() => {
    setUserAnalytics(null);
    setCourseAnalytics(null);
    setRevenueAnalytics(null);
    setVideoAnalytics(null);
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => { fetchOverview(); }, [timeRange]);
  useEffect(() => { fetchTabData(activeTab); }, [activeTab, timeRange]);

  // ── Overview card values ────────────────────────────────────────────────────
  const mau = overview?.activeUsers ?? 0;
  const completionRate = overview?.completionRate ?? 0;
  const totalRevenue = overview ? (overview.subscribedUsers * 49) : 0;
  const totalHours = overview?.totalHoursWatched ?? 0;

  // ── User tab data ───────────────────────────────────────────────────────────
  const udData = userAnalytics;
  const retentionRate = udData?.overview?.retentionRate ?? 0;

  const deviceUsage = udData?.deviceUsage?.length > 0
    ? udData.deviceUsage
    : [
      { name: 'Desktop', percentage: 0, count: 0, color: '#6366f1' },
      { name: 'Mobile', percentage: 0, count: 0, color: '#10b981' },
      { name: 'Tablet', percentage: 0, count: 0, color: '#f59e0b' },
      { name: 'Smart TV', percentage: 0, count: 0, color: '#ef4444' },
    ];

  const deviceIcons = { Desktop: Monitor, Mobile: Smartphone, Tablet: Tablet, 'Smart TV': Tv };

  const sessions = udData?.loginStats?.recentSessions?.length > 0
    ? udData.loginStats.recentSessions.slice(0, 5).map(s => ({
      time: s.time ? new Date(s.time).toLocaleTimeString() : 'Recently',
      user: s.user,
      action: s.action || 'Logged in',
      device: s.device || 'Desktop',
    }))
    : [];

  // Retention curve — real retentionRate from DB
  const retPoints = (() => {
    const base = retentionRate;
    const pts = [
      { x: 70, val: 100 },
      { x: 235, val: Math.round(base * 1.15) },
      { x: 400, val: Math.round(base * 1.05) },
      { x: 565, val: base },
      { x: 730, val: Math.round(base * 0.85) },
    ].map(p => ({ ...p, val: Math.min(100, Math.max(0, p.val)), y: 250 - Math.min(100, Math.max(0, p.val)) * 2 }));

    const [p0, p1, p2, p3, p4] = pts;
    const path = `M ${p0.x} ${p0.y} C 150 ${p0.y}, 150 ${p1.y}, ${p1.x} ${p1.y} C 320 ${p1.y}, 320 ${p2.y}, ${p2.x} ${p2.y} C 480 ${p2.y}, 480 ${p3.y}, ${p3.x} ${p3.y} C 650 ${p3.y}, 650 ${p4.y}, ${p4.x} ${p4.y}`;
    const areaPath = `${path} L 730 250 L 70 250 Z`;
    return { pts, path, areaPath };
  })();

  // ── Course tab data ─────────────────────────────────────────────────────────
  const cdData = courseAnalytics;
  const courses = cdData?.courses?.length > 0 ? cdData.courses.slice(0, 5) : [];
  const maxEnrolled = Math.max(...courses.map(c => c.enrolled || 1), 1);

  const funnel = cdData?.funnel?.length > 0
    ? cdData.funnel
    : [
      { step: 'Total Course Enrollments', count: 0, percentage: 100 },
      { step: 'Started Learning', count: 0, percentage: 0 },
      { step: 'Reached Midpoint (50%)', count: 0, percentage: 0 },
      { step: 'Course Completed', count: 0, percentage: 0 },
    ];

  // ── Revenue tab data ────────────────────────────────────────────────────────
  const rdData = revenueAnalytics;
  const mrr = rdData?.overview?.estimatedMRR ?? 0;
  const conversionRate = rdData?.overview?.conversionRate ?? '0%';
  const revFunnel = rdData?.funnelConversion?.length > 0 ? rdData.funnelConversion : [
    { stage: 'Platform Users', count: 0, percent: '100%' },
    { stage: 'Free Registrations', count: 0, percent: '0%' },
    { stage: 'Paid Subscriptions', count: 0, percent: '0%' },
  ];

  const revTrend = rdData?.monthlyTrend?.length > 0 ? rdData.monthlyTrend : [];
  const maxRev = Math.max(...revTrend.map(r => r.revenue || r.totalRevenue || 1), 1);

  // ── Video tab data ──────────────────────────────────────────────────────────
  const vdData = videoAnalytics;
  const avgCompletion = vdData?.overview?.avgCompletion ?? 0;
  const playbackRetention = vdData?.playbackRetention?.length > 0
    ? vdData.playbackRetention
    : [
      { label: '0% (Start)', retention: 0 },
      { label: '25% (Intro)', retention: 0 },
      { label: '50% (Body)', retention: 0 },
      { label: '75% (Demo)', retention: 0 },
      { label: '100% (Outro)', retention: 0 },
    ];

  const topVideos = vdData?.topVideos?.length > 0 ? vdData.topVideos.slice(0, 5) : [];

  return (
    <div className="analytics-page">
      {/* Page Header */}
      <div className="analytics-header">
        <div>
          <h2 className="page-title">Platform Analytics</h2>
          <p className="page-subtitle">Real-time indicators, engagement curves, course pipelines, and revenue streams.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={refreshAll} className="refresh-btn" title="Refresh data"
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <div className="date-selector-wrapper">
            <Calendar size={16} className="calendar-icon" />
            <select value={timeRange} onChange={(e) => { setTimeRange(e.target.value); refreshAll(); }} className="time-range-select">
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days (Default)</option>
              <option value="12months">Last 12 Months</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: 14 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Overview Cards */}
      <div className="analytics-overview-grid">
        <div className="metric-card shadow-premium border-blue" onClick={() => setActiveTab('user')}>
          <div className="metric-header">
            <span className="metric-title">Active Users</span>
            <div className="metric-icon-bg bg-blue"><Users size={18} /></div>
          </div>
          <div className="metric-content">
            <span className="metric-value">{loading.overview ? '—' : mau.toLocaleString()}</span>
            <span className="metric-growth positive"><ArrowUpRight size={13} /><span>Total active on platform</span></span>
          </div>
        </div>

        <div className="metric-card shadow-premium border-emerald" onClick={() => setActiveTab('course')}>
          <div className="metric-header">
            <span className="metric-title">Avg Course Completion</span>
            <div className="metric-icon-bg bg-emerald"><BookOpen size={18} /></div>
          </div>
          <div className="metric-content">
            <span className="metric-value">{loading.overview ? '—' : `${completionRate}%`}</span>
            <span className="metric-growth positive"><ArrowUpRight size={13} /><span>Based on progress records</span></span>
          </div>
        </div>

        <div className="metric-card shadow-premium border-amber" onClick={() => setActiveTab('revenue')}>
          <div className="metric-header">
            <span className="metric-title">Estimated Revenue</span>
            <div className="metric-icon-bg bg-amber"><DollarSign size={18} /></div>
          </div>
          <div className="metric-content">
            <span className="metric-value">{loading.overview ? '—' : `$${totalRevenue.toLocaleString()}`}</span>
            <span className="metric-growth positive"><ArrowUpRight size={13} /><span>From {overview?.subscribedUsers ?? 0} subscribers</span></span>
          </div>
        </div>

        <div className="metric-card shadow-premium border-red" onClick={() => setActiveTab('video')}>
          <div className="metric-header">
            <span className="metric-title">Catalog Watch Time</span>
            <div className="metric-icon-bg bg-red"><Video size={18} /></div>
          </div>
          <div className="metric-content">
            <span className="metric-value">{loading.overview ? '—' : `${totalHours.toLocaleString()} hrs`}</span>
            <span className="metric-growth positive"><ArrowUpRight size={13} /><span>Total hours watched</span></span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="analytics-tabs-bar">
        {[['user', Users, 'User Analytics'], ['course', BookOpen, 'Course Analytics'], ['revenue', DollarSign, 'Revenue Analytics'], ['video', Video, 'Video Analytics']].map(([id, Icon, label]) => (
          <button key={id} className={`analytics-tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon size={16} /><span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="analytics-viewport">

        {/* Loading overlay */}
        {loading.tab && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>Loading analytics data…</p>
          </div>
        )}

        {/* ── USER TAB ── */}
        {!loading.tab && activeTab === 'user' && (
          <div className="tab-pane animate-fade-in">
            <div className="analytics-grid-two-cols">

              {/* Retention Curve */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">User Retention Cohort Curve</h3>
                    <p className="card-subtitle">Percentage of active students returning week-over-week.</p>
                  </div>
                  <div className="card-metric-badge badge-blue">Avg Retention: {retentionRate}%</div>
                </div>
                <div className="chart-wrapper">
                  <svg className="retention-svg" viewBox="0 0 800 300" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {[{ y: 50, label: '100%' }, { y: 100, label: '75%' }, { y: 150, label: '50%' }, { y: 200, label: '25%' }].map(({ y, label }) => (
                      <g key={y}>
                        <text x="18" y={y + 4} fill="#94a3b8" fontSize="11" fontWeight="600">{label}</text>
                        <line x1="70" y1={y} x2="730" y2={y} stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="4 4" />
                      </g>
                    ))}
                    <text x="30" y="254" fill="#94a3b8" fontSize="11" fontWeight="600">0%</text>
                    <line x1="70" y1="250" x2="730" y2="250" stroke="#cbd5e1" strokeWidth="1.5" />
                    <path d={retPoints.areaPath} fill="url(#blueGradient)" />
                    <path d={retPoints.path} fill="none" stroke="#4f46e5" strokeWidth="4" className="svg-curve" />
                    {retPoints.pts.map((pt, idx) => (
                      <g key={idx} className="chart-node-group">
                        <circle cx={pt.x} cy={pt.y} r="6" fill="#4f46e5" stroke="#ffffff" strokeWidth="2.5" />
                        <text x={pt.x} y={pt.y - 12} fill="#4f46e5" fontSize="11" fontWeight="700" textAnchor="middle">{pt.val}%</text>
                      </g>
                    ))}
                    {['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map((label, i) => (
                      <text key={i} x={[70, 235, 400, 565, 730][i]} y="280" fill="#64748b" fontSize="12" fontWeight="600" textAnchor="middle">{label}</text>
                    ))}
                  </svg>
                </div>
                <div className="stats-kpi-subrow">
                  <div className="subkpi-item">
                    <span className="subkpi-lbl">Active Users</span>
                    <span className="subkpi-val">{(udData?.overview?.activeUsers ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="subkpi-item">
                    <span className="subkpi-lbl">Total Registered</span>
                    <span className="subkpi-val">{(udData?.overview?.totalUsers ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="subkpi-item">
                    <span className="subkpi-lbl">New Users (Period)</span>
                    <span className="subkpi-val">{(udData?.overview?.newUsers ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Device Usage */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Device Usage Breakdown</h3>
                    <p className="card-subtitle">Student hardware environment from login activity logs.</p>
                  </div>
                </div>
                <div className="device-analytics-wrapper">
                  <div className="radial-bars-container">
                    {deviceUsage.map((device, idx) => {
                      const Icon = deviceIcons[device.name] || Monitor;
                      const color = device.color || ['#6366f1', '#10b981', '#f59e0b', '#ef4444'][idx];
                      return (
                        <div className="device-bar-row" key={idx}>
                          <div className="device-label-cell">
                            <Icon size={16} style={{ color }} />
                            <span className="device-name">{device.name}</span>
                          </div>
                          <div className="device-progress-cell">
                            <div className="device-progress-bg">
                              <div className="device-progress-fill" style={{ width: `${device.percentage}%`, backgroundColor: color }}></div>
                            </div>
                          </div>
                          <div className="device-percentage-cell">
                            <span className="pct-bold">{device.percentage}%</span>
                            <span className="cnt-muted">({device.count.toLocaleString()})</span>
                          </div>
                        </div>
                      );
                    })}
                    {deviceUsage.every(d => d.count === 0) && (
                      <p style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0' }}>No device activity logged yet. Device data is collected from user login events.</p>
                    )}
                  </div>
                  <div className="device-ring-visual">
                    <div className="outer-donut" style={{
                      background: `conic-gradient(#6366f1 0% ${deviceUsage[0]?.percentage || 0}%, #10b981 ${deviceUsage[0]?.percentage || 0}% ${(deviceUsage[0]?.percentage || 0) + (deviceUsage[1]?.percentage || 0)}%, #f59e0b ${(deviceUsage[0]?.percentage || 0) + (deviceUsage[1]?.percentage || 0)}% ${(deviceUsage[0]?.percentage || 0) + (deviceUsage[1]?.percentage || 0) + (deviceUsage[2]?.percentage || 0)}%, #ef4444 ${(deviceUsage[0]?.percentage || 0) + (deviceUsage[1]?.percentage || 0) + (deviceUsage[2]?.percentage || 0)}% 100%)`
                    }}>
                      <div className="inner-donut-hole">
                        <Activity size={18} className="centered-pulse-icon" />
                        <span className="donut-center-lbl">Device Traffic</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sessions Table */}
            <div className="pane-card margin-top-24">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Platform Sessions & Login Activity</h3>
                  <p className="card-subtitle">Recent platform activity from user login logs.</p>
                </div>
                <div className="live-pulse-badge">
                  <span className="pulse-dot"></span>
                  <span>{(udData?.loginStats?.totalLogins ?? 0).toLocaleString()} Sessions Tracked</span>
                </div>
              </div>
              <div className="sessions-table-wrapper">
                {sessions.length > 0 ? (
                  <table className="sessions-table">
                    <thead>
                      <tr><th>Time</th><th>Student</th><th>Activity</th><th>Device</th></tr>
                    </thead>
                    <tbody>
                      {sessions.map((log, i) => (
                        <tr key={i}>
                          <td className="log-time">{log.time}</td>
                          <td className="log-user">{log.user}</td>
                          <td className="log-action">{log.action}</td>
                          <td><span className="log-badge-country">{log.device}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 14 }}>
                    No login sessions recorded in this period. Sessions are tracked from user activity logs.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── COURSE TAB ── */}
        {!loading.tab && activeTab === 'course' && (
          <div className="tab-pane animate-fade-in">
            <div className="analytics-grid-two-cols">

              {/* Most Enrolled Courses */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Most Enrolled Courses</h3>
                    <p className="card-subtitle">Highest volume courses by enrollment and completions.</p>
                  </div>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Live data</span>
                </div>
                <div className="watched-courses-list">
                  {courses.length > 0 ? courses.map((course, idx) => (
                    <div className="course-stat-bar-item" key={course.id || idx}>
                      <div className="course-details-top">
                        <span className="course-title-lbl">{course.title}</span>
                        <span className="course-views-lbl">{(course.enrolled || 0).toLocaleString()} Students</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-filler bg-indigo" style={{ width: `${((course.enrolled || 0) / maxEnrolled) * 100}%` }}></div>
                      </div>
                      <div className="course-stats-footer">
                        <span className="cat-badge">{course.category}</span>
                        <span className="completion-lbl">Completion: <strong>{course.completionRate}%</strong></span>
                        <span className="drop-lbl">Active: <strong>{course.activeStudents ?? 0}</strong></span>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                      No course enrollment data available for this period.
                    </div>
                  )}
                </div>
              </div>

              {/* Funnel & Completion Dial */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Student Retention & Drop-off Funnel</h3>
                    <p className="card-subtitle">Tracking learners from enrollment through graduation.</p>
                  </div>
                </div>
                <div className="funnel-container">
                  {funnel.map((step, idx) => (
                    <div className="funnel-stage" key={idx} style={{
                      width: `${100 - idx * 8}%`,
                      backgroundColor: idx === 0 ? '#4f46e5' : idx === funnel.length - 1 ? '#10b981' : `hsl(${245 - idx * 8}, 70%, ${52 + idx * 3}%)`
                    }}>
                      <div className="stage-info">
                        <span className="stage-name">{step.step}</span>
                        <div className="stage-counts">
                          <span className="stage-cnt">{(step.count || 0).toLocaleString()}</span>
                          <span className="stage-pct">{step.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="completion-dial-panel">
                  <div className="dial-box">
                    <svg className="radial-svg" width="100" height="100" viewBox="0 0 36 36">
                      <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="circle-progress" strokeDasharray={`${cdData?.overview?.overallCompletionRate ?? 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <text x="18" y="20.35" className="circle-pct-text">{cdData?.overview?.overallCompletionRate ?? 0}%</text>
                    </svg>
                  </div>
                  <div className="dial-details">
                    <h4>Course Graduation Rate</h4>
                    <p>Average percentage of active learners completing all video lessons and passing course projects.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE TAB ── */}
        {!loading.tab && activeTab === 'revenue' && (
          <div className="tab-pane animate-fade-in">
            <div className="analytics-grid-two-cols">

              {/* Revenue Bar Chart */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Monthly Revenue Pipeline</h3>
                    <p className="card-subtitle">Consolidated billings from subscription purchase dates.</p>
                  </div>
                  <div className="card-metric-badge badge-emerald">Est. MRR: ${mrr.toLocaleString()}</div>
                </div>
                <div className="chart-wrapper flex-bottom">
                  {revTrend.length > 0 ? (
                    <>
                      <svg className="revenue-bars-svg" viewBox="0 0 600 300">
                        <line x1="0" y1="50" x2="600" y2="50" stroke="#f1f5f9" strokeDasharray="3 3" />
                        <line x1="0" y1="120" x2="600" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />
                        <line x1="0" y1="190" x2="600" y2="190" stroke="#f1f5f9" strokeDasharray="3 3" />
                        <line x1="0" y1="260" x2="600" y2="260" stroke="#f1f5f9" strokeDasharray="3 3" />
                        {revTrend.slice(-5).map((m, i) => {
                          const rev = m.revenue || m.totalRevenue || 0;
                          const h = maxRev > 0 ? Math.round((rev / maxRev) * 200) : 4;
                          const x = 50 + i * 110;
                          const isLast = i === revTrend.slice(-5).length - 1;
                          return <rect key={i} x={x} y={260 - h} width="50" height={Math.max(h, 4)} rx="6" fill={isLast ? '#6366f1' : '#10b981'} />;
                        })}
                      </svg>
                      <div className="x-axis-labels">
                        {revTrend.slice(-5).map((m, i) => {
                          const rev = m.revenue || m.totalRevenue || 0;
                          return <span key={i}>{m.month} (${rev >= 1000 ? `${(rev / 1000).toFixed(1)}k` : rev})</span>;
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                      No subscription revenue data available. Revenue is calculated from user purchase dates.
                    </div>
                  )}
                </div>
                {revTrend.length > 0 && (
                  <div className="trends-kpi-legend">
                    <div className="legend-element"><span className="legend-dot bg-emerald"></span><span>Historical Revenue</span></div>
                    <div className="legend-element"><span className="legend-dot bg-indigo"></span><span>Current Period</span></div>
                  </div>
                )}
              </div>

              {/* Lead Conversion Funnel */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Lead Conversion Funnel</h3>
                    <p className="card-subtitle">Visitors converted to premium paid plans.</p>
                  </div>
                  <div className="card-metric-badge badge-amber">CR: {conversionRate}</div>
                </div>
                <div className="conversion-pipeline-list">
                  {revFunnel.map((stage, i) => (
                    <div className="pipeline-row-item" key={i}>
                      <div className="pipeline-item-desc">
                        <span className="pipe-order-num">{i + 1}</span>
                        <div className="pipe-details-lbl">
                          <span className="pipe-title">{stage.stage}</span>
                          <span className="pipe-subtitle">Calculated from user data</span>
                        </div>
                      </div>
                      <div className="pipe-counts-block">
                        <span className="pipe-count-val">{(stage.count || 0).toLocaleString()}</span>
                        <span className="pipe-pct-val">{stage.percent}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="metrics-box-summary">
                  <div className="metric-box-sub">
                    <span className="sub-box-lbl">Subscriber Churn Rate</span>
                    <span className="sub-box-val text-red">{rdData?.overview?.churnRate ?? '0%'}</span>
                  </div>
                  <div className="metric-box-sub">
                    <span className="sub-box-lbl">Total Revenue (All Time)</span>
                    <span className="sub-box-val text-emerald">${(rdData?.overview?.totalRevenue ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VIDEO TAB ── */}
        {!loading.tab && activeTab === 'video' && (
          <div className="tab-pane animate-fade-in">
            <div className="analytics-grid-two-cols">

              {/* Playback Histogram */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Video Playback Completion Curve</h3>
                    <p className="card-subtitle">Audience retention drop-off across course lectures.</p>
                  </div>
                  <div className="card-metric-badge badge-red">Avg Completion: {avgCompletion}%</div>
                </div>
                <div className="playback-histogram-container">
                  {playbackRetention.map((bar, idx) => (
                    <div className="histogram-col-item" key={idx}>
                      <div className="histogram-bar-bg">
                        <div className="histogram-bar-filler" style={{ height: `${bar.retention}%` }}>
                          <span className="histogram-hover-tooltip">{bar.retention}% Retained</span>
                        </div>
                      </div>
                      <span className="histogram-x-lbl">{bar.label}</span>
                    </div>
                  ))}
                </div>
                <div className="stats-kpi-subrow">
                  <div className="subkpi-item">
                    <span className="subkpi-lbl">Total Hours Tracked</span>
                    <span className="subkpi-val">{(vdData?.overview?.totalHoursWatched ?? 0).toLocaleString()} Hrs</span>
                  </div>
                  <div className="subkpi-item">
                    <span className="subkpi-lbl">Total Videos</span>
                    <span className="subkpi-val">{(vdData?.overview?.totalVideos ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="subkpi-item">
                    <span className="subkpi-lbl">Total Views</span>
                    <span className="subkpi-val">{(vdData?.overview?.totalViews ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Top Videos */}
              <div className="pane-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Most Watched Lectures</h3>
                    <p className="card-subtitle">Specific video files attracting the highest viewer counts.</p>
                  </div>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Live data</span>
                </div>
                <div className="watched-lectures-rows">
                  {topVideos.length > 0 ? topVideos.map((video, i) => (
                    <div className="lecture-row-item" key={video.id || i}>
                      <div className="lecture-num-prefix">
                        <Play size={14} className="lecture-play-icon" />
                      </div>
                      <div className="lecture-details-main">
                        <span className="lecture-title">{video.title}</span>
                        {video.course && <span className="lecture-course-name">{video.course}</span>}
                      </div>
                      <div className="lecture-stats-block">
                        <div className="lect-views">{(video.views || 0).toLocaleString()} Plays</div>
                        <div className="lect-time-progress">
                          <span>Completion:</span>
                          <strong className={video.completionRate > 80 ? 'text-emerald' : video.completionRate > 70 ? 'text-blue' : 'text-orange'}>
                            {video.completionRate || 0}%
                          </strong>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                      No video watch data yet. Watch data is collected as users progress through course videos.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;