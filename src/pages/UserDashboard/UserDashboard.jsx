import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Award, Play, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import './UserDashboard.css';
import { API_BASE_URL, AUTH_ENDPOINTS, COURSE_ENDPOINTS, SUBSCRIPTION_ENDPOINTS } from '../../utils/api';
import { ShimmerUserDashboard, ShimmerAdminCourses } from '../../components/Shimmer/Shimmer';

const getRandomColorBg = (id) => {
  const colors = ['bg-blue', 'bg-purple', 'bg-pink', 'bg-green'];
  let hash = 0;
  if (id) for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [portalSettings, setPortalSettings] = useState({ portalMode: 'paid', subscriptionModeEnabled: true });
  const [isLoading, setIsLoading] = useState(true);
  const [activeHours, setActiveHours] = useState('0.0');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('lms_token');

        // Fetch fresh profile
        const profileRes = await fetch(AUTH_ENDPOINTS.PROFILE, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const profileResult = await profileRes.json();
        if (!profileRes.ok) throw new Error(profileResult.message);

        const freshUser = profileResult.data;
        setUserProfile(freshUser);
        localStorage.setItem('lms_user_profile', JSON.stringify(freshUser));

        // Fetch subscription portal settings to know if paid mode is active
        try {
          const pubRes = await fetch(SUBSCRIPTION_ENDPOINTS.PUBLIC);
          const pubData = await pubRes.json();
          if (pubData.success) {
            const ps = { portalMode: pubData.data.portalMode, subscriptionModeEnabled: pubData.data.subscriptionModeEnabled };
            setPortalSettings(ps);
            localStorage.setItem('lms_system_settings', JSON.stringify(ps));
          }
        } catch (_) { /* keep defaults */ }

        // Fetch user progress from backend
        let progressList = [];
        try {
          const progressRes = await fetch(`${API_BASE_URL}/api/progress/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const progressResult = await progressRes.json();
          if (progressResult.success) {
            progressList = progressResult.data;
          }
        } catch (err) {
          console.error('Failed to fetch user progress:', err);
        }

        // Use the dedicated my-courses endpoint — returns only courses assigned to this user
        const myCoursesRes = await fetch(COURSE_ENDPOINTS.MY_COURSES, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const myCoursesResult = await myCoursesRes.json();

        if (myCoursesResult.success) {
          const savedEnrollments = JSON.parse(localStorage.getItem('lms_user_enrollments') || '[]');

          const assigned = myCoursesResult.data.map(c => {
            const saved = savedEnrollments.find(e => e.id === c._id);
            const backendProg = progressList.find(p => p.course && (p.course._id === c._id || p.course === c._id));

            // Fallback to local storage if no backend progress is recorded yet
            const progressKey = `lms_course_progress_${c._id}`;
            const localProgress = JSON.parse(localStorage.getItem(progressKey) || '[]');

            const totalVideos = c.videosCount || (c.modules?.reduce((a, m) => a + (m.lectures?.length || 0), 0)) || 0;

            let completedCount = 0;
            if (backendProg) {
              completedCount = backendProg.completedVideos || 0;
            } else if (localProgress.length > 0) {
              completedCount = localProgress.length;
            } else if (saved?.completed) {
              completedCount = saved.completed;
            }

            return {
              id: c._id,
              title: c.title,
              category: c.category?.name || 'Uncategorized',
              videos: totalVideos,
              completed: completedCount,
              image: getRandomColorBg(c._id),
              instructor: c.instructor || 'Unknown',
              lastAccessed: backendProg?.updatedAt || saved?.lastAccessed || new Date().toISOString(),
              difficulty: c.difficulty || 'Beginner',
              isPremium: c.price === 'Premium',
            };
          });

          setEnrollments(assigned);

          // Sync enrollments to localStorage so UserCourses page shows progress
          const mergedEnrollments = assigned.map(a => {
            const saved = savedEnrollments.find(e => e.id === a.id);
            return saved ? { ...saved, ...a } : a;
          });
          localStorage.setItem('lms_user_enrollments', JSON.stringify(mergedEnrollments));

          // Set active hours calculated from real data
          const totalSecondsWatched = progressList.reduce((acc, p) => {
            const watchedVideos = p.watchedVideos || [];
            return acc + watchedVideos.reduce((sum, v) => sum + (v.watchedSeconds || 0), 0);
          }, 0);

          let hours = totalSecondsWatched / 3600;
          if (hours === 0) {
            const totalLocalCompleted = assigned.reduce((acc, c) => acc + c.completed, 0);
            hours = (totalLocalCompleted * 15) / 60;
          }
          setActiveHours(hours.toFixed(1));
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
        const saved = localStorage.getItem('lms_user_profile');
        if (saved) setUserProfile(JSON.parse(saved));
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const totalCourses = enrollments.length;
  const totalLectures = enrollments.reduce((acc, curr) => acc + curr.videos, 0);
  const completedLectures = enrollments.reduce((acc, curr) => acc + curr.completed, 0);
  const overallProgressPercentage = totalLectures > 0
    ? Math.round((completedLectures / totalLectures) * 100)
    : 0;

  const completedCourses = enrollments.filter(c => c.videos > 0 && c.completed >= c.videos).length;

  const continueCourse = enrollments.length > 0
    ? [...enrollments].sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed))[0]
    : null;

  const handleResumeCourse = (courseId) => {
    // Subscription gate: if paid mode is active and course is premium, require subscription
    const course = enrollments.find(c => c.id === courseId);
    const isPaidMode = portalSettings.subscriptionModeEnabled && portalSettings.portalMode === 'paid';
    if (course?.isPremium && isPaidMode && !userProfile.subscribed) {
      navigate('/dashboard/subscriptions');
      return;
    }

    const updated = enrollments.map(c =>
      c.id === courseId ? { ...c, lastAccessed: new Date().toISOString() } : c
    );
    localStorage.setItem('lms_user_enrollments', JSON.stringify(updated));
    navigate(`/dashboard/courses/${courseId}`);
  };

  if (isLoading) return <ShimmerUserDashboard />;

  return (
    <div className="user-dashboard-page">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="banner-text">
          <h2>Ready to level up, {userProfile.name || 'Student'}?</h2>
          <p>
            You have completed <strong>{completedLectures}</strong> out of <strong>{totalLectures}</strong> courses.
            Keep the learning alive!
          </p>
          <button className="banner-cta-btn" onClick={() => navigate('/dashboard/courses')}>
            <span>View My Courses</span>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="banner-visual">
          <div className="glow-sphere"></div>
          <Award className="banner-icon" />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="student-stats-grid">
        <div className="student-stat-card card-progress">
          <div className="card-top-icon blue-theme">
            <Award size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{overallProgressPercentage}%</span>
            <span className="stat-label">Overall Completion</span>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill blue"
                style={{ width: `${overallProgressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="student-stat-card card-hours">
          <div className="card-top-icon amber-theme">
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{activeHours} hrs</span>
            <span className="stat-label">Active Learning Time</span>
          </div>
        </div>

        <div className="student-stat-card card-courses">
          <div className="card-top-icon purple-theme">
            <BookOpen size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{completedCourses} / {totalCourses}</span>
            <span className="stat-label">Courses Completed</span>
            <span className="stat-sub-label">{totalCourses} course{totalCourses !== 1 ? 's' : ''} assigned</span>
          </div>
        </div>
      </div>

      {/* Continue Learning */}
      {continueCourse && (
        <div className="continue-learning-section">
          <h3 className="section-title">Continue Learning</h3>
          <div className="continue-card" onClick={() => handleResumeCourse(continueCourse.id)}>
            <div className={`continue-image ${continueCourse.image}`}>
              <Play size={24} className="play-pulse-icon" />
            </div>
            <div className="continue-details">
              <div className="continue-top">
                <span className="course-cat">{continueCourse.category}</span>
                <span className="difficulty-pill">{continueCourse.difficulty}</span>
              </div>
              <h4>{continueCourse.title}</h4>
              <p className="instructor-name">Instructor: {continueCourse.instructor}</p>
              <div className="continue-progress-row">
                <div className="mini-progress-bg">
                  <div
                    className="mini-progress-fill"
                    style={{ width: `${continueCourse.videos > 0 ? Math.round((continueCourse.completed / continueCourse.videos) * 100) : 0}%` }}
                  ></div>
                </div>
                <span className="progress-label">
                  {continueCourse.completed} / {continueCourse.videos} lectures
                </span>
              </div>
            </div>
            <button className="resume-circle-btn">
              <Play size={18} fill="white" />
            </button>
          </div>
        </div>
      )}

      {/* Enrolled Courses Grid */}
      <div className="enrolled-courses-section">
        <h3 className="section-title">My Active Courses</h3>
        {isLoading ? (
          <ShimmerAdminCourses count={3} />
        ) : enrollments.length === 0 ? (
          <div className="empty-courses-state">
            <AlertCircle size={32} />
            <p>No courses have been assigned to your account yet.</p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
              Please contact your administrator to get courses assigned.
            </p>
          </div>
        ) : (
          <div className="enrolled-courses-grid">
            {enrollments.map((course) => {
              const percentage = course.videos > 0 ? Math.round((course.completed / course.videos) * 100) : 0;
              return (
                <div key={course.id} className="enrolled-course-card">
                  <div className={`course-img-header ${course.image}`}>
                    <span className="course-tag">{course.category}</span>
                  </div>
                  <div className="course-card-body">
                    <h4 className="course-title">{course.title}</h4>
                    <p className="course-instructor">by {course.instructor}</p>
                    <div className="progress-block">
                      <div className="progress-text-row">
                        <span>Progress</span>
                        <strong>{percentage}%</strong>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill green"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="progress-stats-row">
                        <span>{course.completed} completed</span>
                        <span>{course.videos} total lectures</span>
                      </div>
                    </div>
                    <div className="card-actions">
                      <button
                        className="resume-action-btn"
                        onClick={() => handleResumeCourse(course.id)}
                      >
                        {percentage === 100 ? (
                          <>
                            <CheckCircle2 size={15} />
                            <span>Review Material</span>
                          </>
                        ) : (
                          <>
                            <Play size={14} fill="currentColor" />
                            <span>Resume Class</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;