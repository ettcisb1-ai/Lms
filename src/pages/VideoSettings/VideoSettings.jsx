  import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Upload, Lock, Shield, EyeOff, FileDown, Loader, Info
} from 'lucide-react';
import Hls from 'hls.js';
import './VideoSettings.css';
import { VIDEO_ENDPOINTS, COURSE_ENDPOINTS, API_BASE_URL } from '../../utils/api';
import { ShimmerVideoSettings } from '../../components/Shimmer/Shimmer';

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

const VideoSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    disableDownloads: true,
    hideUrls: true,
    tokenizedStreaming: false,
    drm: false,
    antiScreenRecording: true,
    securePlayback: true
  });
  const [assignedCourseId, setAssignedCourseId] = useState('none');
  const [videoStatus, setVideoStatus] = useState('Published');
  const [videoTitle, setVideoTitle] = useState('');

  // ── Player state ──────────────────────────────────────────────────────────
  const [secureStreamUrl, setSecureStreamUrl] = useState('');
  const [isHLS, setIsHLS] = useState(false);
  const [isDrm, setIsDrm] = useState(false);
  const [isDASH, setIsDASH] = useState(false);
  const [licenseServerUrl, setLicenseServerUrl] = useState('');
  const [streamTokenLoading, setStreamTokenLoading] = useState(false);

  // Track when the video element is mounted so the player effect re-runs after isLoading clears
  const [videoElMounted, setVideoElMounted] = useState(false);
  const videoEl = useRef(null);
  const videoRefCallback = useCallback((el) => {
    videoEl.current = el;
    if (el) setVideoElMounted(true);
  }, []);
  const hlsRef = useRef(null);
  const shakaRef = useRef(null);

  const fetchData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('lms_token');
    try {
      const [videoRes, coursesRes] = await Promise.all([
        fetch(VIDEO_ENDPOINTS.GET(id), { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(COURSE_ENDPOINTS.LIST)
      ]);
      const [videoResult, coursesResult] = await Promise.all([videoRes.json(), coursesRes.json()]);

      if (videoResult.success && videoResult.data) {
        const v = videoResult.data;
        setVideo(v);
        setVideoTitle(v.title);
        setVideoStatus(v.status || 'Published');
        setAssignedCourseId(v.course ? (v.course._id || v.course) : 'none');
        setSecuritySettings({
          disableDownloads: v.disableDownloads !== undefined ? v.disableDownloads : true,
          hideUrls: v.hideUrls !== undefined ? v.hideUrls : true,
          tokenizedStreaming: v.tokenizedStreaming !== undefined ? v.tokenizedStreaming : false,
          drm: v.drm !== undefined ? v.drm : false,
          antiScreenRecording: v.antiScreenRecording !== undefined ? v.antiScreenRecording : true,
          securePlayback: v.securePlayback !== undefined ? v.securePlayback : true,
        });
      }
      if (coursesResult.success) setCourses(coursesResult.data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // ── Fetch signed stream token ─────────────────────────────────────────────
  const loadStreamToken = useCallback(async () => {
    if (!id) return;
    setStreamTokenLoading(true);
    const token = localStorage.getItem('lms_token');
    try {
      const res = await fetch(VIDEO_ENDPOINTS.GET_STREAM_TOKEN(id), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.streamUrl) {
        console.log('[VideoSettings] Stream URL:', result.streamUrl);
        const absoluteStreamUrl = result.streamUrl.startsWith('http')
          ? result.streamUrl
          : `${API_BASE_URL}${result.streamUrl}`;
        setSecureStreamUrl(absoluteStreamUrl);
        setIsHLS(result.isHLS || false);
        setIsDrm(result.isDrm || false);
        setIsDASH(result.isDASH || false);
        setLicenseServerUrl(result.licenseServerUrl || '');
      } else {
        console.error('[VideoSettings] Token failed:', result);
        setSecureStreamUrl('');
      }
    } catch (err) {
      console.error('Stream token error:', err);
      setSecureStreamUrl('');
    } finally {
      setStreamTokenLoading(false);
    }
  }, [id]);

  useEffect(() => { loadStreamToken(); }, [loadStreamToken]);

  // ── Player source management (DRM, HLS, or Plain MP4) ────────────────────
  useEffect(() => {
    const el = videoEl.current;
    if (!el) return;

    // Destroy existing HLS instance on change
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Destroy existing Shaka Player instance on change
    if (shakaRef.current) {
      shakaRef.current.destroy().catch(() => {});
      shakaRef.current = null;
    }

    if (!secureStreamUrl) {
      el.removeAttribute('src');
      el.load();
      return;
    }

    const initPlayer = async () => {
      if (isDrm) {
        const loaded = await ensureShakaLoaded();
        if (loaded && window.shaka) {
          console.log("[VideoSettings] Initializing Shaka Player for Widevine DRM...");
          const shakaPlayer = new window.shaka.Player(el);
          shakaRef.current = shakaPlayer;

          shakaPlayer.addEventListener('error', (event) => {
            console.error('[VideoSettings Shaka Error]', event.detail);
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
            console.log('[VideoSettings] Shaka Player loaded stream successfully');
            return;
          } catch (error) {
            console.error('[VideoSettings] Shaka Player load failed, falling back:', error);
          }
        }
      }

      // Fallback path if not DRM or Shaka failed
      if (isHLS) {
        if (Hls.isSupported()) {
          console.log('[VideoSettings] Using HLS.js for:', secureStreamUrl);
          const hls = new Hls({ maxBufferLength: 30, enableWorker: true, debug: false });
          hls.loadSource(secureStreamUrl);
          hls.attachMedia(el);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) console.error('Fatal HLS error:', data.type, data.details);
          });
          hlsRef.current = hls;
        } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = secureStreamUrl;
          el.load();
        }
      } else {
        // Plain MP4 — proxy stream URL
        console.log('[VideoSettings] Setting plain MP4 src:', secureStreamUrl);
        el.src = secureStreamUrl;
        el.load();
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (shakaRef.current) {
        shakaRef.current.destroy().catch(() => {});
        shakaRef.current = null;
      }
    };
  }, [secureStreamUrl, isHLS, isDrm, licenseServerUrl, videoElMounted]);



  const handleToggle = (setting) => setSecuritySettings(prev => ({ ...prev, [setting]: !prev[setting] }));

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('lms_token');
    try {
      const res = await fetch(VIDEO_ENDPOINTS.UPDATE(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: videoTitle,
          status: videoStatus,
          course: assignedCourseId === 'none' ? '' : assignedCourseId,
          ...securitySettings
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to save.');
      if (result.success) {
        alert('Video settings saved!');
        // Re-fetch the stream token in case status/settings changed
        await loadStreamToken();
        navigate('/admin/videos');
      }
    } catch (err) {
      alert(err.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <ShimmerVideoSettings />;
  if (!video) return <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>Video not found!</div>;

  return (
    <div className="video-settings-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/admin/videos')}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="page-title">Video Settings</h2>
            <p className="page-subtitle">Manage playback, security, and course assignment</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleSaveChanges} disabled={isSaving}>
          {isSaving ? <Loader size={16} className="spin-icon" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} /> : null}
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="video-player-container">
        <div
          className="vs-player-container"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Stream loading overlay */}
          {streamTokenLoading && (
            <div className="stream-loading-overlay">
              <div className="stream-spinner" />
              <span>Loading secure stream…</span>
            </div>
          )}

          {/* No stream available */}
          {!streamTokenLoading && !secureStreamUrl && (
            <div className="buffering-overlay" style={{ background: '#0f172a' }}>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>Preview unavailable</span>
            </div>
          )}

          {/* Normal native video element — always rendered so ref is stable */}
          <video
            ref={videoRefCallback}
            className="secure-video-element"
            controls
            playsInline
            controlsList="nodownload"
            disablePictureInPicture
            preload="auto"
            onError={(e) => {
              if (e.target.error && !isDrm) {
                console.error('[VideoSettings] Video error code:', e.target.error.code, e.target.error.message);
                alert("Video Playback Error:\nCode: " + e.target.error.code + "\nMessage: " + e.target.error.message);
              }
            }}
          />

          {/* Security info banner */}
          <div className="inspect-protection-banner">
            <Info size={12} />
            <span>Secure stream · Admin preview · {isDrm ? 'Widevine DRM' : isHLS ? 'HLS adaptive' : 'MP4'}</span>
          </div>
        </div>
      </div>

      <div className="settings-grid">
        {/* Left Column: Video Controls */}
        <div className="settings-card">
          <div className="card-header">
            <h3>Video Controls</h3>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Video Title</label>
              <input 
                type="text" 
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%' }}
              />
            </div>
            
            <div className="form-group">
              <label>Assign to Course</label>
              <select 
                value={assignedCourseId}
                onChange={(e) => setAssignedCourseId(e.target.value)}
              >
                <option value="none">Not assigned</option>
                {courses.map(c => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select 
                value={videoStatus}
                onChange={(e) => setVideoStatus(e.target.value)}
              >
                <option value="Draft">Draft</option>
                <option value="Processing">Processing</option>
                <option value="Published">Published</option>
              </select>
            </div>

            <div className="form-divider"></div>

            <div className="attachment-section">
              <h4>Subtitles & Captions</h4>
              <div className="upload-box">
                <Upload size={16} />
                <span>Upload .srt or .vtt file</span>
              </div>
            </div>

            <div className="attachment-section mt-4">
              <h4>Lecture Notes & PDFs</h4>
              <div className="upload-box">
                <Upload size={16} />
                <span>Upload PDF attachment</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Security Settings */}
        <div className="settings-card">
          <div className="card-header">
            <h3>Advanced Security</h3>
          </div>
          <div className="card-body">
            
            <div className="security-item">
              <div className="security-info">
                <Shield size={18} className="security-icon" />
                <div>
                  <h4>DRM / HLS Support</h4>
                  <p>Encrypt video using industry standard DRM</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={securitySettings.drm} onChange={() => handleToggle('drm')} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="security-item">
              <div className="security-info">
                <FileDown size={18} className="security-icon" />
                <div>
                  <h4>Disable Downloads</h4>
                  <p>Prevent users from downloading video directly</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={securitySettings.disableDownloads} onChange={() => handleToggle('disableDownloads')} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="security-item">
              <div className="security-info">
                <EyeOff size={18} className="security-icon" />
                <div>
                  <h4>Hide Video URLs</h4>
                  <p>Obfuscate source URL from browser inspector</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={securitySettings.hideUrls} onChange={() => handleToggle('hideUrls')} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="security-item">
              <div className="security-info">
                <Lock size={18} className="security-icon" />
                <div>
                  <h4>Tokenized Streaming</h4>
                  <p>Require unique auth token for every stream request</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={securitySettings.tokenizedStreaming} onChange={() => handleToggle('tokenizedStreaming')} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="security-item">
              <div className="security-info">
                <Shield size={18} className="security-icon text-warning" />
                <div>
                  <h4>Anti Screen Recording</h4>
                  <p>Apply screen blanking techniques on supported devices</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={securitySettings.antiScreenRecording} onChange={() => handleToggle('antiScreenRecording')} />
                <span className="slider"></span>
              </label>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSettings;
