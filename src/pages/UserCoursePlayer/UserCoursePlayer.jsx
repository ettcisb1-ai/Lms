import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Play, Pause, RotateCcw, Volume2, VolumeX,
  Maximize, CheckCircle, Circle, PlayCircle, Lock, BookOpen,
  Clock, Edit3, MessageSquare, Save, Settings, Info, AlertTriangle, Shield
} from 'lucide-react';
import Hls from 'hls.js';
import './UserCoursePlayer.css';
import { COURSE_ENDPOINTS, fetchSecureStreamUrl, verifyCourseAccess, API_BASE_URL } from '../../utils/api';

const ensureShakaLoaded = () => {
  return new Promise((resolve) => {
    if (window.shaka) {
      resolve(true);
      return;
    }

    console.log("[DRM_PLAYER] Shaka not found on window, loading dynamically...");
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.5/shaka-player.compiled.js";
    script.async = true;
    script.onload = () => {
      console.log("[DRM_PLAYER] Shaka Player CDN loaded dynamically successfully.");
      resolve(true);
    };
    script.onerror = () => {
      console.error("[DRM_PLAYER] Failed to load Shaka Player from primary CDN, trying backup unpkg...");
      const backupScript = document.createElement('script');
      backupScript.src = "https://unpkg.com/shaka-player@4.3.5/dist/shaka-player.compiled.js";
      backupScript.async = true;
      backupScript.onload = () => {
        console.log("[DRM_PLAYER] Shaka Player backup CDN loaded successfully.");
        resolve(true);
      };
      backupScript.onerror = () => {
        console.error("[DRM_PLAYER] All Shaka Player CDNs failed to load.");
        resolve(false);
      };
      document.body.appendChild(backupScript);
    };
    document.body.appendChild(script);
  });
};

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

  // ── Player State ─────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [openModules, setOpenModules] = useState({ 0: true, 1: true });
  const [isBuffering, setIsBuffering] = useState(false);

  // ── FR-29/32: Secure streaming state ────────────────────────────────────────
  const [secureStreamUrl, setSecureStreamUrl] = useState('');
  const [isHLS, setIsHLS] = useState(false);          // true → HLS.js, false → plain src
  const [isDrm, setIsDrm] = useState(false);          // true → Shaka Player DRM
  const [isDASH, setIsDASH] = useState(false);        // true → DASH stream
  const [licenseServerUrl, setLicenseServerUrl] = useState('');
  const [videoSecurity, setVideoSecurity] = useState(null);
  const [streamTokenLoading, setStreamTokenLoading] = useState(false);

  // ── FR-31: Screen capture detection state (experimental) ─────────────────────
  const [screenRecordWarning, setScreenRecordWarning] = useState(false);
  const screenRecordCheckRef = useRef(null);

  // ── UI Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('info');

  // ── User & Progress ──────────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState({ name: '', email: '', ip: '' });
  const [completedLectures, setCompletedLectures] = useState([]);
  const [notes, setNotes] = useState('');
  const [discussionInput, setDiscussionInput] = useState('');
  const [discussions, setDiscussions] = useState([
    { id: 1, name: 'Uzair Ahmed', avatar: 'UA', text: 'Make sure you check the PATH variable when setting up environment variables.', time: '2 hours ago' },
    { id: 2, name: 'Sarah Malik', avatar: 'SM', text: 'This lecture is exceptionally well explained!', time: '1 day ago' },
  ]);

  // ── Watermark ────────────────────────────────────────────────────────────────
  const [watermarkPos, setWatermarkPos] = useState({ top: 10, left: 10 });
  // Session ID — unique per page load, used to identify leaked recordings
  const [sessionId] = useState(() => `SID-${Math.random().toString(36).substr(2, 7).toUpperCase()}`);
  // Watermark timestamp — updates every minute
  const [watermarkTime, setWatermarkTime] = useState('');

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const videoEl = useRef(null);
  const hlsRef = useRef(null); // holds the active HLS.js instance
  const shakaRef = useRef(null); // holds the active Shaka Player instance

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

    const savedNotes = localStorage.getItem(`lms_notes_course_${id}`);
    if (savedNotes) setNotes(savedNotes);

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
      setSecureStreamUrl(streamUrl);   // FR-29: signed Cloudinary URL or opaque proxy token
      setIsHLS(hlsFlag);               // FR-34: true → HLS.js adaptive, false → plain src
      setIsDrm(drmFlag);
      setIsDASH(dashFlag);
      setLicenseServerUrl(licenseUrl || '');
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
  // FR-31: Screen recording detection (browser-based heuristics for Web)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const checkScreenRecording = () => {
      if (document.hidden) {
        pauseVideoSecurely();
        setScreenRecordWarning(true);
        return;
      }
      setScreenRecordWarning(false);
    };

    const handleBlur = () => {
      if (videoSecurity?.antiScreenRecording) {
        pauseVideoSecurely();
        setScreenRecordWarning(true);
      }
    };
    const handleFocus = () => setScreenRecordWarning(false);

    document.addEventListener('visibilitychange', checkScreenRecording);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    screenRecordCheckRef.current = setInterval(checkScreenRecording, 3000);

    return () => {
      document.removeEventListener('visibilitychange', checkScreenRecording);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      clearInterval(screenRecordCheckRef.current);
    };
  }, [videoSecurity]);

  const pauseVideoSecurely = () => {
    if (videoEl.current && !videoEl.current.paused) {
      videoEl.current.pause();
      setIsPlaying(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // FR-31: Watermark — position jitter every 4s, time update every 60s
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const updateTime = () =>
      setWatermarkTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    updateTime();
    const timeTimer = setInterval(updateTime, 60000);
    return () => clearInterval(timeTimer);
  }, []);

  useEffect(() => {
    const jitter = setInterval(() => {
      setWatermarkPos({
        top: Math.floor(Math.random() * 78) + 5,
        left: Math.floor(Math.random() * 68) + 5,
      });
    }, 4000);
    return () => clearInterval(jitter);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // FR-34: HLS.js / plain-src source management
  // Fires whenever secureStreamUrl or isHLS changes (e.g. lecture switch).
  // Destroys any previous HLS instance before attaching a new one.
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const videoElement = videoEl.current;
    if (!videoElement) return;

    // Destroy existing HLS instance on every change
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Destroy existing Shaka Player instance on every change
    if (shakaRef.current) {
      shakaRef.current.destroy().catch(() => {});
      shakaRef.current = null;
    }

    if (!secureStreamUrl) {
      videoElement.removeAttribute('src');
      videoElement.load();
      return;
    }

    const initPlayer = async () => {
      if (isDrm) {
        const loaded = await ensureShakaLoaded();
        if (loaded && window.shaka) {
          console.log("[DRM_PLAYER] Initializing Shaka Player for Widevine DRM...");
          const shakaPlayer = new window.shaka.Player(videoElement);
          shakaRef.current = shakaPlayer;

          shakaPlayer.addEventListener('error', (event) => {
            console.error('[DRM_PLAYER] Shaka Player error:', event.detail);
          });

          const drmConfig = {};
          if (licenseServerUrl) {
            drmConfig['servers'] = {
              'com.widevine.alpha': licenseServerUrl,
              'com.microsoft.playready': licenseServerUrl
            };
          }
          shakaPlayer.configure({ drm: drmConfig });

          try {
            await shakaPlayer.load(secureStreamUrl);
            console.log('[DRM_PLAYER] Shaka Player loaded stream successfully');
            return;
          } catch (error) {
            console.error('[DRM_PLAYER] Shaka Player load failed, falling back:', error);
          }
        }
      }

      // Fallback path if not DRM or Shaka failed to load/play
      if (isHLS) {
        if (Hls.isSupported()) {
          // HLS.js adaptive streaming (Chrome, Firefox, Edge)
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            enableWorker: true,
            debug: false,
          });
          hls.loadSource(secureStreamUrl);
          hls.attachMedia(videoElement);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) console.error('Fatal HLS error:', data.type, data.details);
          });
          hlsRef.current = hls;
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS (Safari / iOS)
          videoElement.src = secureStreamUrl;
          videoElement.load();
        }
      } else {
        // Plain MP4 or legacy proxy URL
        videoElement.src = secureStreamUrl;
        videoElement.load();
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (shakaRef.current) {
        const p = shakaRef.current;
        shakaRef.current = null;
        p.destroy().catch(() => {});
      }
    };
  }, [secureStreamUrl, isHLS, isDrm, licenseServerUrl]);

  // ══════════════════════════════════════════════════════════════════════════════
  // FR-30: Prevent right-click / download keyboard shortcuts
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const blockContextMenu = (e) => {
      if (e.target.closest('.custom-video-player-container')) {
        e.preventDefault();
        return false;
      }
    };

    const blockKeyShortcuts = (e) => {
      const blocked = (
        (e.ctrlKey && (e.key === 's' || e.key === 'u')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'j' || e.key === 'c')) ||
        e.key === 'F12'
      );
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockKeyShortcuts);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeyShortcuts);
    };
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
    if (activeLecture && videoEl.current) {
      reportProgress(videoEl.current.currentTime);
    }
    setActiveLecture(lecture);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // Clearing secureStreamUrl triggers the HLS effect to clean up any
    // existing HLS instance before the new token/URL arrives.
    setSecureStreamUrl('');
    setIsHLS(false);
    setIsDrm(false);
    setIsDASH(false);
    setLicenseServerUrl('');

    if (videoEl.current) videoEl.current.pause();

    // FR-29/32: Get fresh stream token for selected lecture
    await loadStreamToken(lecture);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // FR-33: Standard player controls
  // ══════════════════════════════════════════════════════════════════════════════
  const handlePlayToggle = () => {
    if (!videoEl.current) return;
    if (isPlaying) {
      videoEl.current.pause();
      setIsPlaying(false);
      reportProgress(videoEl.current.currentTime);
    } else {
      videoEl.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (videoEl.current) setCurrentTime(videoEl.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoEl.current) return;
    const secs = videoEl.current.duration;
    setDuration(secs);

    // Auto-patch duration in MongoDB if stored as 0:00
    if (
      secs > 0 &&
      isFinite(secs) &&
      activeLecture &&
      (!activeLecture.duration || activeLecture.duration === '0:00')
    ) {
      const videoDoc = activeLecture.video;
      const videoId = videoDoc
        ? (typeof videoDoc === 'object' ? videoDoc._id?.toString() : videoDoc)
        : null;

      if (videoId) {
        const formatted = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
        const token = localStorage.getItem('lms_token');
        fetch(`${API_BASE_URL}/api/videos/${videoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ duration: formatted }),
        }).catch(() => {}); // fire-and-forget, don't disrupt playback
      }
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handleCanPlay = () => setIsBuffering(false);

  const handleSeek = (e) => {
    const seekVal = parseFloat(e.target.value);
    if (videoEl.current) {
      videoEl.current.currentTime = seekVal;
      setCurrentTime(seekVal);
    }
  };

  const handleVolumeChange = (e) => {
    const volVal = parseFloat(e.target.value);
    setVolume(volVal);
    setIsMuted(volVal === 0);
    if (videoEl.current) {
      videoEl.current.volume = volVal;
      videoEl.current.muted = (volVal === 0);
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoEl.current) videoEl.current.muted = nextMuted;
  };

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    if (videoEl.current) videoEl.current.playbackRate = rate;
  };

  const handleFullscreen = () => {
    const container = document.querySelector('.custom-video-player-container');
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(console.error);
    }
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
          if (parts.length === 2) {
            totalSec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          } else {
            const matches = lecture.duration.match(/\d+/);
            if (matches) {
              totalSec = parseInt(matches[0]) * 60;
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

  const handleVideoEnded = () => {
    setIsPlaying(false);
    const lectureId = activeLecture?._id || activeLecture?.id;
    if (lectureId && !completedLectures.includes(lectureId)) {
      handleCompletedToggle(lectureId);
    } else {
      reportProgress(duration, true);
    }
    const currentIndex = flatLectures.findIndex(l => (l._id || l.id) === lectureId);
    if (currentIndex !== -1 && currentIndex < flatLectures.length - 1) {
      const nextLecture = flatLectures[currentIndex + 1];
      setTimeout(() => {
        handleLectureSelect(nextLecture).then(() => {
          setTimeout(() => {
            videoEl.current?.play().then(() => setIsPlaying(true)).catch(console.error);
          }, 600);
        });
      }, 1000);
    }
  };

  const formatTime = (t) => {
    if (isNaN(t)) return '00:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleModule = (idx) => setOpenModules(prev => ({ ...prev, [idx]: !prev[idx] }));

  const handleSaveNotes = () => {
    localStorage.setItem(`lms_notes_course_${id}`, notes);
    alert('Notes saved!');
  };

  const handleAddDiscussion = (e) => {
    e.preventDefault();
    if (!discussionInput.trim()) return;
    setDiscussions([
      {
        id: Date.now(),
        name: userProfile.name || 'You',
        avatar: (userProfile.name || 'Y').charAt(0),
        text: discussionInput,
        time: 'Just now',
      },
      ...discussions,
    ]);
    setDiscussionInput('');
  };

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

      {/* FR-31: Screen capture detection banner (experimental) */}
      {screenRecordWarning && (
        <div className="screen-record-warning-bar">
          <AlertTriangle size={16} />
          <span>
            <strong>Screen Capture Detection (Experimental):</strong> Browser focus or tab visibility changed.
            Playback paused. Return to this tab to resume.
          </span>
        </div>
      )}

      {/* Upper Navigation Header */}
      <div className="classroom-top-nav">
        <button className="back-btn" onClick={() => navigate('/dashboard/courses')}>
          <ChevronLeft size={20} />
          <span></span>
        </button>
        <div className="classroom-course-details">
          <h2>{courseData.title}</h2>
          <span className="classroom-progress">
            ({completedLectures.length} / {flatLectures.length} lectures completed)
          </span>
        </div>
        {/* FR-29: Security indicator */}
        <div className="secure-stream-badge" title="Content is delivered via secure encrypted stream">
          <Shield size={14} />
          <span>Secure Stream</span>
        </div>
      </div>

      <div className="classroom-workspace-grid">

        {/* Left Column: Player & Tabs */}
        <div className="classroom-content-column">

          {/*
            ── FR-29, FR-30, FR-32, FR-33, FR-34 ────────────────────────────────
            Custom secure video player
          */}
          <div
            className="custom-video-player-container"
            onContextMenu={(e) => e.preventDefault()}
          >
            {streamTokenLoading && (
              <div className="stream-loading-overlay">
                <div className="stream-spinner" />
                <span>Loading secure stream…</span>
              </div>
            )}

            {/* Single video element — src managed by HLS effect, never set via JSX prop */}
            <video
              ref={videoEl}
              className="secure-video-element"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleVideoEnded}
              onWaiting={handleWaiting}
              onCanPlay={handleCanPlay}
              onError={(e) => { console.error('Video error:', e.target.error); setIsBuffering(false); }}
              onClick={handlePlayToggle}
              autoPlay={false}
              playsInline
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              preload="auto"
            />

            {/* FR-34: Buffering spinner overlay — only when a video is actually loading */}
            {isBuffering && !streamTokenLoading && secureStreamUrl && (
              <div className="buffering-overlay">
                <div className="buffering-spinner" />
                <span>Buffering…</span>
              </div>
            )}

            {/* No lectures in course at all */}
            {!streamTokenLoading && flatLectures.length === 0 && (
              <div className="buffering-overlay" style={{ background: 'rgba(0,0,0,0.85)' }}>
                <BookOpen size={40} style={{ opacity: 0.35, marginBottom: 8 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>No lectures available yet</span>
                <span style={{ fontSize: 12, opacity: 0.55, marginTop: 4, textAlign: 'center', maxWidth: 260 }}>
                  The instructor hasn't added any content to this course yet. Check back later.
                </span>
              </div>
            )}

            {/* Lectures exist but none selected / stream not ready */}
            {!streamTokenLoading && flatLectures.length > 0 && !secureStreamUrl && (
              <div className="buffering-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
                <PlayCircle size={48} style={{ opacity: 0.4, marginBottom: 8 }} />
                <span>Select a lecture to begin</span>
              </div>
            )}

            {/* FR-31: Dynamic watermark — moves every 4s to deter/identify screen recording */}
            <div
              className="floating-security-watermark"
              style={{ top: `${watermarkPos.top}%`, left: `${watermarkPos.left}%` }}
              aria-hidden="true"
            >
              <span>{userProfile.email || userProfile.name}</span>
              <span>{watermarkTime}</span>
              <span>{sessionId}</span>
            </div>

            {/* FR-33: Custom player controls */}
            <div className="video-controls-overlay">
              {/* Progress bar — FR-33: seek */}
              <div className="progress-slider-row">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="timeline-slider-bar"
                  style={{
                    '--progress-pct': `${duration ? (currentTime / duration) * 100 : 0}%`
                  }}
                />
              </div>

              {/* Action buttons */}
              <div className="controls-buttons-bar">
                <div className="left-controls">
                  {/* FR-33: Play/Pause */}
                  <button onClick={handlePlayToggle} className="control-btn" title={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>

                  {/* FR-33: Seek backward */}
                  <button
                    onClick={() => { if (videoEl.current) videoEl.current.currentTime -= 10; }}
                    className="control-btn-sec"
                    title="Rewind 10s"
                  >
                    <RotateCcw size={15} />
                  </button>

                  {/* FR-33: Time display */}
                  <span className="time-display">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="right-controls">
                  {/* FR-33: Volume */}
                  <div className="volume-slider-wrapper">
                    <button onClick={handleMuteToggle} className="control-btn-sec">
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="volume-slider-bar"
                    />
                  </div>

                  {/* FR-33: Playback speed */}
                  <div className="speed-selector-group">
                    {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        className={`speed-pill-btn ${playbackRate === speed ? 'active' : ''}`}
                        onClick={() => handleSpeedChange(speed)}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* FR-33: Fullscreen */}
                  <button onClick={handleFullscreen} className="control-btn" title="Fullscreen">
                    <Maximize size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* FR-29, FR-30, FR-32, FR-34: Security notice */}
            <div className="inspect-protection-banner">
              <Info size={12} />
              <span>
                Secure stream · Downloads disabled · URLs protected
                {videoSecurity?.antiScreenRecording ? ' · Screen capture detection active' : ''}
                {isHLS ? ' · HLS adaptive bitrate' : ''}
              </span>
            </div>
          </div>

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
                            ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
                            : '0:00')
                        : activeLecture.duration
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
                                      <Clock size={11} /> {lecture.duration}
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