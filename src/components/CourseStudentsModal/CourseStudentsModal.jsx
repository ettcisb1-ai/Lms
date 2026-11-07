import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Users,
  UserPlus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader,
  Calendar,
  Phone,
  Mail,
  BookOpen
} from 'lucide-react';
import { COURSE_ENDPOINTS, ADMIN_ENDPOINTS } from '../../utils/api';
import './CourseStudentsModal.css';

const CourseStudentsModal = ({ course, isOpen, onClose, onUpdate }) => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add / Enroll student state
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [enrollingUserId, setEnrollingUserId] = useState(null);
  const [unenrollingUserId, setUnenrollingUserId] = useState(null);

  const token = localStorage.getItem('lms_token');

  // Fetch enrolled students for this course
  const fetchStudents = async () => {
    if (!course || !course.id) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(COURSE_ENDPOINTS.STUDENTS(course.id), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to fetch course students.');
      if (json.success) {
        setStudents(json.data.students || []);
      }
    } catch (err) {
      console.error('Fetch students error:', err);
      setError(err.message || 'Could not load students for this course.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all users for enrollment selection
  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${ADMIN_ENDPOINTS.USERS}?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setAllUsers(json.data || []);
      }
    } catch (err) {
      console.error('Fetch all users error:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isOpen && course?.id) {
      fetchStudents();
      setIsAddingStudent(false);
      setUserSearchTerm('');
      setSearchTerm('');
      setFilterStatus('all');
      setSuccessMsg('');
    }
  }, [isOpen, course?.id]);

  useEffect(() => {
    if (isAddingStudent && allUsers.length === 0) {
      fetchAllUsers();
    }
  }, [isAddingStudent]);

  if (!isOpen || !course) return null;

  // Handle Enroll
  const handleEnroll = async (user) => {
    setEnrollingUserId(user._id || user.id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(COURSE_ENDPOINTS.ENROLL_STUDENT(course.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user._id || user.id })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to enroll student.');

      setSuccessMsg(`${user.name} was successfully enrolled!`);
      await fetchStudents();
      if (onUpdate) onUpdate();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Enrollment failed.');
    } finally {
      setEnrollingUserId(null);
    }
  };

  // Handle Unenroll
  const handleUnenroll = async (student) => {
    if (!window.confirm(`Are you sure you want to remove ${student.name} from "${course.title}"?`)) {
      return;
    }
    setUnenrollingUserId(student._id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(COURSE_ENDPOINTS.UNENROLL_STUDENT(course.id, student._id), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to remove student.');

      setSuccessMsg(`${student.name} removed from course.`);
      await fetchStudents();
      if (onUpdate) onUpdate();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Unenrollment failed.');
    } finally {
      setUnenrollingUserId(null);
    }
  };

  // Filter enrolled students
  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      (s.name || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term) ||
      (s.phoneNumber || '').toLowerCase().includes(term);

    if (!matchSearch) return false;
    if (filterStatus === 'active') return s.status === 'active' || s.isActive;
    if (filterStatus === 'inactive') return s.status === 'inactive' || !s.isActive;
    if (filterStatus === 'completed') return s.progress?.percentageComplete >= 100;
    if (filterStatus === 'in_progress') return (s.progress?.percentageComplete > 0 && s.progress?.percentageComplete < 100);
    return true;
  });

  // Filter available users not yet enrolled
  const enrolledIds = new Set(students.map(s => s._id?.toString()));
  const availableToEnroll = allUsers.filter(u => {
    const id = (u._id || u.id)?.toString();
    if (enrolledIds.has(id)) return false;
    if (u.role === 'admin') return false;
    const term = userSearchTerm.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.phoneNumber || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="course-students-modal-backdrop" onClick={onClose}>
      <div className="course-students-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="csm-header">
          <div className="csm-title-group">
            <div className="csm-icon-badge">
              <Users size={20} />
            </div>
            <div>
              <h3 className="csm-title">{course.title}</h3>
              <p className="csm-subtitle">
                Enrolled Students ({students.length})
              </p>
            </div>
          </div>
          <div className="csm-header-actions">
            <button
              className={`csm-btn-toggle-add ${isAddingStudent ? 'active' : ''}`}
              onClick={() => setIsAddingStudent(!isAddingStudent)}
            >
              <UserPlus size={16} />
              <span>{isAddingStudent ? 'Back to Students List' : '+ Enroll Student'}</span>
            </button>
            <button className="csm-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="csm-alert csm-alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="csm-alert csm-alert-success">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="csm-body">
          {isAddingStudent ? (
            /* ENROLL NEW STUDENT VIEW */
            <div className="csm-enroll-panel">
              <div className="csm-enroll-header">
                <div>
                  <h4 className="csm-section-heading">Enroll a Student into this Course</h4>
                  <p className="csm-section-sub">
                    Select any registered user from your system to grant them access to this course.
                  </p>
                </div>
                <div className="csm-search-box">
                  <Search size={15} className="csm-search-icon" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or phone..."
                    value={userSearchTerm}
                    onChange={e => setUserSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {loadingUsers ? (
                <div className="csm-loading">
                  <Loader size={28} className="csm-spin" />
                  <span>Loading registered users...</span>
                </div>
              ) : availableToEnroll.length === 0 ? (
                <div className="csm-empty">
                  <UserPlus size={40} style={{ opacity: 0.3 }} />
                  <p>
                    {userSearchTerm
                      ? 'No available users found matching your search.'
                      : 'All eligible users are already enrolled in this course.'}
                  </p>
                </div>
              ) : (
                <div className="csm-user-list">
                  {availableToEnroll.map(u => {
                    const uId = u._id || u.id;
                    const isEnrollingThis = enrollingUserId === uId;
                    return (
                      <div key={uId} className="csm-user-row">
                        <div className="csm-user-left">
                          <div className="csm-avatar">
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="csm-user-name">{u.name}</div>
                            <div className="csm-user-meta">
                              <span><Mail size={12} /> {u.email}</span>
                              {u.phoneNumber && <span><Phone size={12} /> {u.phoneNumber}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="csm-user-right">
                          <span className={`csm-pill ${u.status === 'inactive' ? 'csm-pill-inactive' : 'csm-pill-active'}`}>
                            {u.status || (u.isActive ? 'Active' : 'Inactive')}
                          </span>
                          <button
                            className="csm-enroll-btn"
                            onClick={() => handleEnroll(u)}
                            disabled={isEnrollingThis}
                          >
                            {isEnrollingThis ? (
                              <>
                                <Loader size={14} className="csm-spin" />
                                <span>Enrolling...</span>
                              </>
                            ) : (
                              <>
                                <UserPlus size={14} />
                                <span>Enroll</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ENROLLED STUDENTS LIST VIEW */
            <>
              {/* Toolbar */}
              <div className="csm-toolbar">
                <div className="csm-search-box">
                  <Search size={15} className="csm-search-icon" />
                  <input
                    type="text"
                    placeholder="Search enrolled students..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="csm-filters">
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="csm-select"
                  >
                    <option value="all">All Statuses ({students.length})</option>
                    <option value="active">Active Accounts</option>
                    <option value="inactive">Inactive Accounts</option>
                    <option value="completed">Completed Course (100%)</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="csm-loading">
                  <Loader size={28} className="csm-spin" />
                  <span>Loading enrolled students...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="csm-empty">
                  <Users size={44} style={{ opacity: 0.3 }} />
                  <p>
                    {searchTerm || filterStatus !== 'all'
                      ? 'No students found matching your filters.'
                      : 'No students have been enrolled in this course yet.'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && (
                    <button
                      className="csm-btn-primary"
                      onClick={() => setIsAddingStudent(true)}
                    >
                      <UserPlus size={16} />
                      <span>Enroll First Student</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="csm-table-wrap">
                  <table className="csm-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Access Expiry</th>
                        <th>Course Progress</th>
                        <th className="csm-th-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(student => {
                        const progPercent = Math.min(100, Math.max(0, student.progress?.percentageComplete || 0));
                        const isUnenrollingThis = unenrollingUserId === student._id;

                        return (
                          <tr key={student._id}>
                            {/* Student */}
                            <td>
                              <div className="csm-student-cell">
                                <div className="csm-avatar">
                                  {(student.name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="csm-name">{student.name}</div>
                                  <div className="csm-email">{student.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Contact */}
                            <td>
                              <div className="csm-contact-cell">
                                {student.phoneNumber ? (
                                  <span><Phone size={13} /> {student.phoneNumber}</span>
                                ) : (
                                  <span className="csm-text-muted">—</span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td>
                              <span className={`csm-pill ${student.status === 'inactive' || !student.isActive ? 'csm-pill-inactive' : 'csm-pill-active'}`}>
                                {student.status === 'inactive' || !student.isActive ? 'Inactive' : 'Active'}
                              </span>
                            </td>

                            {/* Expiry Date */}
                            <td>
                              <div className="csm-date-cell">
                                <Calendar size={13} className="csm-text-muted" />
                                <span>{student.expiryDate || 'No Expiry'}</span>
                              </div>
                            </td>

                            {/* Progress */}
                            <td>
                              <div className="csm-progress-cell">
                                <div className="csm-progress-bar-bg">
                                  <div
                                    className="csm-progress-bar-fill"
                                    style={{
                                      width: `${progPercent}%`,
                                      backgroundColor: progPercent >= 100 ? '#10b981' : '#f97316'
                                    }}
                                  />
                                </div>
                                <div className="csm-progress-text">
                                  <span style={{ fontWeight: 600 }}>{progPercent}%</span>
                                  {student.progress?.totalVideos > 0 && (
                                    <span className="csm-text-muted">
                                      ({student.progress?.completedVideos || 0}/{student.progress.totalVideos} lessons)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="csm-td-right">
                              <button
                                className="csm-unenroll-btn"
                                onClick={() => handleUnenroll(student)}
                                disabled={isUnenrollingThis}
                                title="Remove access to this course"
                              >
                                {isUnenrollingThis ? (
                                  <Loader size={14} className="csm-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="csm-footer">
          <div className="csm-footer-summary">
            <span>
              Total: <strong>{students.length}</strong> student{students.length === 1 ? '' : 's'} enrolled
            </span>
          </div>
          <button className="csm-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseStudentsModal;

