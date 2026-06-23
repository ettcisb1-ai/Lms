import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, Clock, Send, Eye, EyeOff, Trash2, CheckSquare, RefreshCw } from 'lucide-react';
import './UserNotifications.css';
import { NOTIFICATION_ENDPOINTS } from '../../utils/api';
import { ShimmerNotifications } from '../../components/Shimmer/Shimmer';
const getToken = () => localStorage.getItem('lms_token');

// Map API notification types to display categories
const typeToCategory = {
  new_content: 'content',
  subscription_expiry: 'account',
  broadcast: 'broadcast',
};

const UserNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(NOTIFICATION_ENDPOINTS.MY, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        // Normalize API shape to match component expectations
        const normalized = data.data.notifications.map((n) => ({
          id: n._id,
          title: n.title,
          text: n.message,
          category: typeToCategory[n.type] || 'broadcast',
          time: formatTime(n.createdAt),
          isRead: n.isRead,
        }));
        setNotifications(normalized);
      }
    } catch (_) {
      // Network error — show empty state, don't crash
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  // Mark one as read via API
  const handleMarkAsRead = async (id) => {
    try {
      await fetch(NOTIFICATION_ENDPOINTS.MARK_READ, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ notificationIds: [id] }),
      });
    } catch (_) { }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    // Notify UserLayout to refresh badge count
    window.dispatchEvent(new Event('lms_notifications_read'));
  };

  // Mark all as read via API
  const handleMarkAllAsRead = async () => {
    try {
      await fetch(NOTIFICATION_ENDPOINTS.MARK_READ, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}), // empty = mark all
      });
    } catch (_) { }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    window.dispatchEvent(new Event('lms_notifications_read'));
  };

  // Delete is local only (no delete endpoint needed — just hide from view)
  const handleDelete = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    window.dispatchEvent(new Event('lms_notifications_read'));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'All') return true;
    return n.category === activeFilter.toLowerCase();
  });

  const getCategoryIcon = (cat) => {
    if (cat === 'content') return <BellRing size={16} className="text-orange" />;
    if (cat === 'account') return <Clock size={16} className="text-purple" />;
    return <Send size={16} className="text-blue" />;
  };

  return (
    <div className="user-notifications-page">
      <div className="notifications-header-row">
        <div>
          <h2>Notification Center</h2>
          <p>Stay updated with class notifications and administrative broadcasts.</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-mark-all" onClick={fetchNotifications} title="Refresh">
            <RefreshCw size={14} />
          </button>
          {notifications.some((n) => !n.isRead) && (
            <button className="btn-mark-all" onClick={handleMarkAllAsRead}>
              <CheckSquare size={14} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Category filters */}
      <div className="notifications-toolbar">
        <div className="filter-tabs-row">
          {[
            { key: 'All', label: 'All' },
            { key: 'Content', label: 'Content' },
            { key: 'Account', label: 'Account' },
            { key: 'Broadcast', label: 'Broadcasts' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`filter-tab-btn ${activeFilter === tab.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      <div className="notifications-list-wrapper">
        {loading ? (
          <ShimmerNotifications count={5} />
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-notifications-card">
            <Bell size={32} />
            <p>
              You have no active notifications under{' '}
              {activeFilter === 'All'
                ? 'all categories'
                : activeFilter === 'Broadcast'
                  ? 'broadcasts'
                  : activeFilter.toLowerCase()}
              .
            </p>
          </div>
        ) : (
          <div className="notifications-stack">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-alert-row ${notif.isRead ? 'read-status' : 'unread-status'}`}
              >
                <div className="notif-avatar-box">
                  {getCategoryIcon(notif.category)}
                </div>

                <div className="notif-body">
                  <div className="notif-top">
                    <h4>{notif.title}</h4>
                    <span className="notif-time">{notif.time}</span>
                  </div>
                  <p className="notif-text">{notif.text}</p>
                </div>

                <div className="notif-actions">
                  {!notif.isRead ? (
                    <button
                      className="action-icon-btn read"
                      onClick={() => handleMarkAsRead(notif.id)}
                      title="Mark as Read"
                    >
                      <Eye size={15} />
                    </button>
                  ) : (
                    <span className="read-stamp"><EyeOff size={13} /> Read</span>
                  )}
                  <button
                    className="action-icon-btn delete"
                    onClick={() => handleDelete(notif.id)}
                    title="Dismiss"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserNotifications;