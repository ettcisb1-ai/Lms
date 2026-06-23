import React, { useState, useEffect, useContext } from 'react';
import { PendingTabContext } from '../../components/AdminLayout/AdminLayout';
import {
  Users,
  BookOpen,
  Clock,
  CheckCircle,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  Award,
  TrendingUp,
  FileText,
  AlertCircle,
  Crosshair
} from 'lucide-react';
import './Progress.css';
import { COURSE_ENDPOINTS, PROGRESS_ENDPOINTS } from '../../utils/api';
const getToken = () => localStorage.getItem('lms_token');

const Progress = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { tab, route, clearPendingTab } = useContext(PendingTabContext);
  useEffect(() => {
    if (tab && route === '/admin/progress') {
      setActiveTab(tab);
      clearPendingTab();
    }
  }, [tab, route]);

  // ── Per-User (FR-48) ─────────────────────────────────────────────────────────
  const [allProgress, setAllProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState(null);
  const [progressPage, setProgressPage] = useState(1);
  const [progressTotal, setProgressTotal] = useState(0);

  // ── Per-Course (FR-48) ───────────────────────────────────────────────────────
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseReport, setCourseReport] = useState(null);
  const [courseReportLoading, setCourseReportLoading] = useState(false);

  // ── Export state ─────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');

  // ── Overview stats ───────────────────────────────────────────────────────────
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, avgCompletion: 0 });

  // Load all progress records (admin overview)
  const loadAllProgress = async () => {
    setProgressLoading(true);
    setProgressError('');
    try {
      const params = new URLSearchParams({ page: progressPage, limit: 25 });
      if (selectedStatusFilter !== 'all') params.set('status', selectedStatusFilter);
      const res = await fetch(PROGRESS_ENDPOINTS.ADMIN_LIST(params), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setAllProgress(data.data.progress);
        setProgressTotal(data.data.total);
        // Compute overview stats
        const all = data.data.progress;
        const completed = all.filter((p) => p.status === 'completed').length;
        const inProg = all.filter((p) => p.status === 'in_progress').length;
        const avg = all.length
          ? Math.round(all.reduce((s, p) => s + p.percentageComplete, 0) / all.length)
          : 0;
        setStats({ total: data.data.total, completed, inProgress: inProg, avgCompletion: avg });
      } else {
        setProgressError(data.message || 'Failed to load progress data');
      }
    } catch (_) {
      setProgressError('Network error — could not fetch progress data.');
    } finally {
      setProgressLoading(false);
    }
  };

  // Load courses for per-course report
  const loadCourses = async () => {
    try {
      const res = await fetch(COURSE_ENDPOINTS.LIST, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setCourses(data.data || []);
    } catch (_) { }
  };

  // Load per-course report
  const loadCourseReport = async (courseId) => {
    if (!courseId) return;
    setCourseReportLoading(true);
    setCourseReport(null);
    try {
      const res = await fetch(PROGRESS_ENDPOINTS.ADMIN_COURSE(courseId), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setCourseReport(data.data);
    } catch (_) { }
    finally { setCourseReportLoading(false); }
  };

  useEffect(() => { loadAllProgress(); }, [progressPage, selectedStatusFilter]);
  useEffect(() => { loadCourses(); }, []);
  useEffect(() => {
    if (selectedCourseId) loadCourseReport(selectedCourseId);
  }, [selectedCourseId]);

  // ── Filtered students ────────────────────────────────────────────────────────
  const filteredProgress = allProgress.filter((p) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = p.user?.name?.toLowerCase().includes(query);
    const emailMatch = p.user?.email?.toLowerCase().includes(query);
    const courseMatch = p.course?.title?.toLowerCase().includes(query);
    return !query || nameMatch || emailMatch || courseMatch;
  });

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const triggerCSVDownload = (type) => {
    setIsExporting(true);
    setExportProgress(10);
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExporting(false);
            const filename = `${type}_progress_report.csv`;
            setExportedFilename(filename);
            setShowExportSuccess(true);

            let csvRows = [];
            if (type === 'students') {
              csvRows.push(['Student Name', 'Email', 'Course', 'Progress %', 'Status', 'Completed Videos', 'Total Videos'].join(','));
              filteredProgress.forEach((p) => {
                csvRows.push([
                  `"${p.user?.name || ''}"`,
                  `"${p.user?.email || ''}"`,
                  `"${p.course?.title || ''}"`,
                  p.percentageComplete,
                  p.status,
                  p.completedVideos,
                  p.totalVideos,
                ].join(','));
              });
            } else {
              csvRows.push(['Course', 'Enrolled', 'Completed', 'In Progress', 'Avg Completion %'].join(','));
              if (courseReport) {
                const s = courseReport.summary;
                csvRows.push([
                  `"${courseReport.course?.title || ''}"`,
                  s.totalEnrolled, s.completed, s.inProgress, s.avgCompletion,
                ].join(','));
              }
            }

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => setShowExportSuccess(false), 4000);
          }, 300);
          return 100;
        }
        return prev + 30;
      });
    }, 150);
  };

  const statusColor = { completed: '#10b981', in_progress: '#6366f1', not_started: '#a0aec0' };
  const statusLabel = { completed: 'Completed', in_progress: 'In Progress', not_started: 'Not Started' };

  return (
    <div className="progress-page">
      {/* Page Header */}
      <div className="progress-header">
        <div>
          <h2 className="page-title">Student Progress Monitoring</h2>
          <p className="page-subtitle">Track course completions, watch durations, lecture details, and export reports.</p>
        </div>
        <div className="tab-control-badge">
          <Crosshair size={16} className="brand-pulse-icon" />
          <span>Live from DB — {stats.total} records</span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="progress-overview-grid">
        <div className="metric-box bg-glowing-blue" onClick={() => setActiveTab('user')}>
          <div className="metric-inner">
            <span className="metric-lbl">Total Progress Records</span>
            <div className="metric-val-row">
              <span className="metric-val">{stats.total}</span>
              <div className="icon-bg bg-faded-blue"><Users size={18} /></div>
            </div>
            <p className="metric-desc">Course-user progress entries in the database.</p>
          </div>
        </div>

        <div className="metric-box bg-glowing-emerald" onClick={() => setActiveTab('course')}>
          <div className="metric-inner">
            <span className="metric-lbl">Average Completion</span>
            <div className="metric-val-row">
              <span className="metric-val">{stats.avgCompletion}%</span>
              <div className="icon-bg bg-faded-emerald"><Award size={18} /></div>
            </div>
            <p className="metric-desc">Aggregate completion rate across loaded records.</p>
          </div>
        </div>

        <div className="metric-box bg-glowing-purple" onClick={() => setActiveTab('dashboard')}>
          <div className="metric-inner">
            <span className="metric-lbl">In Progress</span>
            <div className="metric-val-row">
              <span className="metric-val">{stats.inProgress}</span>
              <div className="icon-bg bg-faded-purple"><Play size={18} /></div>
            </div>
            <p className="metric-desc">Learners actively working through their courses.</p>
          </div>
        </div>

        <div className="metric-box bg-glowing-amber" onClick={() => setActiveTab('reports')}>
          <div className="metric-inner">
            <span className="metric-lbl">Completed Courses</span>
            <div className="metric-val-row">
              <span className="metric-val">{stats.completed}</span>
              <div className="icon-bg bg-faded-amber"><FileText size={18} /></div>
            </div>
            <p className="metric-desc">Courses fully completed (100%).</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="progress-tabs-bar">
        <button className={`progress-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <TrendingUp size={16} /><span>Dashboard</span>
        </button>
        <button className={`progress-tab-btn ${activeTab === 'user' ? 'active' : ''}`} onClick={() => { setActiveTab('user'); setSearchQuery(''); setSelectedStatusFilter('all'); }}>
          <Users size={16} /><span>Per-User Progress</span>
        </button>
        <button className={`progress-tab-btn ${activeTab === 'course' ? 'active' : ''}`} onClick={() => setActiveTab('course')}>
          <BookOpen size={16} /><span>Per-Course Report</span>
        </button>
        <button className={`progress-tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          <Download size={16} /><span>Reports & Exports</span>
        </button>
      </div>

      {/* Tab Viewports */}
      <div className="progress-viewport">
        {isExporting && (
          <div className="export-progress-overlay">
            <div className="export-progress-box">
              <RefreshCw size={24} className="spinning-loader" />
              <h4>Compiling Export Metadata...</h4>
              <div className="progress-bar-rail">
                <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }}></div>
              </div>
              <span>{exportProgress}% Processed</span>
            </div>
          </div>
        )}
        {showExportSuccess && (
          <div className="success-toast-banner">
            <CheckCircle size={16} />
            <span>Success! Downloaded: <strong>{exportedFilename}</strong></span>
          </div>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="tab-panel animate-fade">
            {progressLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>
                <RefreshCw size={22} className="spinning-loader" />
                <p style={{ marginTop: 10 }}>Loading progress data...</p>
              </div>
            ) : progressError ? (
              <div className="progress-api-error">
                <AlertCircle size={18} />
                <span>{progressError}</span>
                <button onClick={loadAllProgress} className="btn-retry"><RefreshCw size={14} /> Retry</button>
              </div>
            ) : (
              <div className="progress-double-grid">
                {/* Recent Activity */}
                <div className="pane-box">
                  <div className="box-head">
                    <div>
                      <h3 className="box-title">Recent Student Activity</h3>
                      <p className="box-subtitle">Latest progress updates from student accounts.</p>
                    </div>
                  </div>
                  <div className="activities-stream-list">
                    {filteredProgress.slice(0, 5).map((p, idx) => (
                      <div className="activity-stream-row" key={p._id || idx}>
                        <div className="activity-status-dot" style={{ backgroundColor: statusColor[p.status] }}></div>
                        <div className="activity-main-desc">
                          <span className="activity-learner-name">{p.user?.name || 'Unknown'}</span>
                          <p className="activity-details-text">{p.course?.title || 'Unknown Course'}</p>
                          <span className="activity-time-stamp"><Clock size={11} /> {p.completedVideos}/{p.totalVideos} videos completed</span>
                        </div>
                        <span className="activity-badge-pill" style={{
                          color: p.status === 'completed' ? '#10b981' : '#6366f1',
                          background: p.status === 'completed' ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)'
                        }}>
                          {p.percentageComplete}%
                        </span>
                      </div>
                    ))}
                    {filteredProgress.length === 0 && (
                      <p style={{ padding: 20, color: '#a0aec0', textAlign: 'center' }}>No progress records yet.</p>
                    )}
                  </div>
                </div>

                {/* Course Report Summary */}
                <div className="pane-box">
                  <div className="box-head">
                    <div>
                      <h3 className="box-title">Status Distribution</h3>
                      <p className="box-subtitle">Breakdown of all progress records by status.</p>
                    </div>
                  </div>
                  <div className="course-aggregates-list">
                    {[
                      { label: 'Completed', count: stats.completed, color: '#10b981' },
                      { label: 'In Progress', count: stats.inProgress, color: '#6366f1' },
                      { label: 'Not Started', count: stats.total - stats.completed - stats.inProgress, color: '#a0aec0' },
                    ].map((s, i) => (
                      <div className="course-agg-row" key={i}>
                        <div className="course-agg-details">
                          <span className="course-agg-name">{s.label}</span>
                          <div className="course-agg-stats-row">
                            <span>{s.count} records</span>
                            <span className="dot-sep">•</span>
                            <span>{stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}%</span>
                          </div>
                        </div>
                        <div className="course-progress-ring">
                          <svg className="radial-svg-small" width="46" height="46" viewBox="0 0 36 36">
                            <path className="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path
                              className="ring-fill"
                              strokeDasharray={`${stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}, 100`}
                              stroke={s.color}
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <text x="18" y="21.5" className="ring-text">{stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}%</text>
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PER-USER (FR-47, FR-48) ──────────────────────────────────────── */}
        {activeTab === 'user' && (
          <div className="tab-panel animate-fade">
            <div className="search-filter-controls-row">
              <div className="search-input-box">
                <Search size={16} className="search-ico" />
                <input
                  type="text"
                  placeholder="Search by student name, email, or course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-field"
                />
              </div>
              <div className="select-filters-group">
                <div className="filter-badge"><Filter size={13} /><span>Status</span></div>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => { setSelectedStatusFilter(e.target.value); setProgressPage(1); }}
                  className="filter-dropdown"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="not_started">Not Started</option>
                </select>
                <button className="filter-dropdown" style={{ cursor: 'pointer', color: '#4299e1' }} onClick={loadAllProgress}>
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </div>

            {progressLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>
                <RefreshCw size={22} className="spinning-loader" />
                <p style={{ marginTop: 10 }}>Loading...</p>
              </div>
            ) : progressError ? (
              <div className="progress-api-error">
                <AlertCircle size={18} />
                <span>{progressError}</span>
                <button onClick={loadAllProgress} className="btn-retry"><RefreshCw size={14} /> Retry</button>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Course</th>
                      <th>Progress %</th>
                      <th>Videos</th>
                      <th>Status</th>
                      <th className="align-center-col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProgress.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="empty-results-cell">
                          <h4>No progress records found</h4>
                          <p>Adjust your search or filters, or check that students have started watching videos.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredProgress.map((p) => (
                        <React.Fragment key={p._id}>
                          <tr
                            className={`student-data-row ${expandedRow === p._id ? 'expanded' : ''}`}
                            onClick={() => setExpandedRow(expandedRow === p._id ? null : p._id)}
                          >
                            <td>
                              <div className="student-profile-cell">
                                <div className="student-avatar" style={{ backgroundColor: '#6366f1' }}>
                                  {(p.user?.name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="student-names-block">
                                  <span className="st-name-txt">{p.user?.name || 'Unknown'}</span>
                                  <span className="st-email-txt">{p.user?.email || ''}</span>
                                </div>
                              </div>
                            </td>
                            <td className="st-course-txt">{p.course?.title || '—'}</td>
                            <td>
                              <div className="progress-bar-cell">
                                <span className="bar-val-txt">{p.percentageComplete}%</span>
                                <div className="bar-track">
                                  <div
                                    className="bar-fill"
                                    style={{
                                      width: `${p.percentageComplete}%`,
                                      backgroundColor: statusColor[p.status] || '#6366f1',
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="st-completion-txt">{p.completedVideos}/{p.totalVideos}</td>
                            <td>
                              <span className={`status-badge-pill ${p.status}`}>
                                {statusLabel[p.status] || p.status}
                              </span>
                            </td>
                            <td className="align-center-col actions-btn-col" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="expand-lecture-toggle-btn"
                                onClick={() => setExpandedRow(expandedRow === p._id ? null : p._id)}
                              >
                                <span>Videos</span>
                                {expandedRow === p._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>

                          {expandedRow === p._id && (
                            <tr className="lecture-expand-row">
                              <td colSpan="6">
                                <div className="lecture-logs-dropdown-panel animate-slide-down">
                                  <div className="dropdown-panel-title">
                                    <Play size={12} className="bullet-ico" />
                                    <span>Video Watch Log: <strong>{p.user?.name}</strong> — {p.course?.title}</span>
                                  </div>
                                  <div className="lecture-cards-list-grid">
                                    {(p.watchedVideos || []).length === 0 ? (
                                      <p style={{ color: '#a0aec0', padding: '8px 0' }}>No videos tracked yet.</p>
                                    ) : (
                                      (p.watchedVideos || []).map((v, idx) => (
                                        <div className="lecture-track-card" key={v._id || idx}>
                                          <div className="lec-status-bar" style={{
                                            backgroundColor: v.completed ? '#10b981' : v.watchedSeconds > 0 ? '#6366f1' : '#e2e8f0'
                                          }}></div>
                                          <div className="lec-card-info">
                                            <div className="lec-card-main-head">
                                              <span className="lec-title-text">{v.lectureTitle || v.video?.title || `Video ${idx + 1}`}</span>
                                            </div>
                                            <div className="lec-card-footer">
                                              <div className="lec-pct-progress-bar">
                                                <div className="progress-rail">
                                                  <div className="progress-fill" style={{
                                                    width: v.totalSeconds > 0 ? `${Math.round((v.watchedSeconds / v.totalSeconds) * 100)}%` : '0%'
                                                  }}></div>
                                                </div>
                                                <span className="progress-pct-val">
                                                  {v.totalSeconds > 0 ? Math.round((v.watchedSeconds / v.totalSeconds) * 100) : 0}% Watched
                                                </span>
                                              </div>
                                              <span className={`lec-status-tag ${v.completed ? 'completed' : 'in-progress'}`}>
                                                {v.completed ? 'Completed' : 'In Progress'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>

                {progressTotal > 25 && (
                  <div className="history-pagination" style={{ borderTop: '1px solid #edf2f7', padding: 16 }}>
                    <button disabled={progressPage === 1} onClick={() => setProgressPage((p) => p - 1)} className="btn-page">← Prev</button>
                    <span>Page {progressPage} of {Math.ceil(progressTotal / 25)}</span>
                    <button disabled={progressPage >= Math.ceil(progressTotal / 25)} onClick={() => setProgressPage((p) => p + 1)} className="btn-page">Next →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PER-COURSE REPORT (FR-48) ─────────────────────────────────────── */}
        {activeTab === 'course' && (
          <div className="tab-panel animate-fade">
            <div className="pane-box" style={{ marginBottom: 24 }}>
              <div className="box-head">
                <h3 className="box-title">Select a Course to View Report</h3>
              </div>
              <select
                className="filter-dropdown"
                style={{ width: '100%', maxWidth: 480, marginTop: 12, padding: '10px 14px', fontSize: 14 }}
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                <option value="">— Choose a course —</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
            </div>

            {courseReportLoading && (
              <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>
                <RefreshCw size={22} className="spinning-loader" />
                <p style={{ marginTop: 10 }}>Loading course report...</p>
              </div>
            )}

            {courseReport && !courseReportLoading && (
              <div className="courses-grid-matrix">
                <div className="course-progress-box-card">
                  <div className="course-box-head">
                    <span className="course-category-tag">{courseReport.course?.instructor || 'Course'}</span>
                    <h3 className="course-box-title">{courseReport.course?.title}</h3>
                  </div>
                  <div className="course-radial-row">
                    <div className="radial-dial-col">
                      <svg className="radial-svg-large" width="90" height="90" viewBox="0 0 36 36">
                        <path className="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="ring-fill" strokeDasharray={`${courseReport.summary.avgCompletion}, 100`} stroke="#10b981" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.35" className="ring-text-lg">{courseReport.summary.avgCompletion}%</text>
                      </svg>
                      <span className="radial-label">Avg Completion</span>
                    </div>
                    <div className="course-stats-details-col">
                      <div className="course-stat-metric">
                        <span className="metric-lbl-sm">Total Enrolled</span>
                        <span className="metric-val-sm">{courseReport.summary.totalEnrolled}</span>
                      </div>
                      <div className="course-stat-metric">
                        <span className="metric-lbl-sm">Completed</span>
                        <span className="metric-val-sm text-indigo">{courseReport.summary.completed}</span>
                      </div>
                      <div className="course-stat-metric">
                        <span className="metric-lbl-sm">In Progress</span>
                        <span className="metric-val-sm">{courseReport.summary.inProgress}</span>
                      </div>
                      <div className="course-stat-metric">
                        <span className="metric-lbl-sm">Not Started</span>
                        <span className="metric-val-sm">{courseReport.summary.notStarted}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student list for this course */}
                <div className="pane-box" style={{ gridColumn: '1/-1' }}>
                  <div className="box-head"><h3 className="box-title">Students in this Course</h3></div>
                  <div className="data-table-container" style={{ marginTop: 12 }}>
                    <table className="progress-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Progress %</th>
                          <th>Videos Completed</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseReport.progress.length === 0 ? (
                          <tr><td colSpan="4" className="empty-results-cell"><p>No students enrolled yet.</p></td></tr>
                        ) : (
                          courseReport.progress.map((p) => (
                            <tr key={p._id} className="student-data-row">
                              <td>
                                <div className="student-profile-cell">
                                  <div className="student-avatar" style={{ backgroundColor: '#6366f1' }}>
                                    {(p.user?.name || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="student-names-block">
                                    <span className="st-name-txt">{p.user?.name || 'Unknown'}</span>
                                    <span className="st-email-txt">{p.user?.email || ''}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="progress-bar-cell">
                                  <span className="bar-val-txt">{p.percentageComplete}%</span>
                                  <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${p.percentageComplete}%`, backgroundColor: statusColor[p.status] }}></div>
                                  </div>
                                </div>
                              </td>
                              <td className="st-completion-txt">{p.completedVideos}/{p.totalVideos}</td>
                              <td><span className={`status-badge-pill ${p.status}`}>{statusLabel[p.status]}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS & EXPORTS (FR-48) ─────────────────────────────────────── */}
        {activeTab === 'reports' && (
          <div className="tab-panel animate-fade">
            <div className="reports-layout-grid">
              <div className="pane-box reports-config-box">
                <div className="box-head">
                  <h3 className="box-title">Compile Progress Reports</h3>
                  <p className="box-subtitle">Export student or course progress as CSV.</p>
                </div>
                <div className="reports-settings-form">
                  <div className="reports-action-triggers-col">
                    <button className="report-btn bg-indigo" onClick={() => triggerCSVDownload('students')}>
                      <Download size={16} />
                      <span>Export Students CSV (FR-48)</span>
                    </button>
                    <button className="report-btn bg-emerald" onClick={() => triggerCSVDownload('courses')}>
                      <Download size={16} />
                      <span>Export Course Report CSV</span>
                    </button>
                    <button className="report-btn bg-dark-slate" onClick={() => window.print()}>
                      <FileText size={16} />
                      <span>Print PDF Report</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pane-box reports-preview-box">
                <div className="box-head-row">
                  <div>
                    <h3 className="box-title">Live Preview</h3>
                    <p className="box-subtitle">Current progress records from the database.</p>
                  </div>
                  <span className="live-preview-indicator">
                    <span className="blink-dot"></span>
                    <span>Live</span>
                  </span>
                </div>
                <div className="spreadsheet-preview-wrapper">
                  <table className="preview-spreadsheet">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Course</th>
                        <th>Progress</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProgress.slice(0, 5).map((p, i) => (
                        <tr key={i}>
                          <td className="bold-cell">{p.user?.name || '—'}</td>
                          <td className="muted-cell">{(p.course?.title || '').substring(0, 28)}{(p.course?.title || '').length > 28 ? '...' : ''}</td>
                          <td className="progress-cell-preview">
                            <span className="preview-pct">{p.percentageComplete}%</span>
                            <div className="preview-rail-sm">
                              <div className="preview-fill-sm" style={{ width: `${p.percentageComplete}%` }}></div>
                            </div>
                          </td>
                          <td>
                            <span className={`preview-badge ${p.status}`}>{statusLabel[p.status]}</span>
                          </td>
                        </tr>
                      ))}
                      {filteredProgress.length === 0 && (
                        <tr><td colSpan="4" style={{ padding: 16, color: '#a0aec0', textAlign: 'center' }}>No records loaded</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div className="spreadsheet-fade-footer">
                    <span>Showing {Math.min(5, filteredProgress.length)} of {progressTotal} records. Export CSV for full dataset.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Progress;