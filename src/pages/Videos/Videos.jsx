import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, Search, Filter, PlayCircle, MoreVertical, Film,
  Clock, Plus, X, Save, Pencil, Trash2, Settings, Check, AlertTriangle, Loader, Camera
} from 'lucide-react';
import './Videos.css';
import { VIDEO_ENDPOINTS, CATEGORY_ENDPOINTS, COURSE_ENDPOINTS, UPLOAD_ENDPOINT, formatStoredDuration } from '../../utils/api';
import { ShimmerVideos } from '../../components/Shimmer/Shimmer';
import { useUpload } from '../../context/UploadContext';
import ThumbnailPicker from '../../components/ThumbnailPicker/ThumbnailPicker';

// ─── Dropdown Menu Component ─────────────────────────────────────────────────
const VideoCardMenu = ({ video, onEdit, onDelete, onSettings }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="video-card-menu" ref={menuRef}>
      <button
        className="icon-btn menu-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
        title="More options"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="video-dropdown-menu">
          <button
            className="dropdown-item"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(video); }}
          >
            <Pencil size={14} />
            <span>Edit Details</span>
          </button>
          <button
            className="dropdown-item"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onSettings(video); }}
          >
            <Settings size={14} />
            <span>Security Settings</span>
          </button>
          <div className="dropdown-divider" />
          <button
            className="dropdown-item danger"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(video); }}
          >
            <Trash2 size={14} />
            <span>Delete Video</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const EditVideoModal = ({ video, categories, courses, onClose, onSaved }) => {
  const [title, setTitle] = useState(video.title || '');
  const [selectedCategory, setSelectedCategory] = useState(
    video.category?._id || video.category || ''
  );
  const [selectedCourse, setSelectedCourse] = useState(
    video.course?._id || video.course || ''
  );
  const [status, setStatus] = useState(video.status || 'Published');
  const [duration, setDuration] = useState(video.duration || '0:00');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailCleared, setThumbnailCleared] = useState(false);
  const [showThumbPicker, setShowThumbPicker] = useState(false);
  const [thumbPickerUrl, setThumbPickerUrl] = useState(null);
  const [loadingPickerUrl, setLoadingPickerUrl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const thumbnailInputRef = useRef(null);

  // Fetch a stream token URL for the picker (admin preview)
  const openThumbPicker = async () => {
    setLoadingPickerUrl(true);
    try {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(VIDEO_ENDPOINTS.GET_STREAM_TOKEN(video._id), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.streamUrl) {
        const API_BASE = UPLOAD_ENDPOINT.replace(/\/api\/upload$/, '');
        const url = data.streamUrl.startsWith('http')
          ? data.streamUrl
          : `${API_BASE}${data.streamUrl}`;
        setThumbPickerUrl(url);
        setShowThumbPicker(true);
      } else {
        setError('Could not load video for preview. Try again.');
      }
    } catch {
      setError('Could not load video for preview. Check your connection.');
    } finally {
      setLoadingPickerUrl(false);
    }
  };

  const filteredCourses = selectedCategory
    ? courses.filter(c => {
      const catId = c.category?._id || c.category;
      return catId === selectedCategory;
    })
    : courses;

  // Helper: upload image to S3
  const uploadImageToS3 = async (file) => {
    const token = localStorage.getItem('lms_token');
    const s3SigEndpoint = UPLOAD_ENDPOINT.endsWith('/upload')
      ? UPLOAD_ENDPOINT.replace(/\/upload$/, '/upload/s3-signature')
      : `${UPLOAD_ENDPOINT}/s3-signature`;

    const sigRes = await fetch(
      `${s3SigEndpoint}?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sigData = await sigRes.json();
    if (!sigRes.ok || !sigData.success)
      throw new Error(sigData.message || 'Failed to get S3 upload URL');

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sigData.presignedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed`));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });

    return sigData.publicUrl;
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Video title is required.'); return; }
    if (!selectedCategory) { setError('Please select a category.'); return; }
    if (!selectedCourse) { setError('Please select a course.'); return; }

    setSaving(true);
    setError('');
    try {
      let thumbnailUrl = video.thumbnail || '';
      if (thumbnailFile) {
        thumbnailUrl = await uploadImageToS3(thumbnailFile);
      } else if (thumbnailCleared) {
        thumbnailUrl = ''; // user explicitly removed it
      }

      const token = localStorage.getItem('lms_token');
      const res = await fetch(VIDEO_ENDPOINTS.UPDATE(video._id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, category: selectedCategory, course: selectedCourse, status, duration, thumbnail: thumbnailUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to update video.');
      if (result.success) {
        onSaved(result.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="upload-modal-backdrop" onClick={onClose}>
      <div className="upload-modal edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Video Details</h3>
          <button className="icon-btn close-btn" onClick={onClose} disabled={saving}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-banner">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="edit-form-grid">
            <div className="form-group">
              <label>Video Title <span className="req">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. React Hooks Deep Dive"
                disabled={saving}
              />
            </div>

            {/* Thumbnail Picker */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Thumbnail</label>
              <div className="thumbnail-picker">
                {(thumbnailFile || (video.thumbnail && !thumbnailCleared)) ? (
                  <div className="thumbnail-preview">
                    <img
                      src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : video.thumbnail}
                      alt="Thumbnail"
                    />
                    <button
                      type="button"
                      className="thumbnail-remove-btn"
                      onClick={() => { setThumbnailFile(null); setThumbnailCleared(true); }}
                      disabled={saving}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="thumbnail-upload-btn"
                  onClick={openThumbPicker}
                  disabled={saving || loadingPickerUrl}
                >
                  {loadingPickerUrl
                    ? <><Loader size={14} className="spin-icon" /><span>Loading…</span></>
                    : <><Camera size={16} /><span>
                        {(thumbnailFile || (video.thumbnail && !thumbnailCleared))
                          ? 'Change Frame'
                          : 'Pick from Video'}
                      </span></>
                  }
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} disabled={saving}>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Processing">Processing</option>
              </select>
            </div>

            <div className="form-group">
              <label>Duration</label>
              <input
                type="text"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="e.g. 12:45"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>Category <span className="req">*</span></label>
              <select
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setSelectedCourse(''); }}
                disabled={saving}
              >
                <option value="">Select a Category</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Course <span className="req">*</span></label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                disabled={saving || !selectedCategory}
              >
                <option value="">Select a Course</option>
                {filteredCourses.map(course => (
                  <option key={course._id} value={course._id}>{course.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group file-info-group">
              <label>Video File</label>
              <div className="file-info-box">
                <Film size={14} />
                <span>{video.size || 'Unknown size'}</span>
                <span className="file-info-note">File cannot be replaced — upload a new video instead.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Clock size={14} className="spin-icon" /><span>{thumbnailFile ? 'Uploading thumbnail…' : 'Saving...'}</span></>
              : <><Check size={14} /><span>Save Changes</span></>}
          </button>
        </div>
      </div>

      {/* ThumbnailPicker — loads via stream token (secure, no raw URL exposed) */}
      {showThumbPicker && thumbPickerUrl && (
        <ThumbnailPicker
          videoUrl={thumbPickerUrl}
          onCapture={(blob) => {
            const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            setThumbnailFile(file);
            setThumbnailCleared(false);
          }}
          onClose={() => { setShowThumbPicker(false); setThumbPickerUrl(null); }}
        />
      )}
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteConfirmModal = ({ video, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(VIDEO_ENDPOINTS.DELETE(video._id), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to delete video.');
      if (result.success) onDeleted(video._id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="upload-modal-backdrop" onClick={onClose}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon-wrap danger-icon">
          <Trash2 size={24} />
        </div>
        <h3>Delete Video?</h3>
        <p>
          You are about to permanently delete <strong>"{video.title}"</strong>.
          This cannot be undone and will remove the video from any courses it's linked to.
        </p>
        {error && <p className="confirm-error">{error}</p>}
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={14} />
            <span>{deleting ? 'Deleting...' : 'Yes, Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Security Settings Modal ──────────────────────────────────────────────────
const SecurityModal = ({ video, onClose, onSaved }) => {
  const [settings, setSettings] = useState({
    disableDownloads: video.disableDownloads ?? true,
    hideUrls: video.hideUrls ?? true,
    tokenizedStreaming: video.tokenizedStreaming ?? true,
    antiScreenRecording: video.antiScreenRecording ?? true,
    securePlayback: video.securePlayback ?? true,
    adaptiveStreaming: video.adaptiveStreaming ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(VIDEO_ENDPOINTS.UPDATE_SECURITY(video._id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to save security settings.');
      if (result.success) onSaved(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const securityOptions = [
    { key: 'disableDownloads', label: 'Disable Downloads', desc: 'Prevent users from downloading this video (FR-30)' },
    { key: 'hideUrls', label: 'Hide Source URLs', desc: 'Block raw video URL inspection in browser DevTools (FR-32)' },
    { key: 'tokenizedStreaming', label: 'Tokenized Streaming', desc: 'Use signed tokens for every stream request (FR-29)' },
    { key: 'antiScreenRecording', label: 'Screen Capture Detection (Experimental)', desc: 'Detects browser tab focus/visibility changes. Cannot prevent OBS, Bandicam, Xbox Game Bar, or mobile camera recording.' },
    { key: 'securePlayback', label: 'Secure Playback', desc: 'Enforce all playback security policies (FR-29)' },
    { key: 'adaptiveStreaming', label: 'Adaptive Bitrate Streaming', desc: 'Enable buffered adaptive streaming for smooth playback (FR-34)' },
  ];

  return (
    <div className="upload-modal-backdrop" onClick={onClose}>
      <div className="upload-modal security-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Security Settings</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{video.title}</p>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} disabled={saving}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="modal-error-banner">
              <AlertTriangle size={14} /><span>{error}</span>
            </div>
          )}
          <div className="security-toggles-list">
            {securityOptions.map(opt => (
              <div key={opt.key} className="security-toggle-row">
                <div className="security-toggle-text">
                  <span className="security-toggle-label">{opt.label}</span>
                  <span className="security-toggle-desc">{opt.desc}</span>
                </div>
                <button
                  className={`toggle-switch ${settings[opt.key] ? 'on' : 'off'}`}
                  onClick={() => toggle(opt.key)}
                  disabled={saving}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Clock size={14} className="spin-icon" /><span>Saving...</span></> : <><Check size={14} /><span>Save Settings</span></>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Videos Page ─────────────────────────────────────────────────────────
const Videos = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const LIMIT = 12;

  // ── Upload state comes from global context (survives navigation) ───────────
  const {
    isUploadModalOpen, setIsUploadModalOpen,
    selectedFile, setSelectedFile,
    thumbnailFile, setThumbnailFile,
    newVideoTitle, setNewVideoTitle,
    selectedCategory, setSelectedCategory,
    selectedCourse, setSelectedCourse,
    openUploadModal,
    startUpload,
    resetUpload,
  } = useUpload();

  // Action modals (these are page-local — fine to stay here)
  const [editingVideo, setEditingVideo] = useState(null);
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [securityVideo, setSecurityVideo] = useState(null);

  const fetchData = async (page = 1, search = '') => {
    setIsLoading(true);
    const token = localStorage.getItem('lms_token');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);

      const [videoRes, catRes, courseRes] = await Promise.all([
        fetch(`${VIDEO_ENDPOINTS.LIST}?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(CATEGORY_ENDPOINTS.LIST),
        fetch(COURSE_ENDPOINTS.LIST),
      ]);
      const [videoResult, catResult, courseResult] = await Promise.all([
        videoRes.json(), catRes.json(), courseRes.json()
      ]);
      if (videoResult.success) {
        const data  = videoResult.data   || [];
        const total = videoResult.total  ?? data.length;
        const limit = videoResult.limit  ?? LIMIT;
        const pages = videoResult.pages  ?? Math.ceil(total / limit) ?? 1;
        setVideos(data);
        setTotalPages(Math.max(1, pages));
        setTotalVideos(total);
        setCurrentPage(videoResult.page || page);
      }
      if (catResult.success)    setCategories(catResult.data);
      if (courseResult.success) setCourses(courseResult.data);
    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Single effect: run on mount and whenever page or searchTerm changes.
  // Search resets to page 1 and is debounced 400 ms.
  const searchRef = useRef(searchTerm);
  useEffect(() => {
    const isNewSearch = searchTerm !== searchRef.current;
    searchRef.current = searchTerm;

    if (isNewSearch) {
      // Search changed — debounce and reset to page 1
      const timer = setTimeout(() => {
        setCurrentPage(1);
        fetchData(1, searchTerm);
      }, 400);
      return () => clearTimeout(timer);
    }

    // Page changed (or initial mount) — fetch immediately
    fetchData(currentPage, searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm]);

  const filteredCourses = selectedCategory
    ? courses.filter(c => (c.category?._id || c.category) === selectedCategory)
    : courses;

  // ── Thumbnail picker state (upload modal) ──────────────────────────────────
  const [showThumbPicker, setShowThumbPicker] = useState(false);

  // drag-and-drop state (UI only — file stored in context)
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = ()  => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      if (f.size > 500 * 1024 * 1024) { alert('Video file size must be under 500MB.'); return; }
      setSelectedFile(f);
    }
  };
  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) {
      if (f.size > 500 * 1024 * 1024) { alert('Video file size must be under 500MB.'); return; }
      setSelectedFile(f);
    }
  };

  // ── Action handlers ──────────────────────────────────────────────────────────
  const handleEditSaved = (updatedVideo) => {
    setVideos(prev => prev.map(v => v._id === updatedVideo._id ? updatedVideo : v));
    setEditingVideo(null);
  };

  const handleDeleted = (deletedId) => {
    setDeletingVideo(null);
    // If we deleted the last item on the page, go back one page
    const newPage = videos.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
    setCurrentPage(newPage);
    fetchData(newPage, searchTerm);
  };

  const handleSecuritySaved = (updatedVideo) => {
    setVideos(prev => prev.map(v => v._id === updatedVideo._id ? updatedVideo : v));
    setSecurityVideo(null);
  };

  // Search is now server-side — no client-side filter needed
  const displayedVideos = videos;

  return (
    <div className="videos-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Video Library</h2>
          <p className="page-subtitle">Upload, manage, and secure your video content.</p>
        </div>
        <button className="btn-primary" onClick={() => openUploadModal(() => fetchData(currentPage, searchTerm))}>
          <Plus size={16} /><span>Add Video</span>
        </button>
      </div>

      <div className="videos-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* <button className="btn-secondary"><Filter size={16} /><span>Filter</span></button> */}
      </div>

      {isLoading ? (
        <ShimmerVideos count={12} />
      ) : displayedVideos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
          {searchTerm ? `No videos found for "${searchTerm}".` : 'No videos found. Click "Add Video" to upload your first video lecture!'}
        </div>
      ) : (
        <>
          <div className="videos-grid">
            {displayedVideos.map(video => (
              <div
                key={video._id}
                className="video-card"
                onClick={() => navigate(`/admin/videos/${video._id}`)}
              >
                <div className="video-thumbnail">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px 8px 0 0' }} />
                  ) : (
                    <div className="thumbnail-overlay">
                      <PlayCircle size={48} className="play-icon" />
                    </div>
                  )}
                  <span className="video-duration">{formatStoredDuration(video.duration)}</span>
                  {video.status === 'Processing' && (
                    <div className="processing-badge"><Clock size={12} /> Processing...</div>
                  )}
                </div>

                <div className="video-info">
                  <div className="video-header">
                    <h3 className="video-title">{video.title}</h3>
                    <VideoCardMenu
                      video={video}
                      onEdit={setEditingVideo}
                      onDelete={setDeletingVideo}
                      onSettings={setSecurityVideo}
                    />
                  </div>

                  <div className="video-meta">
                    <span className={`status-dot ${video.status?.toLowerCase()}`}></span>
                    <span className="video-status">{video.status}</span>
                    <span className="dot">•</span>
                    <span className="video-size">{video.size}</span>
                  </div>

                  <div className="video-course">
                    <span className="label">Category:</span>{' '}
                    {video.category ? (video.category.name || video.category) : 'N/A'}
                  </div>
                  <div className="video-course">
                    <span className="label">Course:</span>{' '}
                    {video.course ? (video.course.title || video.course) : 'Unassigned'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="videos-pagination-compact">
              <button
                className="page-nav-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="page-counter">{currentPage}/{totalPages}</span>
              <button
                className="page-nav-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Upload Modal ──────────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <>
        <div className="upload-modal-backdrop">
          <div className="upload-modal">
            <div className="modal-header">
              <h3>Upload New Video</h3>
              <button className="icon-btn close-btn" onClick={resetUpload}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Video Title</label>
                <input type="text" placeholder="e.g. React Basics" value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Category <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                <select value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setSelectedCourse(''); }}>
                  <option value="">Select a Category</option>
                  {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Course <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}
                  disabled={!selectedCategory}>
                  <option value="">Select a Course</option>
                  {filteredCourses.map(course =>
                    <option key={course._id || course.id} value={course._id || course.id}>{course.title}</option>
                  )}
                </select>
              </div>

              {/* Thumbnail Picker — pick frame from selected video */}
              {selectedFile && (
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Thumbnail (Optional)</label>
                  <div className="thumbnail-picker">
                    {thumbnailFile ? (
                      <div className="thumbnail-preview">
                        <img src={URL.createObjectURL(thumbnailFile)} alt="Thumbnail" />
                        <button
                          type="button"
                          className="thumbnail-remove-btn"
                          onClick={() => setThumbnailFile(null)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="thumbnail-upload-btn"
                      onClick={() => setShowThumbPicker(true)}
                    >
                      <Camera size={16} />
                      <span>{thumbnailFile ? 'Change Frame' : 'Pick from Video'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <div className="upload-content">
                  <div className="upload-icon-wrapper"><UploadCloud size={32} className="upload-icon" /></div>
                  {selectedFile ? (
                    <>
                      <h4 style={{ color: '#10b981' }}>✓ {selectedFile.name}</h4>
                      <p style={{ color: 'var(--text-muted)' }}>
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB — click Start Upload
                      </p>
                      <button type="button" className="btn-outline"
                        style={{ marginTop: '12px' }} onClick={() => fileInputRef.current?.click()}>
                        Change File
                      </button>
                    </>
                  ) : (
                    <>
                      <h4>Drag & drop video files here</h4>
                      <p>Supports MP4, WebM, MOV up to 500MB.</p>
                      <button type="button" className="btn-outline"
                        style={{ marginTop: '12px' }} onClick={() => fileInputRef.current?.click()}>
                        Browse Files
                      </button>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="video/*"
                    onChange={handleFileSelect} style={{ display: 'none' }} />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetUpload}>Cancel</button>
              <button className="btn-primary" onClick={startUpload}>
                <Save size={16} />
                <span>Start Upload</span>
              </button>
            </div>
          </div>
        </div>

        {/* ThumbnailPicker opens on top of upload modal */}
        {showThumbPicker && selectedFile && (
          <ThumbnailPicker
            videoFile={selectedFile}
            onCapture={(blob) => {
              // Convert blob → File so UploadContext can upload it to S3
              const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
              setThumbnailFile(file);
            }}
            onClose={() => setShowThumbPicker(false)}
          />
        )}
        </>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────────────── */}
      {editingVideo && (
        <EditVideoModal
          video={editingVideo}
          categories={categories}
          courses={courses}
          onClose={() => setEditingVideo(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      {deletingVideo && (
        <DeleteConfirmModal
          video={deletingVideo}
          onClose={() => setDeletingVideo(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── Security Settings ─────────────────────────────────────────────────── */}
      {securityVideo && (
        <SecurityModal
          video={securityVideo}
          onClose={() => setSecurityVideo(null)}
          onSaved={handleSecuritySaved}
        />
      )}
    </div>
  );
};

export default Videos;