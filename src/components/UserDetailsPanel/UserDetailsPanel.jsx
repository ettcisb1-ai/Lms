import React from 'react';
import { X, Ban, Key, Book, LogOut, Activity, Clock } from 'lucide-react';
import './UserDetailsPanel.css';

const UserDetailsPanel = ({ user, isOpen, onClose, onAction, availableCourses = [] }) => {
  // Build a map of courseId -> title from availableCourses for display
  const courseMap = {};
  availableCourses.forEach(c => {
    if (c && c.id) courseMap[c.id] = c.title;
  });

  const getCourseDisplay = (courseRef) => {
    // courseRef may be an ID (string) or a legacy title
    if (courseMap[courseRef]) return courseMap[courseRef];
    return courseRef; // fallback: display as-is
  };

  return (
    <>
      <div className={`slide-over-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`slide-over-panel ${isOpen ? 'open' : ''}`}>
        {user && (
          <>
            <div className="panel-header">
              <div className="panel-user-info">
                <div className="user-avatar large">{user.name.charAt(0)}</div>
                <div>
                  <h3 className="panel-name">{user.name}</h3>
                  <p className="panel-email">{user.email}</p>
                </div>
              </div>
              <button className="icon-btn close-btn" onClick={onClose}><X size={20} /></button>
            </div>

            <div className="panel-body">
              <div className="panel-section">
                <h4 className="section-heading">Account Overview</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`status-badge ${user.status.toLowerCase()}`}>{user.status}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Subscription</span>
                    <span className="detail-value">{user.subscription}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone Number</span>
                    <span className="detail-value">{user.phoneNumber || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Registered Date</span>
                    <span className="detail-value">{user.registeredDate}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Last Device/IP</span>
                    <span className="detail-value">{user.device}<br />{user.ip}</span>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <div className="section-header-flex">
                  <h4 className="section-heading">Courses & Progress</h4>
                  <button className="btn-outline-small" onClick={(e) => onAction(e, 'Assign Course', user)}>Manage</button>
                </div>

                <div className="progress-container">
                  <div className="progress-header">
                    <span className="progress-title">Assigned Courses</span>
                    <span className="progress-value">{user.courses ? user.courses.length : 0}</span>
                  </div>
                </div>

                {user.courses && user.courses.length > 0 ? (
                  <ul className="course-list">
                    {user.courses.map((courseRef, idx) => (
                      <li key={idx} className="course-list-item">
                        <Book size={14} className="text-muted" />
                        <span>{getCourseDisplay(courseRef)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-sm mt-2">No courses assigned yet.</p>
                )}
              </div>

              <div className="panel-section">
                <h4 className="section-heading">Watch History & Activity</h4>
                <div className="activity-timeline">
                  {user.watchHistory.length > 0 ? user.watchHistory.map((history, idx) => (
                    <div key={idx} className="timeline-item">
                      <div className="timeline-icon"><Clock size={12} /></div>
                      <div className="timeline-content">
                        <div className="timeline-title">Watched <strong>{history.title}</strong></div>
                        <div className="timeline-meta">{history.duration} • {history.date}</div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-muted text-sm">No watch history available.</p>
                  )}
                  <div className="timeline-item">
                    <div className="timeline-icon"><Activity size={12} /></div>
                    <div className="timeline-content">
                      <div className="timeline-title">Logged In</div>
                      <div className="timeline-meta">{user.lastLogin} • {user.ip}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-footer">
              <button className="btn-secondary" onClick={onClose}>Close</button>
              <button className="btn-danger-solid" onClick={(e) => onAction(e, 'Force Logout', user)}>Force Logout</button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default UserDetailsPanel;