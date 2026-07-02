import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, NavLink, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, CreditCard, Settings, Bell,
  ChevronLeft, ChevronRight, LogOut, ShieldAlert, Menu, X
} from 'lucide-react';
import './UserLayout.css';
import { NOTIFICATION_ENDPOINTS, AUTH_ENDPOINTS } from '../../utils/api';
import { initScreenshotDetection } from '../../utils/screenshotDetector';

const getToken = () => localStorage.getItem('lms_token');

const USER_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'My Courses', icon: BookOpen, to: '/dashboard/courses' },
  { label: 'Subscriptions', icon: CreditCard, to: '/dashboard/subscriptions' },
  { label: 'Account & Security', icon: Settings, to: '/dashboard/settings' },
  { label: 'Notifications', icon: Bell, to: '/dashboard/notifications', badge: true },
];

const UserLayout = () => {
  const token = localStorage.getItem('lms_token');
  const role = localStorage.getItem('lms_user_role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'user') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth <= 768);
  const [userProfile, setUserProfile] = useState({ name: 'Student', email: '' });
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [ipWarning, setIpWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Anti-Screenshot & Screen Capture Protection (FR-30, FR-31)
  useEffect(() => {
    const cleanup = initScreenshotDetection();
    return cleanup;
  }, []);

  // Fetch real unread count from API
  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(NOTIFICATION_ENDPOINTS.MY, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotificationsCount(data.data.unreadCount || 0);
      }
    } catch (_) {
      // silently fail — badge stays at 0
    }
  }, []);

  useEffect(() => {
    // Read user details from localStorage
    const saved = localStorage.getItem('lms_user_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUserProfile(parsed);
      if (parsed.ipLockEnabled && parsed.ip !== parsed.registeredIp) {
        setIpWarning(true);
      } else {
        setIpWarning(false);
      }
    }

    const handleProfileUpdate = () => {
      const updated = localStorage.getItem('lms_user_profile');
      if (updated) {
        const parsed = JSON.parse(updated);
        setUserProfile(parsed);
        if (parsed.ipLockEnabled && parsed.ip !== parsed.registeredIp) {
          setIpWarning(true);
        } else {
          setIpWarning(false);
        }
      }
    };

    window.addEventListener('storage', handleProfileUpdate);
    window.addEventListener('lms_profile_sync', handleProfileUpdate);

    return () => {
      window.removeEventListener('storage', handleProfileUpdate);
      window.removeEventListener('lms_profile_sync', handleProfileUpdate);
    };
  }, [location.pathname]);

  // Fetch unread count on mount and when navigating away from notifications page
  useEffect(() => {
    fetchUnreadCount();
  }, [location.pathname, fetchUnreadCount]);

  // Listen for custom event fired by UserNotifications after marking as read
  useEffect(() => {
    const handler = () => fetchUnreadCount();
    window.addEventListener('lms_notifications_read', handler);
    return () => window.removeEventListener('lms_notifications_read', handler);
  }, [fetchUnreadCount]);

  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('lms_token');
    if (!token) return;
    try {
      const res = await fetch(AUTH_ENDPOINTS.PROFILE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user_role');
        localStorage.removeItem('lms_user_profile');
        navigate('/login');
      }
    } catch (_) {
      // network error — don't log out
    }
  }, [navigate]);

  // Trigger check immediately on every route transition
  useEffect(() => {
    checkSession();
  }, [location.pathname, checkSession]);

  // Trigger check immediately when browser tab receives focus
  useEffect(() => {
    window.addEventListener('focus', checkSession);
    return () => window.removeEventListener('focus', checkSession);
  }, [checkSession]);

  // Check periodically (every 5 seconds) to catch forced logout immediately
  useEffect(() => {
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, [checkSession]);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      const token = localStorage.getItem('lms_token');
      if (token) {
        try {
          await fetch(AUTH_ENDPOINTS.LOGOUT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {
          // ignore — still log out locally
        }
      }
      localStorage.removeItem('lms_user_role');
      localStorage.removeItem('lms_token');
      localStorage.removeItem('lms_user_profile');
      navigate('/login');
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className={`user-layout ${isSidebarCollapsed ? 'collapsed' : ''}`} onContextMenu={(e) => e.preventDefault()}>


      {/* Sidebar */}
      <aside className={`user-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">S</div>
          <div className="logo-text">
            <span className="brand-name">LMS Portal</span>
            <span className="brand-sub">STUDENT HUB</span>
          </div>
        </div>

        {ipWarning && (
          <div className="ip-lock-alert" onClick={() => navigate('/dashboard/settings')}>
            <ShieldAlert size={16} />
            {!isSidebarCollapsed && <span>IP Mismatch Flagged!</span>}
          </div>
        )}

        <div className="sidebar-sections">
          <nav className="sidebar-nav">
            {USER_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                  {!isSidebarCollapsed && item.badge && notificationsCount > 0 && (
                    <span className="nav-badge">{notificationsCount}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            {userProfile.profilePicture ? (
              <img src={userProfile.profilePicture} alt="Avatar" className="user-avatar-img" />
            ) : (
              <div className="user-avatar">{userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}</div>
            )}
            <div className="user-info">
              <span className="user-name">{userProfile.name}</span>
              <span className="user-role">Student</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="user-main">
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
        </button>

        {/* Dynamic User Header */}
        <header className="user-header">
          <div className="user-header-left">
            <h1 className="welcome-title">Hi, {userProfile.name}!</h1>
            <p className="welcome-date">{currentDate}</p>
          </div>

          <div className="header-right">
            <button
              className="notification-btn"
              onClick={() => navigate('/dashboard/notifications')}
            >
              <Bell size={18} />
              {notificationsCount > 0 && <span className="badge"></span>}
            </button>
            <button className="mobile-logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
            <div className="plan-pill active-pro">
              {userProfile.subscribed ? 'Premium Active' : 'Free Access Tier'}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <div className="user-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default UserLayout;