import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Lock, BookOpen, User, CheckCircle } from 'lucide-react';
import './UserCourses.css';
import { AUTH_ENDPOINTS, COURSE_ENDPOINTS, SUBSCRIPTION_ENDPOINTS } from '../../utils/api';
import { ShimmerUserCourses } from '../../components/Shimmer/Shimmer';

const getRandomColorBg = (id) => {
  const colors = ['bg-blue', 'bg-purple', 'bg-pink', 'bg-green'];
  let hash = 0;
  if (id) for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const UserCourses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [systemSettings, setSystemSettings] = useState({ portalMode: 'paid', subscriptionModeEnabled: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUserCourses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('lms_token');
      if (!token) return;

      // Fetch fresh profile
      const profileResponse = await fetch(AUTH_ENDPOINTS.PROFILE, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileResult = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profileResult.message || 'Failed to load profile.');

      const freshUser = profileResult.data;
      setUserProfile(freshUser);
      localStorage.setItem('lms_user_profile', JSON.stringify(freshUser));

      // Use the dedicated my-courses endpoint which returns only assigned courses with full video data
      const myCoursesResponse = await fetch(COURSE_ENDPOINTS.MY_COURSES, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const myCoursesResult = await myCoursesResponse.json();
      if (!myCoursesResponse.ok) throw new Error(myCoursesResult.message || 'Failed to load courses.');

      if (myCoursesResult.success) {
        const mapped = myCoursesResult.data.map(c => ({
          id: c._id,
          title: c.title,
          category: c.category ? (c.category.name || c.category) : 'Uncategorized',
          videos: c.videosCount || (c.modules?.reduce((a, m) => a + (m.lectures?.length || 0), 0)) || 0,
          image: c.thumbnail ? '' : getRandomColorBg(c._id),
          thumbnail: c.thumbnail || '',
          difficulty: c.difficulty || 'Beginner',
          isPremium: c.price === 'Premium',
          instructor: c.instructor || 'Unknown',
          description: c.description || 'No description available.',
          modules: c.modules || [],
        }));
        setCourses(mapped);
      }

      // Fetch real subscription settings from API
      try {
        const pubRes = await fetch(SUBSCRIPTION_ENDPOINTS.PUBLIC);
        const pubData = await pubRes.json();
        if (pubData.success && pubData.data) {
          const ps = {
            portalMode: pubData.data.portalMode,
            subscriptionModeEnabled: pubData.data.subscriptionModeEnabled,
          };
          setSystemSettings(ps);
          localStorage.setItem('lms_system_settings', JSON.stringify(ps));
        }
      } catch (_) { /* keep defaults */ }

    } catch (err) {
      console.error('Fetch user courses error:', err);
      setError(err.message || 'Failed to load assigned courses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedProfile = localStorage.getItem('lms_user_profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));

    const savedSettings = localStorage.getItem('lms_system_settings');
    if (savedSettings) setSystemSettings(JSON.parse(savedSettings));

    const savedEnrollments = localStorage.getItem('lms_user_enrollments');
    if (savedEnrollments) setEnrollments(JSON.parse(savedEnrollments));

    fetchUserCourses();

    const handleSync = () => {
      const updatedSettings = localStorage.getItem('lms_system_settings');
      if (updatedSettings) setSystemSettings(JSON.parse(updatedSettings));
      const updatedProfile = localStorage.getItem('lms_user_profile');
      if (updatedProfile) setUserProfile(JSON.parse(updatedProfile));
      fetchUserCourses();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('lms_settings_sync', handleSync);
    window.addEventListener('lms_profile_sync', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('lms_settings_sync', handleSync);
      window.removeEventListener('lms_profile_sync', handleSync);
    };
  }, []);

  const handleStartOrEnroll = (course) => {
    const isEnrolled = enrollments.some(e => e.id === course.id);
    const isPaidMode = systemSettings.subscriptionModeEnabled && systemSettings.portalMode === 'paid';
    const isLocked = isPaidMode && course.isPremium && !userProfile.subscribed &&
      !userProfile.courses?.includes(course.id) && !userProfile.courses?.includes(course.title);

    if (isLocked) {
      navigate('/dashboard/subscriptions');
      return;
    }

    if (!isEnrolled) {
      const newEnrollment = {
        id: course.id,
        title: course.title,
        category: course.category,
        videos: course.videos,
        completed: 0,
        image: course.image,
        instructor: course.instructor,
        lastAccessed: new Date().toISOString(),
        difficulty: course.difficulty
      };
      const updated = [...enrollments, newEnrollment];
      localStorage.setItem('lms_user_enrollments', JSON.stringify(updated));
      setEnrollments(updated);
      window.dispatchEvent(new Event('lms_profile_sync'));
    }

    navigate(`/dashboard/courses/${course.id}`);
  };

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...new Set(courses.map(c => c.category).filter(Boolean))];

  return (
    <div className="user-courses-page">
      <div className="page-intro">
        <h2>My Courses</h2>
        <p>Courses assigned to your account. Click any course to start learning.</p>
      </div>

      {/* Toolbar */}
      <div className="courses-explorer-toolbar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search courses by title or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="category-tabs-bar">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-tab-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <ShimmerUserCourses count={6} />}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {!isLoading && !error && courses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No courses assigned yet</p>
          <p style={{ fontSize: 14 }}>Your administrator will assign courses to your account. Please check back later.</p>
        </div>
      )}

      {/* Courses Grid */}
      <div className="courses-catalog-grid">
        {filteredCourses.map(course => {
          const isEnrolled = enrollments.some(e => e.id === course.id);
          const enrollmentInfo = enrollments.find(e => e.id === course.id);
          const isPaidMode = systemSettings.subscriptionModeEnabled && systemSettings.portalMode === 'paid';
          const isLocked = isPaidMode && course.isPremium && !userProfile.subscribed &&
            !userProfile.courses?.includes(course.id) && !userProfile.courses?.includes(course.title);

          return (
            <div key={course.id} className={`catalog-course-card ${isLocked ? 'locked-state' : ''}`}>
              <div className={`catalog-card-header ${course.image}`} style={course.thumbnail ? { background: '#f1f5f9' } : {}}>
                {course.thumbnail && (
                  <img src={course.thumbnail} alt={course.title} className="course-card-img" />
                )}
                <span className="category-badge">{course.category}</span>

                <div className="access-indicator-badges">
                  {isLocked ? (
                    <span className="badge-lock-premium">
                      <Lock size={12} />
                      <span>PRO LOCK</span>
                    </span>
                  ) : course.isPremium ? (
                    <span className="badge-premium-unlocked">PRO PLAN</span>
                  ) : (
                    <span className="badge-free">FREE CLASS</span>
                  )}
                </div>
              </div>

              <div className="catalog-card-body">
                <div className="instructor-row">
                  <User size={13} />
                  <span>{course.instructor}</span>
                </div>
                <h3 className="course-title">{course.title}</h3>
                <p className="course-desc">{course.description}</p>

                <div className="course-stats-row">
                  <span>{course.videos} video lecture{course.videos !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span className="difficulty-pill">{course.difficulty}</span>
                </div>

                {isEnrolled && enrollmentInfo && (
                  <div className="enrollment-status-line">
                    <CheckCircle size={13} className="text-success" />
                    <span>
                      Enrolled ({enrollmentInfo.videos > 0
                        ? Math.round((enrollmentInfo.completed / enrollmentInfo.videos) * 100)
                        : 0}% complete)
                    </span>
                  </div>
                )}

                <div className="catalog-card-footer">
                  {isLocked ? (
                    <button
                      className="btn-unlock-pro"
                      onClick={() => navigate('/dashboard/subscriptions')}
                    >
                      <Lock size={14} />
                      <span>Unlock with Premium</span>
                    </button>
                  ) : (
                    <button
                      className={`btn-start-learning ${isEnrolled ? 'enrolled' : ''}`}
                      onClick={() => handleStartOrEnroll(course)}
                    >
                      <Play size={14} fill="currentColor" />
                      <span>{isEnrolled ? 'Continue Study' : 'Start Learning'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserCourses;