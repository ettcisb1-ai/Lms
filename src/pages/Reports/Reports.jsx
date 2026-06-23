import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Printer, Search, FileText, Users, DollarSign,
  BookOpen, TrendingUp, Activity, Filter, Award, Laptop,
  BarChart3, RefreshCw, AlertCircle
} from 'lucide-react';
import './Reports.css';
import { REPORTS_ENDPOINTS } from '../../utils/api';

const authHeaders = () => {
  const token = localStorage.getItem('lms_token') || localStorage.getItem('admin_token');
  return { Authorization: `Bearer ${token}` };
};

const Reports = () => {
  const [activeReport, setActiveReport] = useState('users-csv');

  // ── Users Report state ──────────────────────────────────────────────────────
  const [usersData, setUsersData] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [userStatusFilter, setUserStatusFilter] = useState('All');
  const [userSubFilter, setUserSubFilter] = useState('All');

  // ── Revenue Report state ────────────────────────────────────────────────────
  const [revenueData, setRevenueData] = useState([]);
  const [revPlanFilter, setRevPlanFilter] = useState('All');
  const [revStatusFilter, setRevStatusFilter] = useState('All');

  // ── Course Report state ─────────────────────────────────────────────────────
  const [coursesData, setCoursesData] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState('All');

  // ── Dynamic filter options from API ────────────────────────────────────────
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [planOptions, setPlanOptions] = useState([]);

  // ── Printable reports state ─────────────────────────────────────────────────
  const [monthlyRevData, setMonthlyRevData] = useState(null);
  const [activeStudentsData, setActiveStudentsData] = useState(null);
  const [coursePerformData, setCoursePerformData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const fetchWithAuth = useCallback(async (url) => {
    const res = await fetch(url, { headers: authHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Request failed');
    return json;
  }, []);

  // Load categories and plans for dynamic dropdowns on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [catRes, planRes] = await Promise.all([
          fetch(REPORTS_ENDPOINTS.CATEGORIES, { headers: authHeaders() }),
          fetch(REPORTS_ENDPOINTS.PLANS, { headers: authHeaders() }),
        ]);
        const catJson = await catRes.json();
        const planJson = await planRes.json();
        if (catJson.success) setCategoryOptions(catJson.data || []);
        if (planJson.success) setPlanOptions(planJson.data || []);
      } catch (e) {
        console.warn('Filter options fetch failed:', e.message);
      }
    };
    loadFilterOptions();
  }, []);

  const loadReport = useCallback(async (reportId) => {
    setLoading(true);
    setError(null);
    try {
      if (reportId === 'users-csv') {
        const params = new URLSearchParams();
        if (userRoleFilter !== 'All') params.append('role', userRoleFilter);
        if (userStatusFilter !== 'All') params.append('status', userStatusFilter);
        if (userSubFilter !== 'All') params.append('subscription', userSubFilter);
        const json = await fetchWithAuth(`${REPORTS_ENDPOINTS.USERS}?${params}`);
        setUsersData(json.data || []);
      } else if (reportId === 'revenue-csv') {
        const params = new URLSearchParams();
        if (revPlanFilter !== 'All') params.append('plan', revPlanFilter);
        if (revStatusFilter !== 'All') params.append('status', revStatusFilter);
        const json = await fetchWithAuth(`${REPORTS_ENDPOINTS.REVENUE}?${params}`);
        setRevenueData(json.data || []);
      } else if (reportId === 'course-reports') {
        const params = new URLSearchParams();
        if (courseSearch) params.append('search', courseSearch);
        if (courseCategoryFilter !== 'All') params.append('category', courseCategoryFilter);
        const json = await fetchWithAuth(`${REPORTS_ENDPOINTS.COURSES}?${params}`);
        setCoursesData(json.data || []);
      } else if (reportId === 'monthly-revenue') {
        const json = await fetchWithAuth(REPORTS_ENDPOINTS.MONTHLY_REVENUE);
        setMonthlyRevData(json.data || null);
      } else if (reportId === 'active-students') {
        const json = await fetchWithAuth(REPORTS_ENDPOINTS.ACTIVE_STUDENTS);
        setActiveStudentsData(json.data || null);
      } else if (reportId === 'course-performance') {
        const json = await fetchWithAuth(REPORTS_ENDPOINTS.COURSE_PERFORMANCE);
        setCoursePerformData(json.data || null);
      }
    } catch (e) {
      setError('Could not load report data. ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [userRoleFilter, userStatusFilter, userSubFilter, revPlanFilter, revStatusFilter, courseSearch, courseCategoryFilter, fetchWithAuth]);

  useEffect(() => { loadReport(activeReport); }, [activeReport]);

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const downloadCSV = (headers, rows, filename) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(value => {
          const s = value === null || value === undefined ? '' : String(value);
          return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
      )
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportUsers = () => {
    if (!usersData.length) return;
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Status', 'Enrolled Courses', 'Registration Date', 'Subscription', 'Sub Status', 'Avg Progress (%)'];
    const rows = usersData.map(u => [u.id, u.name, u.email, u.role, u.status, u.enrolled, u.registeredDate, u.subscription, u.subscriptionStatus, u.progress]);
    downloadCSV(headers, rows, `users_report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportRevenue = () => {
    if (!revenueData.length) return;
    const headers = ['Transaction ID', 'Student Name', 'Email', 'Plan', 'Billing Date', 'Method', 'Amount (USD)', 'Currency', 'Status'];
    const rows = revenueData.map(r => [r.id, r.student, r.email, r.plan, r.date, r.method, r.amount, r.currency, r.status]);
    downloadCSV(headers, rows, `revenue_report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportCourses = () => {
    if (!coursesData.length) return;
    const headers = ['Course ID', 'Title', 'Category', 'Enrolled', 'Completion Rate (%)', 'Avg Progress (%)', 'Hours Watched', 'Active Learners', 'Completed', 'Total Videos', 'Status'];
    const rows = coursesData.map(c => [c.id, c.title, c.category, c.enrolled, c.completionRate, c.avgProgress, c.hoursWatched, c.activeStudents, c.completedStudents, c.totalVideos, c.status]);
    downloadCSV(headers, rows, `course_report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ── Loading / Error states ──────────────────────────────────────────────────
  const LoadingSpinner = () => (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
      <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <p style={{ fontSize: 14 }}>Loading report data…</p>
    </div>
  );

  const ErrorBanner = () => error ? (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: 14 }}>
      <AlertCircle size={16} /> {error}
    </div>
  ) : null;

  // ── Renderers ───────────────────────────────────────────────────────────────

  const renderUsersExport = () => (
    <div className="report-content-pane animate-fade-in">
      <div className="pane-header">
        <div>
          <h3 className="pane-title">Users CSV Export</h3>
          <p className="pane-subtitle">Configure columns and criteria to extract learner tables as a CSV file.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => loadReport('users-csv')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={handleExportUsers} disabled={!usersData.length}>
            <Download size={16} /><span>Download CSV ({usersData.length})</span>
          </button>
        </div>
      </div>

      <div className="report-filters-card">
        <div className="filters-title"><Filter size={14} /><span>Export Configuration Filters</span></div>
        <div className="filters-grid">
          {[
            { label: 'System Role', value: userRoleFilter, onChange: setUserRoleFilter, options: ['All', 'admin', 'user'] },
            { label: 'Account Status', value: userStatusFilter, onChange: setUserStatusFilter, options: ['All', 'Active', 'Inactive'] },
            { label: 'Subscription Tier', value: userSubFilter, onChange: setUserSubFilter, options: ['All', 'Pro', 'Free'] },
          ].map(({ label, value, onChange, options }) => (
            <div className="filter-group" key={label}>
              <label>{label}</label>
              <select value={value} onChange={e => { onChange(e.target.value); setTimeout(() => loadReport('users-csv'), 100); }}>
                {options.map(o => <option key={o} value={o}>{o === 'All' ? `All ${label.split(' ')[1]}s` : o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <ErrorBanner />
      {loading ? <LoadingSpinner /> : (
        <div className="card margin-top-20">
          <div className="card-inner-header">
            <h4>Data Preview ({usersData.length} rows)</h4>
            <span className="badge badge-info">
              {usersData.length > 5 ? `Showing 5 of ${usersData.length}` : `${usersData.length} records`}
            </span>
          </div>
          <div className="table-responsive">
            <table className="preview-table">
              <thead>
                <tr><th>User Details</th><th>Role</th><th>Subscription</th><th>Status</th><th>Progress</th><th>Reg. Date</th></tr>
              </thead>
              <tbody>
                {usersData.slice(0, 5).map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="preview-user-cell">
                        <div className="preview-avatar">{u.name?.charAt(0) || '?'}</div>
                        <div>
                          <div className="user-name-bold">{u.name}</div>
                          <div className="user-email-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`role-badge ${(u.role || '').toLowerCase()}`}>{u.role}</span></td>
                    <td>
                      <div>
                        <span className="sub-badge-lite">{u.subscription}</span>
                        {u.subscriptionStatus && u.subscriptionStatus !== 'Free' && (
                          <span className={`status-badge-dot ${u.subscriptionStatus.toLowerCase()}`} style={{ marginLeft: 6, fontSize: 11 }}>{u.subscriptionStatus}</span>
                        )}
                      </div>
                    </td>
                    <td><span className={`status-badge-dot ${(u.status || '').toLowerCase()}`}>{u.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${u.progress}%`, height: '100%', background: '#6366f1', borderRadius: 3 }}></div>
                        </div>
                        <span style={{ fontSize: 12, color: '#475569' }}>{u.progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{u.registeredDate}</td>
                  </tr>
                ))}
                {usersData.length === 0 && !loading && (
                  <tr><td colSpan="6" className="text-center" style={{ padding: 32, color: '#94a3b8' }}>No users match the active filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderRevenueExport = () => (
    <div className="report-content-pane animate-fade-in">
      <div className="pane-header">
        <div>
          <h3 className="pane-title">Revenue CSV Export</h3>
          <p className="pane-subtitle">Extract financial transactions, invoices, plan payments, and subscription details.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => loadReport('revenue-csv')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={handleExportRevenue} disabled={!revenueData.length}>
            <Download size={16} /><span>Download CSV ({revenueData.length})</span>
          </button>
        </div>
      </div>

      <div className="report-filters-card">
        <div className="filters-title"><Filter size={14} /><span>Export Configuration Filters</span></div>
        <div className="filters-grid-two">
          <div className="filter-group">
            <label>Subscription Plan</label>
            <select value={revPlanFilter} onChange={e => { setRevPlanFilter(e.target.value); setTimeout(() => loadReport('revenue-csv'), 100); }}>
              <option value="All">All Plans</option>
              {planOptions.map(p => (
                <option key={p.planId} value={p.planId}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Transaction Status</label>
            <select value={revStatusFilter} onChange={e => { setRevStatusFilter(e.target.value); setTimeout(() => loadReport('revenue-csv'), 100); }}>
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      <ErrorBanner />
      {loading ? <LoadingSpinner /> : (
        <div className="card margin-top-20">
          <div className="card-inner-header">
            <h4>Revenue Preview ({revenueData.length} rows)</h4>
            <span className="badge badge-success">
              Total: ${revenueData.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()} USD
            </span>
          </div>
          <div className="table-responsive">
            <table className="preview-table">
              <thead>
                <tr><th>Transaction ID</th><th>Student</th><th>Plan</th><th>Method</th><th>Date</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {revenueData.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td className="font-mono-size">{r.id}</td>
                    <td>
                      <div>
                        <div className="user-name-bold">{r.student}</div>
                        <div className="user-email-muted">{r.email}</div>
                      </div>
                    </td>
                    <td>{r.plan}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: r.method === 'Stripe' ? '#ede9fe' : '#fef3c7', color: r.method === 'Stripe' ? '#7c3aed' : '#92400e' }}>
                        {r.method}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{r.date}</td>
                    <td className="amount-val">${r.amount} {r.currency}</td>
                    <td><span className={`status-badge-dot ${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                  </tr>
                ))}
                {revenueData.length === 0 && !loading && (
                  <tr><td colSpan="7" className="text-center" style={{ padding: 32, color: '#94a3b8' }}>No revenue records match the filters. Ensure users have purchase dates recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderCourseReports = () => (
    <div className="report-content-pane animate-fade-in">
      <div className="pane-header">
        <div>
          <h3 className="pane-title">Course Progress Reports</h3>
          <p className="pane-subtitle">Detailed course-level analytics with enrollment, completion and watch-time metrics.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => loadReport('course-reports')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={handleExportCourses} disabled={!coursesData.length}>
            <Download size={16} /><span>Download CSV ({coursesData.length})</span>
          </button>
        </div>
      </div>

      <div className="report-search-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search course title…" value={courseSearch}
            onChange={e => { setCourseSearch(e.target.value); }} onKeyDown={e => e.key === 'Enter' && loadReport('course-reports')} />
        </div>
        <div className="toolbar-actions">
          <select className="filter-select" value={courseCategoryFilter}
            onChange={e => { setCourseCategoryFilter(e.target.value); setTimeout(() => loadReport('course-reports'), 100); }}>
            <option value="All">All Categories</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <ErrorBanner />
      {loading ? <LoadingSpinner /> : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Title</th><th>Category</th><th>Enrolled</th>
                  <th>Completion Rate</th><th>Avg Progress</th><th>Active Students</th>
                  <th>Hours Watched</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coursesData.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="course-title-cell">
                        <BookOpen size={16} className="course-icon-decor" />
                        <span className="course-title-bold">{c.title}</span>
                      </div>
                    </td>
                    <td><span className="cat-tag-pill">{c.category}</span></td>
                    <td className="num-bold">{(c.enrolled || 0).toLocaleString()}</td>
                    <td>
                      <div className="progress-cell-wrapper">
                        <div className="progress-val-text">{c.completionRate}%</div>
                        <div className="progress-bg-bar">
                          <div className="progress-fill-bar bg-primary-theme" style={{ width: `${c.completionRate}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="progress-cell-wrapper">
                        <div className="progress-val-text">{c.avgProgress}%</div>
                        <div className="progress-bg-bar">
                          <div className="progress-fill-bar" style={{ width: `${c.avgProgress}%`, background: '#10b981' }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="num-bold">{c.activeStudents || 0}</td>
                    <td className="num-bold">{(c.hoursWatched || 0).toLocaleString()} hrs</td>
                    <td><span className={`status-badge-dot ${(c.status || 'published').toLowerCase()}`}>{c.status || 'Published'}</span></td>
                  </tr>
                ))}
                {coursesData.length === 0 && !loading && (
                  <tr><td colSpan="8" className="text-center" style={{ padding: 32, color: '#94a3b8' }}>No courses match your search criteria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderMonthlyRevenuePrintable = () => {
    const d = monthlyRevData;
    const summary = d?.summary || {};
    const months = d?.months || [];

    return (
      <div className="report-content-pane printable-report-card animate-fade-in" id="printable-area">
        <div className="printable-executive-header">
          <div className="brand-badge-node">LMS PORTAL ADMINISTRATIVE EXECUTIVE REPORT</div>
          <div className="header-meta-row">
            <div>
              <h2 className="print-main-title">Monthly Revenue Financial Report</h2>
              <p className="print-sub-title">Consolidated Billings, Subscriptions and Revenue Trends.</p>
            </div>
            <div className="print-action-hidden-block">
              <button className="btn-primary print-trigger-btn" onClick={() => window.print()}>
                <Printer size={16} /><span>Print Report</span>
              </button>
            </div>
          </div>
          <div className="print-report-meta-grid">
            {[
              { lbl: 'Generated By:', val: 'LMS Admin Portal' },
              { lbl: 'Date Generated:', val: new Date().toLocaleString() },
              { lbl: 'Total Revenue (YTD):', val: summary.totalRevenue ? `$${summary.totalRevenue.toLocaleString()}` : '$0' },
              { lbl: 'Report Classification:', val: 'Confidential - Internal Use', tag: true },
            ].map(({ lbl, val, tag }) => (
              <div className="meta-col" key={lbl}>
                <span className="meta-lbl">{lbl}</span>
                <span className={`meta-val${tag ? ' tag-restricted' : ''}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <ErrorBanner />
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="print-dashboard-kpi-grid">
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">TOTAL REVENUE (YTD)</span>
                <span className="kpi-value-large text-theme-primary">${(summary.totalRevenue || 0).toLocaleString()}</span>
                <span className="kpi-sub-desc">Consolidated across all payment channels.</span>
              </div>
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">AVG MONTHLY REVENUE</span>
                <span className="kpi-value-large">${(summary.avgMonthly || 0).toLocaleString()}</span>
                <span className="kpi-sub-desc">Average monthly run rate.</span>
              </div>
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">GATEWAY SPLIT (STRIPE / PAYPAL)</span>
                <span className="kpi-value-large">{summary.stripePercent || 0}% / {summary.paypalPercent || 0}%</span>
                <span className="kpi-sub-desc">Estimated gateway distribution.</span>
              </div>
            </div>

            {months.length > 0 ? (
              <div className="printable-table-card card">
                <h4 className="section-chart-title">Detailed Monthly Financial Ledger</h4>
                <table className="printable-statement-table">
                  <thead>
                    <tr>
                      <th>Billing Cycle</th>
                      <th className="text-right">Stripe Billing</th>
                      <th className="text-right">PayPal Billing</th>
                      <th className="text-right">New Subscriptions</th>
                      <th className="text-right font-bold-header">Total Monthly Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m, idx) => (
                      <tr key={idx}>
                        <td className="billing-month-lbl">{m.month}</td>
                        <td className="text-right font-mono-col">${(m.stripe || 0).toLocaleString()}</td>
                        <td className="text-right font-mono-col">${(m.paypal || 0).toLocaleString()}</td>
                        <td className="text-right">{m.newSubscriptions || 0} users</td>
                        <td className="text-right font-mono-col font-bold-col">${(m.totalRevenue || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="grand-total-row">
                      <td>GRAND AUDITED TOTAL (YTD)</td>
                      <td className="text-right">${(summary.stripeShare || 0).toLocaleString()}</td>
                      <td className="text-right">${(summary.paypalShare || 0).toLocaleString()}</td>
                      <td className="text-right"></td>
                      <td className="text-right font-mono-col font-bold-col">${(summary.totalRevenue || 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                No subscription revenue data found. Revenue is recorded from users with valid purchase dates.
              </div>
            )}

            <div className="printable-signoff-block">
              <div className="signature-area"><div className="sig-line"></div><span className="sig-title">Finance Director Signature</span></div>
              <div className="signature-area"><div className="sig-line"></div><span className="sig-title">Compliance Manager Signature</span></div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderActiveStudentsPrintable = () => {
    const d = activeStudentsData;
    const students = d?.students || [];
    const stats = d?.stats || {};

    return (
      <div className="report-content-pane printable-report-card animate-fade-in" id="printable-area">
        <div className="printable-executive-header">
          <div className="brand-badge-node">LMS PORTAL ADMINISTRATIVE EXECUTIVE REPORT</div>
          <div className="header-meta-row">
            <div>
              <h2 className="print-main-title">Active Students & Learner Engagement Report</h2>
              <p className="print-sub-title">Detailed snapshot of platform activity and session logging.</p>
            </div>
            <div className="print-action-hidden-block">
              <button className="btn-primary print-trigger-btn" onClick={() => window.print()}>
                <Printer size={16} /><span>Print Report</span>
              </button>
            </div>
          </div>
          <div className="print-report-meta-grid">
            <div className="meta-col"><span className="meta-lbl">Generated By:</span><span className="meta-val">LMS Admin Portal</span></div>
            <div className="meta-col"><span className="meta-lbl">Date Generated:</span><span className="meta-val">{new Date().toLocaleString()}</span></div>
            <div className="meta-col"><span className="meta-lbl">Tracking Interval:</span><span className="meta-val">Live 24h Window</span></div>
            <div className="meta-col"><span className="meta-lbl">Classification:</span><span className="meta-val tag-restricted">Internal Auditing Only</span></div>
          </div>
        </div>

        <ErrorBanner />
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="print-dashboard-kpi-grid">
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">DAILY ACTIVE USERS (DAU)</span>
                <span className="kpi-value-large text-theme-primary">{stats.dau || 0} Learners</span>
                <span className="kpi-sub-desc">Active in the last 24 hours.</span>
              </div>
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">WEEKLY ACTIVE USERS (WAU)</span>
                <span className="kpi-value-large">{(stats.wau || 0).toLocaleString()} Learners</span>
                <span className="kpi-sub-desc">Active in the last 7 days.</span>
              </div>
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">TOTAL ACTIVE USERS</span>
                <span className="kpi-value-large">{(stats.mau || 0).toLocaleString()}</span>
                <span className="kpi-sub-desc">Total active accounts on platform.</span>
              </div>
            </div>

            <div className="printable-table-card card margin-top-20">
              <h4 className="section-chart-title">Current Learner Activity Log</h4>
              <table className="printable-statement-table">
                <thead>
                  <tr><th>Student</th><th>Email</th><th>Active Course</th><th>Hours Logged</th><th>Progress</th><th>Last Active</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <tr key={idx}>
                      <td className="font-bold-col">{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.course}</td>
                      <td>{s.hoursLogged} hrs</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 50, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${s.percentageComplete}%`, height: '100%', background: '#6366f1' }}></div>
                          </div>
                          <span>{s.percentageComplete}%</span>
                        </div>
                      </td>
                      <td><span className={`live-time-stamp-badge ${s.lastActive?.includes('now') ? 'live-highlight' : ''}`}>{s.lastActive}</span></td>
                      <td><span className={`status-badge-dot ${(s.status || '').replace('_', '-')}`}>{s.status}</span></td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan="7" className="text-center" style={{ padding: 24, color: '#94a3b8' }}>No active student sessions in the last 24 hours.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="printable-signoff-block">
              <div className="signature-area"><div className="sig-line"></div><span className="sig-title">System Operations Officer Signature</span></div>
              <div className="signature-area"><div className="sig-line"></div><span className="sig-title">Auditor Review Signature</span></div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCoursePerformancePrintable = () => {
    const d = coursePerformData;
    const courses = d?.courses || [];
    const summary = d?.summary || {};

    return (
      <div className="report-content-pane printable-report-card animate-fade-in" id="printable-area">
        <div className="printable-executive-header">
          <div className="brand-badge-node">LMS PORTAL ADMINISTRATIVE EXECUTIVE REPORT</div>
          <div className="header-meta-row">
            <div>
              <h2 className="print-main-title">Course Performance & Academic Audit</h2>
              <p className="print-sub-title">Detailed analysis of syllabus success rates and learner satisfaction.</p>
            </div>
            <div className="print-action-hidden-block">
              <button className="btn-primary print-trigger-btn" onClick={() => window.print()}>
                <Printer size={16} /><span>Print Report</span>
              </button>
            </div>
          </div>
          <div className="print-report-meta-grid">
            <div className="meta-col"><span className="meta-lbl">Generated By:</span><span className="meta-val">LMS Admin Portal</span></div>
            <div className="meta-col"><span className="meta-lbl">Date Generated:</span><span className="meta-val">{new Date().toLocaleString()}</span></div>
            <div className="meta-col"><span className="meta-lbl">Audited Courses:</span><span className="meta-val">{summary.totalCourses || 0} Courses</span></div>
            <div className="meta-col"><span className="meta-lbl">Classification:</span><span className="meta-val tag-restricted">Academic Auditing - Internal</span></div>
          </div>
        </div>

        <ErrorBanner />
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="print-dashboard-kpi-grid">
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">TOTAL ENROLLMENT AGGREGATE</span>
                <span className="kpi-value-large text-theme-primary">{(summary.totalEnrolled || 0).toLocaleString()} Enrollees</span>
                <span className="kpi-sub-desc">Across all registered catalog modules.</span>
              </div>
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">AVERAGE GRADUATION RATE</span>
                <span className="kpi-value-large">{summary.avgGraduation || 0}%</span>
                <span className="kpi-sub-desc">Calculated as course-complete ratio.</span>
              </div>
              <div className="print-kpi-card bg-light-gradient">
                <span className="kpi-lbl">TOTAL COURSES</span>
                <span className="kpi-value-large">{summary.totalCourses || 0}</span>
                <span className="kpi-sub-desc">Published catalog modules.</span>
              </div>
            </div>

            <div className="printable-table-card card margin-top-20">
              <h4 className="section-chart-title">Academic Curricular Matrix</h4>
              <table className="printable-statement-table">
                <thead>
                  <tr>
                    <th>Course Module Title</th><th>Category</th>
                    <th className="text-right">Students</th>
                    <th className="text-right">Completion</th>
                    <th className="text-right">Avg Progress</th>
                    <th className="text-right">Watch Time</th>
                    <th className="text-right">Dropoff</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c, idx) => (
                    <tr key={idx}>
                      <td className="font-bold-col">{c.title}</td>
                      <td>{c.category}</td>
                      <td className="text-right font-mono-col">{(c.enrolled || 0).toLocaleString()}</td>
                      <td className="text-right font-bold-col">{c.completionRate}%</td>
                      <td className="text-right">{c.avgProgress}%</td>
                      <td className="text-right font-mono-col">{(c.hoursWatched || 0).toLocaleString()} hrs</td>
                      <td className="text-right text-red font-bold-col">{c.dropoffRate || 0}%</td>
                    </tr>
                  ))}
                  {courses.length === 0 && (
                    <tr><td colSpan="7" className="text-center" style={{ padding: 24, color: '#94a3b8' }}>No course data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="printable-signoff-block">
              <div className="signature-area"><div className="sig-line"></div><span className="sig-title">Curriculum Director Signature</span></div>
              <div className="signature-area"><div className="sig-line"></div><span className="sig-title">Academic Auditor Signature</span></div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'users-csv': return renderUsersExport();
      case 'revenue-csv': return renderRevenueExport();
      case 'course-reports': return renderCourseReports();
      case 'monthly-revenue': return renderMonthlyRevenuePrintable();
      case 'active-students': return renderActiveStudentsPrintable();
      case 'course-performance': return renderCoursePerformancePrintable();
      default: return renderUsersExport();
    }
  };

  const navItems = [
    {
      section: 'EXPORTS', items: [
        { id: 'users-csv', Icon: FileText, label: 'Users CSV' },
        { id: 'revenue-csv', Icon: FileText, label: 'Revenue CSV' },
      ]
    },
    {
      section: 'PROGRESS REPORTS', items: [
        { id: 'course-reports', Icon: BarChart3, label: 'Course Reports' },
      ]
    },
    {
      section: 'PRINTABLE REPORTS', items: [
        { id: 'monthly-revenue', Icon: DollarSign, label: 'Monthly Revenue' },
        { id: 'active-students', Icon: Users, label: 'Active Students' },
        { id: 'course-performance', Icon: TrendingUp, label: 'Course Performance' },
      ]
    },
  ];

  return (
    <div className="reports-page-wrapper">
      <aside className="reports-internal-sidebar">
        <div className="sidebar-group-title">Export & Reports</div>
        {navItems.map(({ section, items }) => (
          <div className="reports-sidebar-section" key={section}>
            <span className="section-sub-title">{section}</span>
            <nav className="section-nav-tree">
              {items.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  className={`nav-tree-item ${activeReport === id ? 'active' : ''}`}
                  onClick={() => { setActiveReport(id); loadReport(id); }}
                >
                  <Icon size={16} /><span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        ))}
      </aside>
      <main className="reports-viewport-area">
        {renderActiveReport()}
      </main>
    </div>
  );
};

export default Reports;