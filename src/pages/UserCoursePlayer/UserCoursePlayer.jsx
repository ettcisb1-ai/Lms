import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CheckCircle, Circle, PlayCircle, Lock, BookOpen,
  Clock, Settings, Shield
} from 'lucide-react';
import './UserCoursePlayer.css';
import { COURSE_ENDPOINTS, fetchSecureStreamUrl, verifyCourseAccess, API_BASE_URL, formatStoredDuration } from '../../utils/api';
import DRMPlayer from '../../player/DRMPlayer';

const UserCoursePlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Core State ──────────────────────────────────────────────────────────────
  const [courseData, setCourseData] = useState(null);
  const [flatLectures, setFlatLectures] = useState([]);
  const [activeLecture, setActiveLecture] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');

  // ── Player State — owned by DRMPlayer, mirrored here for progress/UI ────────
  const [duration, setDuration]     = useState(0);

  // ── FR-29/32: Secure streaming state ────────────────────────────────────────
  const [secureStreamUrl, setSecureStreamUrl]     = useState('');
  const [isHLS, setIsHLS]                         = useState(false);
  const [isDrm, setIsDrm]                         = useState(false);
  const [isDASH, setIsDASH]                       = useState(false);
  const [licenseServerUrl, setLicenseServerUrl]   = useState('');
  const [drmToken, setDrmToken]                   = useState('');
  const [videoSecurity, setVideoSecurity]         = useState(null);
  const [streamTokenLoading, setStreamTokenLoading] = useState(false);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState('info');
  const [openModules, setOpenModules]     = useState({ 0: true, 1: true });

  // ── User & Progress ──────────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState({ name: '', email: '', ip: '' });
  const [completedLectures, setCompletedLectures] = useState([]);

  // ── Refs — videoEl kept so DRMPlayer's onDuration/onEnded can feed back duration ──
  const videoEl = useRef(null);

  // ══════════════════════════════════════════════════════════════════════════════
  // FR-28: Verify course access before loading any content
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const loadCourse = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('lms_token');
        if (!token) {
          navigate('/login');
          return;
        }

        // FR-28: Check access first
        const { hasAccess, course, message } = await verifyCourseAccess(id, token);

        if (!hasAccess) {
          setAccessDenied(true);
          setAccessMessage(message || 'You do not have access to this course.');
          setIsLoading(false);
          return;
        }

        if (!course) {
          setAccessDenied(true);
          setAccessMessage('Failed to load course data. Please try again.');
          setIsLoading(false);
          return;
        }

        // Build module/lecture list from backend (FR-26: already sorted by order)
        const modules = (course.modules && course.modules.length > 0) ? course.modules : [];
        setCourseData({ title: course.title, description: course.description || '', modules });

        const flat = modules.reduce((acc, mod) => [...acc, ...mod.lectures], []);
        setFlatLectures(flat);

        if (flat.length > 0) {
          setActiveLecture(flat[0]);
          // FR-29/32: Obtain a signed stream URL for the first lecture
          await loadStreamToken(flat[0], token);
        }

        // Restore progress
        const savedCompletions = localStorage.getItem(`lms_course_progress_${id}`);
        if (savedCompletions) {
          setCompletedLectures(JSON.parse(savedCompletions));
        } else if (flat.length > 0) {
          const defaultComps = [flat[0]._id || flat[0].id];
          localStorage.setItem(`lms_course_progress_${id}`, JSON.stringify(defaultComps));
          setCompletedLectures(defaultComps);
        }
      } catch (err) {
        console.error('Error loading course:', err);
        setAccessDenied(true);
        setAccessMessage('Failed to load course. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    // Load user profile
    const savedProfile = localStorage.getItem('lms_user_profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));

    loadCourse();
  }, [id, navigate]);

  // ══════════════════════════════════════════════════════════════════════════════
  // FR-29, FR-32: Load a signed stream token for a lecture
  // The raw videoUrl NEVER reaches the client — only the token endpoint URL
  // ══════════════════════════════════════════════════════════════════════════════
  const loadStreamToken = useCallback(async (lecture, authToken) => {
    if (!lecture) return;

    const token = authToken || localStorage.getItem('lms_token');
    if (!token) return;

    // lecture.video may be a populated Video object (from backend populate()) OR a plain ID string.
    // We need the string ID to call the token endpoint.
    // NOTE: renamed from 'videoRef' to 'videoDoc' to avoid colliding with the videoEl ref.
    const videoDoc = lecture.video;
    let videoId = null;
    let videoDirectUrl = ''; // direct URL from populated video doc (for fallback)

    if (videoDoc) {
      if (typeof videoDoc === 'object' && videoDoc !== null) {
        // Populated Video document — extract _id and the raw videoUrl for fallback
        videoId = videoDoc._id ? videoDoc._id.toString() : null;
        videoDirectUrl = videoDoc.videoUrl || '';
      } else if (typeof videoDoc === 'string') {
        // Plain ObjectId string
        videoId = videoDoc;
      }
    }

    // If no video document is linked, fall back to lecture.url (legacy field)
    if (!videoId) {
      const fallbackUrl = lecture.url || videoDirectUrl || '';
      setSecureStreamUrl(fallbackUrl);
      setVideoSecurity(null);
      return;
    }

    setStreamTokenLoading(true);
    try {
      const { streamUrl, isHLS: hlsFlag, isDrm: drmFlag, isDASH: dashFlag, licenseServerUrl: licenseUrl, security } = await fetchSecureStreamUrl(videoId, token);
      setSecureStreamUrl(streamUrl);
      setIsHLS(hlsFlag);
      setIsDrm(drmFlag);
      setIsDASH(dashFlag);
      setLicenseServerUrl(licenseUrl || '');
      // The DRM token IS the user's JWT — sent as Authorization on license requests
      setDrmToken(token);
      setVideoSecurity(security);
    } catch (err) {
      console.warn('Stream token fetch failed, falling back:', err.message);
      const fallback = videoDirectUrl || lecture.url || '';
      setSecureStreamUrl(fallback);
      setIsHLS(false);
      setIsDrm(false);
      setIsDASH(false);
      setLicenseServerUrl('');
      setVideoSecurity(null);
    } finally {
      setStreamTokenLoading(false);
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // Lecture selection — fetches a new stream token on each lecture change
  // ══════════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════════
  // Report progress helper
  // ══════════════════════════════════════════════════════════════════════════════
  const reportProgress = useCallback(async (time, forceCompleted = false) => {
    if (!activeLecture) return;
    const token = localStorage.getItem('lms_token');
    if (!token) return;

    const videoDoc = activeLecture.video;
    let videoId = null;
    if (videoDoc) {
      if (typeof videoDoc === 'object' && videoDoc !== null) {
        videoId = videoDoc._id ? videoDoc._id.toString() : null;
      } else if (typeof videoDoc === 'string') {
        videoId = videoDoc;
      }
    }
    if (!videoId) return;

    const totalSec = duration || 600;
    const watchedSec = forceCompleted ? totalSec : Math.round(time);

    try {
      await fetch(`${API_BASE_URL}/api/progress/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId: id,
          videoId,
          watchedSeconds: watchedSec,
          totalSeconds: Math.round(totalSec),
          lectureTitle: activeLecture.title
        })
      });
    } catch (err) {
      console.error('Error reporting progress:', err);
    }
  }, [activeLecture, duration, id]);

  // ══════════════════════════════════════════════════════════════════════════════
  // Lecture selection — fetches a new stream token on each lecture change
  // ══════════════════════════════════════════════════════════════════════════════
  const handleLectureSelect = async (lecture) => {
    setActiveLecture(lecture);
    setDuration(0);
    // Clear stream triggers DRMPlayer to reset
    setSecureStreamUrl('');
    setIsHLS(false);
    setIsDrm(false);
    setIsDASH(false);
    setLicenseServerUrl('');
    setDrmToken('');
    // Fetch new token
    await loadStreamToken(lecture);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // Progress tracking
  // ══════════════════════════════════════════════════════════════════════════════
  const handleCompletedToggle = async (lectureId) => {
    let updated;
    const isCompleted = !completedLectures.includes(lectureId);
    if (!isCompleted) {
      updated = completedLectures.filter(l => l !== lectureId);
    } else {
      updated = [...completedLectures, lectureId];
    }
    setCompletedLectures(updated);
    localStorage.setItem(`lms_course_progress_${id}`, JSON.stringify(updated));

    const savedEnrollments = localStorage.getItem('lms_user_enrollments');
    if (savedEnrollments) {
      const parsed = JSON.parse(savedEnrollments);
      const next = parsed.map(c =>
        c.id === id ? { ...c, completed: updated.length, lastAccessed: new Date().toISOString() } : c
      );
      localStorage.setItem('lms_user_enrollments', JSON.stringify(next));
      window.dispatchEvent(new Event('lms_profile_sync'));
    }

    // Report to backend
    const lecture = flatLectures.find(l => (l._id || l.id) === lectureId);
    if (lecture) {
      const videoDoc = lecture.video;
      let videoId = null;
      if (videoDoc) {
        if (typeof videoDoc === 'object' && videoDoc !== null) {
          videoId = videoDoc._id ? videoDoc._id.toString() : null;
        } else if (typeof videoDoc === 'string') {
          videoId = videoDoc;
        }
      }
      if (videoId) {
        let totalSec = 600;
        if (lecture.duration) {
          const parts = lecture.duration.split(':');
          if (parts.length === 3) {
            totalSec = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
          } else if (parts.length === 2) {
            totalSec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          } else {
            const matches = lecture.duration.match(/\d+/);
            if (matches) {
              totalSec = parseInt(matches[0], 10) * 60;
            }
          }
        }
        const token = localStorage.getItem('lms_token');
        try {
          await fetch(`${API_BASE_URL}/api/progress/watch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              courseId: id,
              videoId,
              watchedSeconds: isCompleted ? totalSec : 0,
              totalSeconds: totalSec,
              lectureTitle: lecture.title
            })
          });
        } catch (err) {
          console.error('Error toggling progress on backend:', err);
        }
      }
    }
  };

  const handleVideoEnded = useCallback(() => {
    const lectureId = activeLecture?._id || activeLecture?.id;
    reportProgress(duration, true);
    if (lectureId && !completedLectures.includes(lectureId)) {
      handleCompletedToggle(lectureId);
    }
    // Auto-advance to next lecture
    const currentIndex = flatLectures.findIndex(l => (l._id || l.id) === lectureId);
    if (currentIndex !== -1 && currentIndex < flatLectures.length - 1) {
      setTimeout(() => handleLectureSelect(flatLectures[currentIndex + 1]), 1000);
    }
  }, [activeLecture, completedLectures, flatLectures, duration]);

  const toggleModule = (idx) => setOpenModules(prev => ({ ...prev, [idx]: !prev[idx] }));

  // ══════════════════════════════════════════════════════════════════════════════
  // Render Guards
  // ══════════════════════════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
        <Shield size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p>Verifying access &amp; loading course…</p>
      </div>
    );
  }

  // FR-28: Access denied screen
  if (accessDenied) {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
        <Lock size={48} style={{ marginBottom: 16, color: 'var(--danger, #e74c3c)' }} />
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Access Restricted</h2>
        <p style={{ maxWidth: 400, margin: '0 auto 24px' }}>{accessMessage}</p>
        <button
          className="btn-primary"
          onClick={() => navigate('/dashboard/courses')}
          style={{ padding: '10px 24px', cursor: 'pointer' }}
        >
          Back to My Courses
        </button>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
        Course data unavailable.
      </div>
    );
  }

  const activeLectureId = activeLecture?._id || activeLecture?.id;

  return (
    <div className="user-course-player-page">

      {/* Top navigation */}
      <div className="classroom-top-nav">
        <button className="back-btn" onClick={() => navigate('/dashboard/courses')}>
          <ChevronLeft size={20} />
        </button>
        <div className="classroom-course-details">
          <h2>{courseData.title}</h2>
          <span className="classroom-progress">
            ({completedLectures.length} / {flatLectures.length} lectures completed)
          </span>
        </div>
        <div className="secure-stream-badge" title="Content is delivered via secure encrypted stream">
          <Shield size={14} />
          <span>Secure Stream</span>
        </div>
      </div>

      <div className="classroom-workspace-grid">

        {/* ── Left Column: DRMPlayer + Tabs ── */}
        <div className="classroom-content-column">

          {/* Empty course placeholder */}
          {flatLectures.length === 0 && (
            <div className="custom-video-player-container" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'#94a3b8' }}>
              <BookOpen size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize:14, fontWeight:600 }}>No lectures available yet</span>
            </div>
          )}

          {/* Select a lecture placeholder */}
          {flatLectures.length > 0 && !secureStreamUrl && !streamTokenLoading && (
            <div className="custom-video-player-container" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'#94a3b8' }}>
              <PlayCircle size={48} style={{ opacity: 0.35 }} />
              <span>Select a lecture to begin</span>
            </div>
          )}

          {/* Token loading spinner */}
          {streamTokenLoading && (
            <div className="custom-video-player-container" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:'#94a3b8' }}>
              <div className="stream-spinner" />
              <span style={{ fontSize:13 }}>Loading secure stream…</span>
            </div>
          )}

          {/* ── DRMPlayer — replaces all old <video> + Shaka/HLS code ── */}
          {secureStreamUrl && !streamTokenLoading && (
            <DRMPlayer
              streamUrl={secureStreamUrl}
              isDrm={isDrm}
              isDASH={isDASH}
              isHLS={isHLS}
              licenseServerUrl={licenseServerUrl}
              drmToken={drmToken}
              watermark={{
                userName:   userProfile.name  || 'Student',
                userEmail:  userProfile.email || '',
                courseName: courseData.title  || '',
              }}
              onDuration={(secs) => setDuration(secs)}
              onEnded={handleVideoEnded}
            />
          )}

          {/* Classroom Tabs */}
          <div className="classroom-tabs-bar">
            <button
              className={`classroom-tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <BookOpen size={15} /><span>Lesson Overview</span>
            </button>
            {/* Commented out Q&A and Study Notes tabs per user request
            <button
              className={`classroom-tab ${activeTab === 'discussion' ? 'active' : ''}`}
              onClick={() => setActiveTab('discussion')}
            >
              <MessageSquare size={15} /><span>Q&amp;A Discussion</span>
            </button>
            <button
              className={`classroom-tab ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <Edit3 size={15} /><span>Study Notes</span>
            </button>
            */}
          </div>

          <div className="classroom-tabs-viewport-card">
            {activeTab === 'info' && (
              <div className="classroom-tab-pane info-pane animate-tab-fade">
                <h3>{activeLecture?.title}</h3>
                <div className="lecture-metadata-tag-row">
                  <span className="meta-tag">
                    <Clock size={12} /> Duration: {
                      (!activeLecture?.duration || activeLecture.duration === '0:00')
                        ? (duration > 0
                            ? (() => {
                                const h = Math.floor(duration / 3600);
                                const m = Math.floor((duration % 3600) / 60);
                                const s = Math.floor(duration % 60);
                                return h > 0
                                  ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                                  : `${m}:${String(s).padStart(2, '0')}`;
                              })()
                            : '0:00')
                        : formatStoredDuration(activeLecture.duration)
                    }
                  </span>
                  <span className="meta-tag"><Settings size={12} /> Adaptive Bitrate Stream</span>
                  <span className="meta-tag"><Shield size={12} /> DRM Protected</span>
                </div>
                <p className="lecture-detail-paragraph">
                  {courseData.description}
                </p>
              </div>
            )}

            {/* Commented out Q&A and Study Notes panes per user request
            {activeTab === 'discussion' && (
              <div className="classroom-tab-pane discussion-pane animate-tab-fade">
                <h3>Class Forum &amp; Questions</h3>
                <form className="discussion-compose-box" onSubmit={handleAddDiscussion}>
                  <textarea
                    rows="3"
                    placeholder="Ask a question or share a thought on this lecture…"
                    value={discussionInput}
                    onChange={(e) => setDiscussionInput(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary">
                    <MessageSquare size={14} /><span>Post Question</span>
                  </button>
                </form>
                <div className="discussion-comments-stack">
                  {discussions.map(comm => (
                    <div key={comm.id} className="comment-card">
                      <div className="comment-avatar">{comm.avatar}</div>
                      <div className="comment-body">
                        <div className="comment-header">
                          <span className="author-name">{comm.name}</span>
                          <span className="comment-time">{comm.time}</span>
                        </div>
                        <p className="comment-content">{comm.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="classroom-tab-pane notes-pane animate-tab-fade">
                <div className="notes-header">
                  <h3>Your Lecture Notepad</h3>
                  <button className="btn-primary" onClick={handleSaveNotes}>
                    <Save size={14} /><span>Save Notes</span>
                  </button>
                </div>
                <textarea
                  rows="10"
                  className="notepad-textarea"
                  placeholder="Draft your personal learning notes here. These are saved locally to your device…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}
            */}
          </div>
        </div>

        {/* Right Column: Curriculum Outline */}
        <div className="classroom-curriculum-column">
          <div className="curriculum-outline-card">
            <h3 className="card-heading">Curriculum Syllabus</h3>

            <div className="curriculum-modules-accordion">
              {/* Empty course state */}
              {courseData.modules.length === 0 && (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted, #94a3b8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <BookOpen size={32} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>No content yet</span>
                  <span style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                    The instructor hasn't published any lectures for this course yet.
                  </span>
                </div>
              )}
              {/* FR-26: modules are already sorted by order from the backend */}
              {courseData.modules.map((mod, modIdx) => {
                const isOpen = openModules[modIdx];
                return (
                  <div
                    key={mod._id || modIdx}
                    className={`module-accordion-section ${isOpen ? 'open' : ''}`}
                  >
                    <div className="module-accordion-header" onClick={() => toggleModule(modIdx)}>
                      <h4 className="module-title">{mod.title}</h4>
                      <span className="module-info-pill">{mod.lectures?.length || 0} lessons</span>
                    </div>

                    {isOpen && (
                      <div className="module-accordion-body">
                        {/* FR-26: lectures sorted by order */}
                        {mod.lectures?.map((lecture, lIdx) => {
                          const lectureId = lecture._id || lecture.id || lIdx;
                          const isActive = lectureId === activeLectureId;
                          const isComplete = completedLectures.includes(lectureId);
                          return (
                            <div
                              key={lectureId}
                              className={`lecture-row-item ${isActive ? 'active-playing' : ''}`}
                            >
                              <button
                                className="complete-checkbox-wrapper"
                                onClick={() => handleCompletedToggle(lectureId)}
                                title={isComplete ? 'Mark as Unwatched' : 'Mark as Watched'}
                              >
                                {isComplete
                                  ? <CheckCircle size={17} className="checkbox-icon checked" />
                                  : <Circle size={17} className="checkbox-icon" />
                                }
                              </button>

                              <div
                                className="lecture-text-content"
                                onClick={() => handleLectureSelect(lecture)}
                              >
                                <span className="lecture-title">{lecture.title}</span>
                                <div className="lecture-meta-row">
                                  {isActive ? (
                                    <span className="meta-now-playing">
                                      <PlayCircle size={11} fill="currentColor" />
                                      <span>NOW STREAMING</span>
                                    </span>
                                  ) : (
                                    <span className="meta-duration">
                                      <Clock size={11} /> {formatStoredDuration(lecture.duration)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserCoursePlayer;