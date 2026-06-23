import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Ban, Key, BookOpen, LogOut, Edit2, Activity,
  Clock, CheckCircle, X, Shield, BookX, Unlock, Lock, Loader
} from 'lucide-react';
import './UserDetails.css';
import { ADMIN_ENDPOINTS, COURSE_ENDPOINTS } from '../../utils/api';

const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Course assignment modal
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [allCourses, setAllCourses] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [savingCourses, setSavingCourses] = useState(false);

  const token = localStorage.getItem('lms_token');

  const fetchUser = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(ADMIN_ENDPOINTS.USER_DETAIL(id), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to load user.');
      setUser(result.data);
      setAssignedCourses(result.data.courses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllCourses = async () => {
    try {
      const res = await fetch(COURSE_ENDPOINTS.LIST);
      const result = await res.json();
      if (result.success) setAllCourses(result.data);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchAllCourses();
  }, [id]);

  const openCourseModal = () => {
    setAssignedCourses(user?.courses || []);
    setShowCourseModal(true);
  };

  const toggleCourse = (courseTitle) => {
    setAssignedCourses(prev =>
      prev.includes(courseTitle) ? prev.filter(c => c !== courseTitle) : [...prev, courseTitle]
    );
  };

  const saveCourseAssignment = async () => {
    setSavingCourses(true);
    try {
      const res = await fetch(ADMIN_ENDPOINTS.USER_DETAIL(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ courses: assignedCourses })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to save courses.');
      setUser(prev => ({ ...prev, courses: assignedCourses }));
      setShowCourseModal(false);
    } catch (err) {
      alert(err.message || 'Failed to save course assignments.');
    } finally {
      setSavingCourses(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!window.confirm(`${user.isActive ? 'Suspend' : 'Activate'} this user?`)) return;
    try {
      const res = await fetch(ADMIN_ENDPOINTS.USER_STATUS(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: !user.isActive })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setUser(prev => ({ ...prev, isActive: !prev.isActive }));
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const formatDate = (str) => {
    if (!str) return '—';
    try { return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return str; }
  };

  const formatDateTime = (str) => {
    if (!str) return '—';
    try { return new Date(str).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }); }
    catch { return str; }
  };

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', gap: '12px' }}>
      <Loader size={20} className="spin" /> Loading user details...
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
      <p>{error}</p>
      <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={() => navigate('/admin/users')}>← Back to Users</button>
    </div>
  );

  const lastLogin = user.activityLog?.filter(l => l.action?.toLowerCase().includes('logged in'))
    .sort((a, b) => new Date(b.time) - new Date(a.time))[0];

  return (
    <div className="user-details-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/admin/users')}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="page-title">User Details</h2>
            <p className="page-subtitle">Detailed view and management for {user.name}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate(`/admin/users`)}>
            <Edit2 size={16} /> Edit
          </button>
          <button className={user.isActive ? 'btn-danger' : 'btn-secondary'} onClick={handleToggleStatus}>
            {user.isActive ? <><Ban size={16} /> Suspend</> : <><CheckCircle size={16} /> Activate</>}
          </button>
        </div>
      </div>

      <div className="details-layout">
        <div className="details-sidebar">
          <div className="card profile-card">
            <div className="user-avatar-large">{user.name?.charAt(0)?.toUpperCase()}</div>
            <h3 className="profile-name">{user.name}</h3>
            <p className="profile-email">{user.email}</p>
            <div className="profile-badges">
              <span className={`role-badge ${user.role?.toLowerCase()}`}>{user.role}</span>
              <span className={`status-badge ${user.isActive ? 'active' : 'suspended'}`}>
                {user.isActive ? 'Active' : 'Suspended'}
              </span>
            </div>
          </div>

          <div className="card action-card">
            <h4 className="card-heading">Quick Actions</h4>
            <div className="action-list">
              <button className="action-btn" onClick={handleToggleStatus}>
                <Ban size={16} className="text-warning" />
                {user.isActive ? 'Suspend User' : 'Activate User'}
              </button>
              <button className="action-btn" onClick={() => alert('Password reset link generated.')}>
                <Key size={16} /> Reset Password
              </button>
              <button className="action-btn" onClick={openCourseModal}>
                <BookOpen size={16} /> Assign Courses
              </button>
            </div>
          </div>
        </div>

        <div className="details-main">
          <div className="card info-card">
            <h4 className="card-heading">Account Overview</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Phone</span>
                <span className="info-value">{user.phoneNumber || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Subscription</span>
                <span className="info-value">{user.subscribed ? `Pro (${user.planType})` : 'Free'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Registered</span>
                <span className="info-value">{formatDate(user.createdAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Login</span>
                <span className="info-value">{lastLogin ? formatDateTime(lastLogin.time) : '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Registered IP</span>
                <span className="info-value">{user.registeredIp || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Current IP</span>
                <span className="info-value">{user.ip || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Plan Expiry</span>
                <span className="info-value">{user.expiryDate || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">IP Lock</span>
                <span className="info-value">{user.ipLockEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>

          {/* Assigned Courses */}
          <div className="card info-card">
            <div className="card-header-flex">
              <h4 className="card-heading">Assigned Courses ({(user.courses || []).length})</h4>
              <button className="btn-primary" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={openCourseModal}>
                <BookOpen size={14} /> Manage
              </button>
            </div>

            {(user.courses || []).length === 0 ? (
              <p className="text-muted text-sm" style={{ marginTop: '12px' }}>No courses assigned yet. Click Manage to assign courses.</p>
            ) : (
              <ul className="course-list" style={{ marginTop: '12px' }}>
                {user.courses.map((courseTitle, idx) => (
                  <li key={idx} className="course-list-item">
                    <BookOpen size={15} className="text-muted" />
                    <span>{courseTitle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activity & Watch History */}
          <div className="card info-card">
            <h4 className="card-heading">Watch History & Activity</h4>
            <div className="activity-timeline">
              {(user.watchHistory || []).length > 0 ? user.watchHistory.map((h, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-icon"><Clock size={14} /></div>
                  <div className="timeline-content">
                    <div className="timeline-title">Watched <strong>{h.title}</strong></div>
                    <div className="timeline-meta">{h.duration} • {formatDateTime(h.date)}</div>
                  </div>
                </div>
              )) : (
                <p className="text-muted text-sm">No watch history available.</p>
              )}
              {(user.activityLog || []).slice(0, 5).map((log, idx) => (
                <div key={`log-${idx}`} className="timeline-item">
                  <div className="timeline-icon"><Activity size={14} /></div>
                  <div className="timeline-content">
                    <div className="timeline-title">{log.action}</div>
                    <div className="timeline-meta">{log.ip} • {log.device} • {formatDateTime(log.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Course Assignment Modal */}
      {showCourseModal && (
        <div className="modal-backdrop" onClick={savingCourses ? undefined : () => setShowCourseModal(false)}>
          <div className="access-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Assign Courses</h3>
                <p className="modal-sub">{user.name} · {assignedCourses.length} course{assignedCourses.length !== 1 ? 's' : ''} assigned</p>
              </div>
              <button className="icon-btn close-btn" onClick={() => setShowCourseModal(false)} disabled={savingCourses}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="access-desc">Toggle courses on or off. Changes are saved when you click "Save Access".</p>
              <div className="course-access-list">
                {allCourses.length === 0 ? (
                  <p className="text-muted text-sm text-center" style={{ padding: '24px 0' }}>No courses found. Please create courses first.</p>
                ) : allCourses.map(course => {
                  const hasAccess = assignedCourses.includes(course.title);
                  return (
                    <div key={course._id} className={`course-access-row ${hasAccess ? 'granted' : 'denied'}`}>
                      <div className="course-access-info">
                        {hasAccess
                          ? <BookOpen size={16} className="ca-icon granted" />
                          : <BookX size={16} className="ca-icon denied" />
                        }
                        <div>
                          <span className="course-access-name">{course.title}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                            {course.category?.name || 'Uncategorized'} · {course.difficulty}
                          </span>
                        </div>
                      </div>
                      <button
                        className={`access-toggle-btn ${hasAccess ? 'revoke' : 'grant'}`}
                        onClick={() => toggleCourse(course.title)}
                      >
                        {hasAccess ? <><Lock size={13} /> Revoke</> : <><Unlock size={13} /> Grant</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCourseModal(false)} disabled={savingCourses}>Cancel</button>
              <button className="btn-primary" onClick={saveCourseAssignment} disabled={savingCourses}>
                {savingCourses ? <Loader size={15} className="spin-icon" /> : <Shield size={15} />}
                <span>{savingCourses ? 'Saving Access...' : 'Save Access'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetails;