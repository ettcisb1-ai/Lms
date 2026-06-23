import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Search, MoreVertical, X, Ban,
  CheckCircle, Key, Book, LogOut, ChevronLeft, ChevronRight,
  Activity, Clock, Eye, AlertTriangle, Shield, Lock, Unlock,
  BookOpen, BookX, Loader, Smartphone
} from 'lucide-react';
import UserDetailsPanel from '../../components/UserDetailsPanel/UserDetailsPanel';
import { ADMIN_ENDPOINTS, COURSE_ENDPOINTS } from '../../utils/api';
import './Users.css';
import { ShimmerUsers } from '../../components/Shimmer/Shimmer';

const ALL_COURSES = [
  'React Masterclass', 'UI/UX Principles', 'Data Science Fundamentals',
  'Frontend Web Dev', 'Advanced Node.js', 'iOS & Swift', 'Python & AI'
];


const ITEMS_PER_PAGE = 4;

const formatLogTime = (timeString) => {
  if (!timeString) return '—';
  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return timeString;
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return timeString;
  }
};

const getRealLastLogin = (activityLog) => {
  if (!activityLog || activityLog.length === 0) return '—';
  const logins = activityLog.filter(log =>
    log.action === 'Logged in' ||
    log.action === 'Logged in from new IP' ||
    log.action === 'Account Created'
  );
  if (logins.length === 0) return '—';
  const sorted = [...logins].sort((a, b) => new Date(b.time) - new Date(a.time));
  return formatLogTime(sorted[0].time);
};

const getLatestDevice = (activityLog) => {
  if (!activityLog || activityLog.length === 0) return '—';
  const logins = activityLog.filter(log =>
    log.action === 'Logged in' ||
    log.action === 'Logged in from new IP' ||
    log.action === 'Account Created'
  );
  if (logins.length === 0) return '—';
  const sorted = [...logins].sort((a, b) => new Date(b.time) - new Date(a.time));
  const latest = sorted[0];
  let ua = latest.device || '—';
  if (ua.includes('Windows NT')) {
    let browser = 'Chrome';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    ua = `Windows - ${browser}`;
  } else if (ua.includes('Macintosh')) {
    let browser = 'Chrome';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    ua = `macOS - ${browser}`;
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    ua = 'iOS';
  } else if (ua.includes('Android')) {
    ua = 'Android';
  }
  return ua;
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Device limit modal
  const [deviceLimitUser, setDeviceLimitUser] = useState(null);
  const [deviceLimitValue, setDeviceLimitValue] = useState(1);
  const [savingDeviceLimit, setSavingDeviceLimit] = useState(false);

  const fetchAvailableCourses = async () => {
    try {
      const response = await fetch(COURSE_ENDPOINTS.LIST);
      const result = await response.json();
      if (result.success) {
        // Store full course objects { id, title } so we can send IDs to backend
        const courseList = result.data.map(c => ({ id: c._id, title: c.title }));
        setAvailableCourses(courseList);
      }
    } catch (err) {
      console.error('Error fetching available courses:', err);
    }
  };

  // Add / Edit modal
  const [userModal, setUserModal] = useState(null); // null | { mode: 'add'|'edit', data: {} }
  const EMPTY_FORM = { name: '', email: '', phoneNumber: '', role: 'User', status: 'Active', subscription: 'Free', password: '', confirmPassword: '' };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('lms_token');
      const response = await fetch(ADMIN_ENDPOINTS.USERS, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch users.');
      }
      if (result.success) {
        const mappedUsers = result.data.map(u => ({
          id: u._id,
          name: u.name,
          email: u.email,
          phoneNumber: u.phoneNumber || '',
          role: u.role === 'admin' ? 'Admin' : 'User',
          status: u.isActive ? 'Active' : 'Suspended',
          enrolled: u.courses ? u.courses.length : 0,
          registeredDate: u.createdAt ? u.createdAt.split('T')[0] : '—',
          subscription: u.subscribed ? 'Pro (Paid)' : 'Free',
          ip: u.registeredIp || '—',
          currentIp: u.ip || '—',
          ipFlagged: u.ipLockEnabled && u.ip !== u.registeredIp,
          device: getLatestDevice(u.activityLog),
          progress: u.progress || 0,
          watchHistory: u.watchHistory || [],
          courses: u.courses || [],
          activityLog: u.activityLog || [],
          lastLogin: getRealLastLogin(u.activityLog),
          deviceLimit: u.deviceLimit || 1,
        }));
        setUsers(mappedUsers);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAvailableCourses();
  }, []);

  const openAddModal = () => {
    setFormErrors({});
    setUserModal({ mode: 'add', data: { ...EMPTY_FORM } });
  };

  const openEditModal = (e, user) => {
    e.stopPropagation();
    setFormErrors({});
    setUserModal({
      mode: 'edit',
      data: {
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        status: user.status,
        subscription: user.subscription,
        password: '',
        confirmPassword: '',
        id: user.id
      }
    });
    setActiveDropdown(null);
  };

  const handleModalChange = (field, value) => {
    setUserModal(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    const { mode, data } = userModal;

    if (!data.name || !data.name.trim()) {
      errors.name = 'Full Name is required';
    } else if (data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !data.email.trim()) {
      errors.email = 'Email Address is required';
    } else if (!emailRegex.test(data.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    const cleanPhone = data.phoneNumber ? data.phoneNumber.trim().replace(/[\s\-()]/g, '') : '';
    const phoneRegex = /^(?:\+923[0-9]{9}|03[0-9]{9,10})$/;
    if (!data.phoneNumber || !data.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone Number is required';
    } else if (!phoneRegex.test(cleanPhone)) {
      errors.phoneNumber = 'Invalid format. Use +923214569874 or 031234567897';
    }

    if (mode === 'add') {
      if (!data.password) {
        errors.password = 'Password is required';
      } else if (data.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }

      if (!data.confirmPassword) {
        errors.confirmPassword = 'Confirm Password is required';
      } else if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else if (mode === 'edit') {
      if (data.password) {
        if (data.password.length < 6) {
          errors.password = 'Password must be at least 6 characters';
        }
        if (!data.confirmPassword) {
          errors.confirmPassword = 'Confirm Password is required';
        } else if (data.password !== data.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    return errors;
  };

  const handleModalSave = async () => {
    const { mode, data } = userModal;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSavingUser(true);
    try {
      const token = localStorage.getItem('lms_token');
      const url = mode === 'add'
        ? ADMIN_ENDPOINTS.USERS
        : ADMIN_ENDPOINTS.USER_DETAIL(data.id);

      const method = mode === 'add' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim(),
          phoneNumber: data.phoneNumber.trim(),
          status: data.status,
          subscription: data.subscription,
          password: data.password ? data.password : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Operation failed.');
      }

      if (result.success) {
        await fetchUsers();
        setUserModal(null);
      } else {
        alert(result.message || 'Save failed.');
      }
    } catch (err) {
      console.error('Save user error:', err);
      alert(err.message || 'Error occurred while saving user data.');
    } finally {
      setSavingUser(false);
    }
  };

  // FR18 — Activity Log modal
  const [activityUser, setActivityUser] = useState(null);

  // FR19 — Course Access Control panel
  const [accessUser, setAccessUser] = useState(null);
  const [accessCourses, setAccessCourses] = useState([]);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = (e, id) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setIsPanelOpen(true);
    setActiveDropdown(null);
  };

  const closeUserDetails = () => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedUser(null), 300);
  };

  // FR18: open activity log
  const openActivityLog = async (e, user) => {
    e.stopPropagation();
    setActiveDropdown(null);
    try {
      const token = localStorage.getItem('lms_token');
      const response = await fetch(ADMIN_ENDPOINTS.USER_ACTIVITY(user.id), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch user activity.');

      if (result.success) {
        setActivityUser({
          ...user,
          activityLog: result.data.activityLog || [],
          watchHistory: result.data.watchHistory || [],
        });
      }
    } catch (err) {
      console.error('Error fetching user activity:', err);
      alert(err.message || 'Failed to fetch user activity logs.');
    }
  };

  // FR18: clear IP flag
  const clearIpFlag = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ipFlagged: false, ip: u.currentIp } : u));
    setActivityUser(prev => prev ? { ...prev, ipFlagged: false } : prev);
  };

  // FR-28: open course access panel — accessCourses tracks course IDs only
  const openAccessPanel = (e, user) => {
    e.stopPropagation();
    setAccessUser(user);
    // Filter to valid MongoDB ObjectId strings only (24-char hex).
    // Legacy title strings from old assignments are intentionally dropped
    // because the backend now works exclusively with IDs.
    const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
    const validCourseIds = (user.courses || [])
      .map(c => c.toString())
      .filter(isObjectId);
    setAccessCourses(validCourseIds);
    setActiveDropdown(null);
  };

  const toggleCourseAccess = (courseId) => {
    setAccessCourses(prev =>
      prev.includes(courseId) ? prev.filter(c => c !== courseId) : [...prev, courseId]
    );
  };

  const saveAccessControl = async () => {
    setSavingAccess(true);
    const token = localStorage.getItem('lms_token');
    try {
      // Use the dedicated course assignment endpoint — sends course IDs
      const response = await fetch(ADMIN_ENDPOINTS.USER_COURSES(accessUser.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseIds: accessCourses
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to update course access.');

      if (result.success) {
        await fetchUsers();
        setAccessUser(null);
        alert('Course access updated successfully!');
      }
    } catch (err) {
      console.error('Save course access error:', err);
      alert(err.message || 'Failed to save course access.');
    } finally {
      setSavingAccess(false);
    }
  };

  const openDeviceLimitModal = (e, user) => {
    e.stopPropagation();
    setDeviceLimitUser(user);
    setDeviceLimitValue(user.deviceLimit || 1);
    setActiveDropdown(null);
  };

  const saveDeviceLimit = async () => {
    setSavingDeviceLimit(true);
    const token = localStorage.getItem('lms_token');
    try {
      const response = await fetch(ADMIN_ENDPOINTS.USER_DEVICE_LIMIT(deviceLimitUser.id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deviceLimit: deviceLimitValue })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to update device limit.');
      if (result.success) {
        await fetchUsers();
        setDeviceLimitUser(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to update device limit.');
    } finally {
      setSavingDeviceLimit(false);
    }
  };

  const handleAction = async (e, action, user) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const token = localStorage.getItem('lms_token');

    try {
      if (action === 'Suspend' || action === 'Activate') {
        const isActive = action === 'Activate';
        const response = await fetch(ADMIN_ENDPOINTS.USER_STATUS(user.id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Status toggle failed.');

        if (result.success) {
          await fetchUsers();
        }
      } else if (action === 'Delete User') {
        if (!window.confirm(`Are you sure you want to delete user ${user.name}?`)) return;

        const response = await fetch(ADMIN_ENDPOINTS.USER_DETAIL(user.id), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to delete user.');

        if (result.success) {
          await fetchUsers();
        }
      } else if (action === 'Assign Course') {
        openAccessPanel(e, user);
      } else if (action === 'Force Logout') {
        if (!window.confirm(`Force logout all sessions for ${user.name}?`)) return;
        const response = await fetch(ADMIN_ENDPOINTS.USER_FORCE_LOGOUT(user.id), {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to force logout.');
        if (result.success) {
          await fetchUsers();
          alert(`All sessions cleared for ${user.name}.`);
        }
      } else {
        alert(`Action: ${action} for ${user.name}`);
      }
    } catch (err) {
      console.error(`Error in admin action ${action}:`, err);
      alert(err.message || `Failed to perform action ${action}.`);
    }

    setActiveDropdown(null);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const flaggedCount = users.filter(u => u.ipFlagged).length;

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">User Management</h2>
          <p className="page-subtitle">Manage all registered users, their access and activity.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {flaggedCount > 0 && (
            <div className="ip-flag-alert">
              <AlertTriangle size={14} />
              <span>{flaggedCount} IP {flaggedCount === 1 ? 'flag' : 'flags'} detected</span>
            </div>
          )}
          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <ShimmerUsers count={5} />
      ) : (
        <div className="card">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="toolbar-actions">
              <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  {/* <th>Role</th> */}
                  <th>Status</th>
                  <th>Courses</th>
                  <th>IP / Device</th>
                  <th className="last-login-cell">Last Login</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length > 0 ? paginatedUsers.map(user => (
                  <tr key={user.id} className={user.ipFlagged ? 'row-flagged' : ''}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">{user.name.charAt(0)}</div>
                        <div>
                          <div className="user-name">{user.name}</div>
                          <div className="user-email">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* <td><span className={`role-badge ${user.role.toLowerCase()}`}>{user.role}</span></td> */}
                    <td><span className={`status-badge ${user.status.toLowerCase()}`}>{user.status}</span></td>
                    <td>
                      <div className="courses-cell">
                        <span>{user.enrolled} Courses</span>

                      </div>
                    </td>
                    <td>
                      <div className="ip-cell">
                        {user.ipFlagged && <span className="ip-flag-dot" title="IP mismatch detected"><AlertTriangle size={12} /></span>}
                        <span className={user.ipFlagged ? 'ip-flagged-text' : ''}>{user.currentIp}</span>
                        <span className="device-small">{user.device}</span>
                      </div>
                    </td>
                    <td className="last-login-cell">{user.lastLogin}</td>
                    <td className="text-center">
                      <div className="action-cell" style={{ justifyContent: 'center' }}>
                        <button className="icon-btn view" onClick={(e) => { e.stopPropagation(); openUserDetails(user); }} title="View Details">
                          <Eye size={16} />
                        </button>

                        <button className="icon-btn edit" onClick={(e) => openEditModal(e, user)} title="Edit User">
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn delete" onClick={(e) => handleAction(e, 'Delete User', user)} title="Delete User">
                          <Trash2 size={16} />
                        </button>
                        <div className="dropdown-container">
                          <button className="icon-btn more" onClick={(e) => toggleDropdown(e, user.id)}>
                            <MoreVertical size={16} />
                          </button>
                          {activeDropdown === user.id && (
                            <div className="dropdown-menu">
                              {user.status === 'Suspended' ? (
                                <button onClick={(e) => handleAction(e, 'Activate', user)}><CheckCircle size={14} /> Un suspend User</button>
                              ) : (
                                <button onClick={(e) => handleAction(e, 'Suspend', user)} className="text-warning"><Ban size={14} /> Suspend User</button>
                              )}
                              <button onClick={(e) => handleAction(e, 'Reset Password', user)}><Key size={14} /> Reset Password</button>
                              <button onClick={(e) => openAccessPanel(e, user)}><Shield size={14} /> Course Access</button>
                              <button onClick={(e) => openDeviceLimitModal(e, user)}><Smartphone size={14} /> Manage Devices</button>
                              <button onClick={(e) => openActivityLog(e, user)}><Activity size={14} /> Activity Log</button>
                              <button onClick={(e) => handleAction(e, 'Force Logout', user)} className="text-danger"><LogOut size={14} /> Force Logout</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="text-center" style={{ padding: '32px 0' }}>No users found matching your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-container">
              <span className="pagination-info">Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} entries</span>
              <div className="pagination-controls">
                <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}><ChevronLeft size={16} /></button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button key={idx} className={`page-btn ${currentPage === idx + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(idx + 1)}>{idx + 1}</button>
                ))}
                <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FR18 — Activity Log Modal */}
      {activityUser && (
        <div className="modal-backdrop" onClick={() => setActivityUser(null)}>
          <div className="activity-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Activity Log</h3>
                <p className="modal-sub">{activityUser.name} · {activityUser.email}</p>
              </div>
              <button className="icon-btn close-btn" onClick={() => setActivityUser(null)}><X size={18} /></button>
            </div>

            {activityUser.ipFlagged && (
              <div className="ip-warning-banner">
                <AlertTriangle size={16} />
                <div>
                  <strong>IP Mismatch Detected</strong>
                  <p>Registered IP: <code>{activityUser.ip}</code> · Current IP: <code>{activityUser.currentIp}</code></p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button className="btn-flag-block" onClick={() => { handleAction({ stopPropagation: () => { } }, 'Suspend', activityUser); setActivityUser(null); }}>
                    <Lock size={13} /> Block User
                  </button>
                  <button className="btn-flag-clear" onClick={() => clearIpFlag(activityUser.id)}>
                    <Unlock size={13} /> Clear Flag
                  </button>
                </div>
              </div>
            )}

            <div className="modal-body">
              <div className="activity-stat-row">
                <div className="activity-stat">
                  <span className="astat-label">Registered IP</span>
                  <span className="astat-val">{activityUser.ip}</span>
                </div>
                <div className="activity-stat">
                  <span className="astat-label">Current IP</span>
                  <span className={`astat-val ${activityUser.ipFlagged ? 'text-danger' : ''}`}>{activityUser.currentIp}</span>
                </div>
                <div className="activity-stat">
                  <span className="astat-label">Device</span>
                  <span className="astat-val">{activityUser.device}</span>
                </div>
                <div className="activity-stat">
                  <span className="astat-label">Subscription</span>
                  <span className="astat-val">{activityUser.subscription}</span>
                </div>
              </div>

              <h4 className="modal-section-title"><Clock size={14} /> Login History</h4>
              <div className="activity-log-list">
                {activityUser.activityLog.map((log, idx) => (
                  <div key={idx} className={`activity-log-item ${log.action.includes('new IP') ? 'flagged' : ''}`}>
                    <div className="log-icon">
                      {log.action.includes('new IP') ? <AlertTriangle size={13} /> : <Activity size={13} />}
                    </div>
                    <div className="log-info">
                      <span className="log-action">{log.action}</span>
                      <span className="log-meta">{log.ip} · {log.device}</span>
                    </div>
                    <span className="log-time">{formatLogTime(log.time)}</span>
                  </div>
                ))}
              </div>

              <h4 className="modal-section-title"><BookOpen size={14} /> Watch History</h4>
              <div className="activity-log-list">
                {activityUser.watchHistory.length > 0 ? activityUser.watchHistory.map((w, idx) => (
                  <div key={idx} className="activity-log-item">
                    <div className="log-icon watch"><Clock size={13} /></div>
                    <div className="log-info">
                      <span className="log-action">{w.title}</span>
                      <span className="log-meta">{w.duration}</span>
                    </div>
                    <span className="log-time">{formatLogTime(w.date)}</span>
                  </div>
                )) : <p className="text-muted text-sm" style={{ padding: '12px 0' }}>No watch history.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FR19 — Course Access Control Panel */}
      {accessUser && (
        <div className="modal-backdrop" onClick={savingAccess ? undefined : () => setAccessUser(null)}>
          <div className="access-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Course Access Control</h3>
                <p className="modal-sub">{accessUser.name} · {accessUser.subscription}</p>
              </div>
              <button className="icon-btn close-btn" onClick={() => setAccessUser(null)} disabled={savingAccess}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="access-desc">Toggle access for each course. Only enabled courses will be visible to this user.</p>
              <div className="course-access-list">
                {availableCourses.length > 0 ? (
                  availableCourses.map(course => {
                    const hasAccess = accessCourses.includes(course.id);
                    return (
                      <div key={course.id} className={`course-access-row ${hasAccess ? 'granted' : 'denied'}`}>
                        <div className="course-access-info">
                          {hasAccess ? <BookOpen size={16} className="ca-icon granted" /> : <BookX size={16} className="ca-icon denied" />}
                          <span className="course-access-name">{course.title}</span>
                        </div>
                        <button
                          className={`access-toggle-btn ${hasAccess ? 'revoke' : 'grant'}`}
                          onClick={() => toggleCourseAccess(course.id)}
                          disabled={savingAccess}
                        >
                          {hasAccess ? <><Lock size={13} /> Revoke</> : <><Unlock size={13} /> Grant</>}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted text-sm text-center" style={{ padding: '24px 0' }}>No courses found. Please create courses first.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setAccessUser(null)} disabled={savingAccess}>Cancel</button>
              <button className="btn-primary" onClick={saveAccessControl} disabled={savingAccess}>
                {savingAccess ? <Loader size={15} className="spin-icon" /> : <Shield size={15} />}
                <span>{savingAccess ? 'Saving Access...' : 'Save Access'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {userModal && (
        <div className="modal-backdrop" onClick={savingUser ? undefined : () => setUserModal(null)}>
          <div className="user-form-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{userModal.mode === 'add' ? 'Add New User' : 'Edit User'}</h3>
                <p className="modal-sub">{userModal.mode === 'add' ? 'Create a new user account on the platform.' : `Editing: ${userModal.data.name}`}</p>
              </div>
              <button className="icon-btn close-btn" onClick={() => setUserModal(null)} disabled={savingUser}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="uf-grid">
                <div className="uf-group">
                  <label className="uf-label">Full Name <span className="uf-required">*</span></label>
                  <input className={`uf-input ${formErrors.name ? 'error' : ''}`} type="text" placeholder="Enter your full name" value={userModal.data.name} onChange={e => handleModalChange('name', e.target.value)} disabled={savingUser} />
                  {formErrors.name && <span className="uf-error-text">{formErrors.name}</span>}
                </div>
                <div className="uf-group">
                  <label className="uf-label">Email Address <span className="uf-required">*</span></label>
                  <input className={`uf-input ${formErrors.email ? 'error' : ''}`} type="email" placeholder="Enter your email address" value={userModal.data.email} onChange={e => handleModalChange('email', e.target.value)} disabled={savingUser} />
                  {formErrors.email && <span className="uf-error-text">{formErrors.email}</span>}
                </div>
                <div className="uf-group">
                  <label className="uf-label">Phone Number <span className="uf-required">*</span></label>
                  <input className={`uf-input ${formErrors.phoneNumber ? 'error' : ''}`} type="tel" placeholder="Enter your phone number" value={userModal.data.phoneNumber} onChange={e => handleModalChange('phoneNumber', e.target.value)} disabled={savingUser} />
                  {formErrors.phoneNumber && <span className="uf-error-text">{formErrors.phoneNumber}</span>}
                </div>
                <div className="uf-group">
                  <label className="uf-label">Status</label>
                  <select className="uf-select" value={userModal.data.status} onChange={e => handleModalChange('status', e.target.value)} disabled={savingUser}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div className="uf-group uf-full">
                  <label className="uf-label">Subscription Plan</label>
                  <select className="uf-select" value={userModal.data.subscription} onChange={e => handleModalChange('subscription', e.target.value)} disabled={savingUser}>
                    <option value="Free">Free</option>
                    <option value="Pro (Paid)">Pro (Paid)</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div className="uf-divider uf-full"><span>{userModal.mode === 'add' ? 'Set Password' : 'Change Password'}</span></div>
                <div className="uf-group">
                  <label className="uf-label">{userModal.mode === 'add' ? 'Password' : 'New Password'} {userModal.mode === 'add' && <span className="uf-required">*</span>}</label>
                  <input className={`uf-input ${formErrors.password ? 'error' : ''}`} type="password" placeholder={userModal.mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'} value={userModal.data.password} onChange={e => handleModalChange('password', e.target.value)} disabled={savingUser} />
                  {formErrors.password && <span className="uf-error-text">{formErrors.password}</span>}
                </div>
                <div className="uf-group">
                  <label className="uf-label">Confirm Password {userModal.mode === 'add' && <span className="uf-required">*</span>}</label>
                  <input className={`uf-input ${formErrors.confirmPassword ? 'error' : ''}`} type="password" placeholder="Re-enter password" value={userModal.data.confirmPassword} onChange={e => handleModalChange('confirmPassword', e.target.value)} disabled={savingUser} />
                  {formErrors.confirmPassword && <span className="uf-error-text">{formErrors.confirmPassword}</span>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setUserModal(null)} disabled={savingUser}>Cancel</button>
              <button className="btn-primary" onClick={handleModalSave} disabled={savingUser}>
                {savingUser ? (
                  <><Loader size={15} className="spin-icon" /><span>{userModal.mode === 'add' ? 'Creating...' : 'Saving...'}</span></>
                ) : userModal.mode === 'add' ? (
                  <><Plus size={15} /><span>Create User</span></>
                ) : (
                  <><Edit2 size={15} /><span>Save Changes</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserDetailsPanel
        user={selectedUser}
        isOpen={isPanelOpen}
        onClose={closeUserDetails}
        onAction={handleAction}
        availableCourses={availableCourses}
      />

      {/* Manage Devices Modal */}
      {deviceLimitUser && (
        <div className="modal-backdrop" onClick={savingDeviceLimit ? undefined : () => setDeviceLimitUser(null)}>
          <div className="user-form-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Manage Devices</h3>
                <p className="modal-sub">{deviceLimitUser.name} · {deviceLimitUser.email}</p>
              </div>
              <button className="icon-btn close-btn" onClick={() => setDeviceLimitUser(null)} disabled={savingDeviceLimit}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Set how many devices this user can be logged in to simultaneously. If they try to log in on an extra device, they will be blocked.
              </p>
              <div className="uf-group">
                <label className="uf-label">Allowed Devices</label>
                <select
                  className="uf-select"
                  value={deviceLimitValue}
                  onChange={e => setDeviceLimitValue(Number(e.target.value))}
                  disabled={savingDeviceLimit}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'Device' : 'Devices'}</option>
                  ))}
                </select>
              </div>
              <div style={{
                marginTop: 16, padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                fontSize: 13, color: 'var(--text-muted)'
              }}>
                <Smartphone size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Current limit: <strong>{deviceLimitUser.deviceLimit} {deviceLimitUser.deviceLimit === 1 ? 'device' : 'devices'}</strong>
                {' · '}New limit: <strong>{deviceLimitValue} {deviceLimitValue === 1 ? 'device' : 'devices'}</strong>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeviceLimitUser(null)} disabled={savingDeviceLimit}>Cancel</button>
              <button className="btn-primary" onClick={saveDeviceLimit} disabled={savingDeviceLimit}>
                {savingDeviceLimit
                  ? <><Loader size={15} className="spin-icon" /><span>Saving...</span></>
                  : <><Smartphone size={15} /><span>Save Limit</span></>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;