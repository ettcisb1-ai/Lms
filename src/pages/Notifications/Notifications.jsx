import React, { useState, useEffect, useContext } from 'react';
import { PendingTabContext } from '../../components/AdminLayout/AdminLayout';
import { Send, Bell, Users, Clock, BookOpen, CreditCard, ToggleLeft, ToggleRight, Plus, X, Save, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import './Notifications.css';
import { COURSE_ENDPOINTS, NOTIFICATION_ENDPOINTS } from '../../utils/api';

const getToken = () => localStorage.getItem('lms_token');

const Notifications = () => {
  const [activeTab, setActiveTab] = useState('broadcast');
  const { tab, route, clearPendingTab } = useContext(PendingTabContext);
  useEffect(() => {
    if (tab && route === '/admin/notifications') {
      setActiveTab(tab);
      clearPendingTab();
    }
  }, [tab, route]);

  // ── Broadcast state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  // ── FR-43 New content trigger state ─────────────────────────────────────────
  const [courses, setCourses] = useState([]);
  const [contentForm, setContentForm] = useState({ courseId: '', title: '', message: '' });
  const [contentSending, setContentSending] = useState(false);
  const [contentResult, setContentResult] = useState(null);

  // ── FR-44 Expiry reminder state ──────────────────────────────────────────────
  const [expiryDays, setExpiryDays] = useState(3);
  const [expirySending, setExpirySending] = useState(false);
  const [expiryResult, setExpiryResult] = useState(null);

  // ── History state ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  // ── Load courses for FR-43 dropdown ─────────────────────────────────────────
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch(COURSE_ENDPOINTS.LIST, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (data.success) setCourses(data.data || []);
      } catch (_) {
        // silently ignore — courses list is just for convenience
      }
    };
    fetchCourses();
  }, []);

  // ── Load notification history ────────────────────────────────────────────────
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: historyPage, limit: 20 });
      if (historyFilter) params.set('type', historyFilter);
      const res = await fetch(NOTIFICATION_ENDPOINTS.ADMIN_LIST(params), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data.notifications);
        setHistoryTotal(data.data.total);
      }
    } catch (_) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, historyFilter, historyPage]);

  // ── FR-45: Send broadcast ────────────────────────────────────────────────────
  const handleBroadcast = async (e) => {
    e.preventDefault();
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(NOTIFICATION_ENDPOINTS.BROADCAST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ title, message, audience }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setTitle('');
          setMessage('');
        }, 3000);
      } else {
        setSendError(data.message || 'Failed to send broadcast');
      }
    } catch (err) {
      setSendError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── FR-43: Trigger new-content notification ──────────────────────────────────
  const handleNewContent = async () => {
    if (!contentForm.courseId || !contentForm.title || !contentForm.message) return;
    setContentSending(true);
    setContentResult(null);
    try {
      const res = await fetch(NOTIFICATION_ENDPOINTS.NEW_CONTENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(contentForm),
      });
      const data = await res.json();
      setContentResult({ success: data.success, message: data.message, sent: data.data?.sent });
    } catch (_) {
      setContentResult({ success: false, message: 'Network error' });
    } finally {
      setContentSending(false);
    }
  };

  // ── FR-44: Trigger expiry reminder ───────────────────────────────────────────
  const handleExpiryReminder = async () => {
    setExpirySending(true);
    setExpiryResult(null);
    try {
      const res = await fetch(NOTIFICATION_ENDPOINTS.EXPIRY_REMINDER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ daysBeforeExpiry: expiryDays }),
      });
      const data = await res.json();
      setExpiryResult({ success: data.success, message: data.message, sent: data.data?.sent });
    } catch (_) {
      setExpiryResult({ success: false, message: 'Network error' });
    } finally {
      setExpirySending(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const typeLabel = { broadcast: '📢 Broadcast', new_content: '📚 New Content', subscription_expiry: '⏰ Expiry' };

  return (
    <div className="notifications-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="page-subtitle">Broadcast messages and trigger automated notification reminders.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="notif-tabs">
        <button className={`notif-tab-btn ${activeTab === 'broadcast' ? 'active' : ''}`} onClick={() => setActiveTab('broadcast')}>
          <Send size={15} /> Broadcast
        </button>
        {/* <button className={`notif-tab-btn ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
          <BookOpen size={15} /> New Content Alerts
        </button>
        <button className={`notif-tab-btn ${activeTab === 'expiry' ? 'active' : ''}`} onClick={() => setActiveTab('expiry')}>
          <CreditCard size={15} /> Expiry Reminders
        </button> */}
        <button className={`notif-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <Clock size={15} /> History
        </button>
      </div>

      {/* ── Tab: FR-45 Broadcast ──────────────────────────────────────────────── */}
      {activeTab === 'broadcast' && (
        <div className="notifications-grid">
          <div className="card compose-card">
            <div className="card-header">
              <Bell className="header-icon text-blue" />
              <h3 className="card-title">Compose Broadcast</h3>
            </div>
            <div className="card-body">
              {sent ? (
                <div className="sent-success">
                  <CheckCircle size={40} className="success-icon" />
                  <h3>Notification Sent!</h3>
                  <p>Your message has been delivered to <strong>{audience === 'all' ? 'all users' : audience}</strong>.</p>
                </div>
              ) : (
                <form onSubmit={handleBroadcast}>
                  {sendError && (
                    <div className="error-banner">
                      <AlertCircle size={14} /> {sendError}
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Notification Title</label>
                    <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Course Available!" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message Content</label>
                    <textarea className="form-control" rows="5" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message here..." required></textarea>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Audience</label>
                    <select className="form-control" value={audience} onChange={(e) => setAudience(e.target.value)}>
                      <option value="all">All Users</option>
                      <option value="subscribed">Subscribed Users</option>
                      <option value="expiring">Expiring Subscriptions</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={sending}>
                      {sending ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
                      <span>{sending ? 'Sending...' : 'Send Broadcast'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* <div className="card history-card">
            <div className="card-header">
              <Clock className="header-icon text-purple" />
              <h3 className="card-title">About Broadcasts (FR-45)</h3>
            </div>
            <div className="card-body">
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Broadcasts are delivered to users via the notification system. Choose <strong>All Users</strong> to reach everyone, <strong>Subscribed Users</strong> for paying members, or <strong>Expiring Subscriptions</strong> to target users whose plan expires within 7 days.
              </p>
              <div className="trigger-info-banner" style={{ marginTop: 16 }}>
                <Bell size={14} />
                <div><strong>API:</strong> POST /api/notifications/broadcast</div>
              </div>
            </div>
          </div> */}
        </div>
      )}

      {/* ── Tab: FR-43 New Content Alerts ── */}
      {false && activeTab === 'content' && (
        <div className="trigger-section">
          {/* <div className="trigger-info-banner">
            <BookOpen size={16} />
            <div>
              <strong>FR-43 — Automatic New Content Notifications</strong>
              <p>When a new video is added to a course, enrolled users are automatically notified. You can also manually trigger a notification here.</p>
            </div>
          </div> */}

          <div className="card">
            <div className="card-header">
              <BookOpen className="header-icon text-blue" />
              <h3 className="card-title">Trigger New Content Notification</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Select Course</label>
                <select
                  className="form-control"
                  value={contentForm.courseId}
                  onChange={(e) => setContentForm((p) => ({ ...p, courseId: e.target.value }))}
                >
                  <option value="">— Choose a course —</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notification Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. New video added to React Masterclass"
                  value={contentForm.title}
                  onChange={(e) => setContentForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="A new lecture has been added. Check it out!"
                  value={contentForm.message}
                  onChange={(e) => setContentForm((p) => ({ ...p, message: e.target.value }))}
                />
              </div>

              {contentResult && (
                <div className={`result-banner ${contentResult.success ? 'success' : 'error'}`}>
                  {contentResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span>{contentResult.message}{contentResult.sent !== undefined ? ` — ${contentResult.sent} user(s) notified.` : ''}</span>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleNewContent}
                  disabled={contentSending || !contentForm.courseId || !contentForm.title || !contentForm.message}
                >
                  {contentSending ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
                  <span>{contentSending ? 'Sending...' : 'Send to Enrolled Users'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: FR-44 Expiry Reminders ── */}
      {false && activeTab === 'expiry' && (
        <div className="trigger-section">
          {/* <div className="trigger-info-banner amber">
            <CreditCard size={16} />
            <div>
              <strong>FR-44 — Subscription Expiry Reminders</strong>
              <p>Automatically notify users before their subscription expires. Set the days threshold and trigger the reminder.</p>
            </div>
          </div> */}

          <div className="card">
            <div className="card-header">
              <CreditCard className="header-icon text-purple" />
              <h3 className="card-title">Trigger Expiry Reminder</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Notify users expiring within</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: 120 }}
                    min={1}
                    max={30}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                  />
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>day(s)</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 6 }}>
                  Users whose subscription expires within the next <strong>{expiryDays} day(s)</strong> will receive a reminder.
                </p>
              </div>

              {expiryResult && (
                <div className={`result-banner ${expiryResult.success ? 'success' : 'error'}`}>
                  {expiryResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span>{expiryResult.message}{expiryResult.sent !== undefined ? ` — ${expiryResult.sent} user(s) notified.` : ''}</span>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleExpiryReminder}
                  disabled={expirySending}
                >
                  {expirySending ? <RefreshCw size={16} className="spinning" /> : <CreditCard size={16} />}
                  <span>{expirySending ? 'Sending...' : 'Send Expiry Reminders'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: History ─────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock className="header-icon text-purple" />
              <h3 className="card-title">All Notification History</h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="form-control"
                style={{ width: 180, fontSize: '0.8rem' }}
                value={historyFilter}
                onChange={(e) => { setHistoryFilter(e.target.value); setHistoryPage(1); }}
              >
                <option value="">All Types</option>
                <option value="broadcast">Broadcast</option>
                <option value="new_content">New Content</option>
                <option value="subscription_expiry">Expiry Reminder</option>
              </select>
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={loadHistory}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            {historyLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <RefreshCw size={20} className="spinning" style={{ marginBottom: 8 }} />
                <p>Loading history...</p>
              </div>
            ) : (
              <div className="history-list">
                {history.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <Bell size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p>No notifications sent yet.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item._id} className="history-item">
                      <div className="history-item-top">
                        <span className={`notif-type-badge ${item.type}`}>{typeLabel[item.type] || item.type}</span>
                        <span className="history-time">{formatDate(item.createdAt)}</span>
                      </div>
                      <h4 className="history-title">{item.title}</h4>
                      <p className="history-desc">{item.message}</p>
                      <div className="history-meta">
                        {item.user ? (
                          <span className="badge-audience">{item.user.name || item.user.email}</span>
                        ) : (
                          <span className="badge-audience">{item.audience === 'all' ? 'All Users' : item.audience}</span>
                        )}
                        {item.course && (
                          <span className="badge-audience" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                            {item.course.title}
                          </span>
                        )}
                        <span className={`notif-read-badge ${item.isRead ? 'read' : 'unread'}`}>
                          {item.isRead ? 'Read' : 'Unread'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {historyTotal > 20 && (
              <div className="history-pagination">
                <button disabled={historyPage === 1} onClick={() => setHistoryPage((p) => p - 1)} className="btn-page">← Prev</button>
                <span>Page {historyPage} of {Math.ceil(historyTotal / 20)}</span>
                <button disabled={historyPage >= Math.ceil(historyTotal / 20)} onClick={() => setHistoryPage((p) => p + 1)} className="btn-page">Next →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;