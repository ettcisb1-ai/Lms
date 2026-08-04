import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, GripVertical, Video, Search, Trash2, Edit2, PlayCircle, X, Save, UploadCloud, Film, Loader } from 'lucide-react';
import './CourseBuilder.css';
import { COURSE_ENDPOINTS, VIDEO_ENDPOINTS, UPLOAD_ENDPOINT, CATEGORY_ENDPOINTS, fetchSecureStreamUrl, formatStoredDuration } from '../../utils/api';

const CourseBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const playerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('curriculum');
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Assign Video Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // { moduleId, lectureIdx }
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Upload Video Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Video Player State ──────────────────────────────────────────────────────
  const [activePlayingVideo, setActivePlayingVideo] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [isStreamLoading, setIsStreamLoading] = useState(false);

  const playVideo = async (lecture, moduleTitle = '') => {
    let vidId = null;
    let fallbackUrl = lecture.url || '';
    let vidTitle = lecture.title || 'Video Lecture';
    let vidDuration = lecture.duration || '0:00';

    if (lecture.video) {
      if (typeof lecture.video === 'object' && lecture.video !== null) {
        vidId = lecture.video._id ? lecture.video._id.toString() : null;
        fallbackUrl = lecture.video.videoUrl || fallbackUrl;
        vidTitle = lecture.video.title || vidTitle;
        vidDuration = lecture.video.duration || vidDuration;
      } else if (typeof lecture.video === 'string') {
        vidId = lecture.video;
        const foundInLib = videoLibrary.find(v => v._id === vidId || v.id === vidId);
        if (foundInLib) {
          fallbackUrl = foundInLib.videoUrl || fallbackUrl;
          vidTitle = foundInLib.title || vidTitle;
          vidDuration = foundInLib.duration || vidDuration;
        }
      }
    }

    setActivePlayingVideo({
      id: vidId,
      title: vidTitle,
      duration: vidDuration,
      moduleTitle
    });

    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setIsStreamLoading(true);
    setStreamUrl('');

    const token = localStorage.getItem('lms_token');
    if (vidId) {
      try {
        const streamData = await fetchSecureStreamUrl(vidId, token);
        if (streamData && streamData.streamUrl) {
          setStreamUrl(streamData.streamUrl);
          setIsStreamLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Stream token fetch error, fallback to direct url:', err);
      }
    }

    setStreamUrl(fallbackUrl);
    setIsStreamLoading(false);
  };

  const fetchData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('lms_token');
    try {
      // 1. Fetch Course details
      const courseResponse = await fetch(COURSE_ENDPOINTS.GET(id));
      const courseResult = await courseResponse.json();
      if (courseResult.success) {
        setCourse(courseResult.data);
        setModules(courseResult.data.modules || []);
        // Pre-fill upload modal course
        setUploadCourse(courseResult.data._id);
        // Pre-fill category from course
        const courseCatId = courseResult.data.category?._id || courseResult.data.category;
        if (courseCatId) setUploadCategory(courseCatId);
      }

      // 2. Fetch Video Library
      const videoResponse = await fetch(VIDEO_ENDPOINTS.LIST, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const videoResult = await videoResponse.json();
      if (videoResult.success) {
        setVideoLibrary(videoResult.data);
      }

      // 3. Fetch Categories
      const catResponse = await fetch(CATEGORY_ENDPOINTS.LIST);
      const catResult = await catResponse.json();
      if (catResult.success) {
        setCategories(catResult.data);
      }
    } catch (err) {
      console.error('Fetch course/videos error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (activePlayingVideo || isLoading) return;
    const vList = [];
    const keys = new Set();
    (modules || []).forEach(m => {
      (m.lectures || []).forEach(l => {
        if (l.video || l.url) {
          const key = (typeof l.video === 'object' ? l.video?._id : l.video) || l.url;
          if (key && !keys.has(key)) {
            keys.add(key);
            vList.push({ lecture: l, moduleTitle: m.title });
          }
        }
      });
    });
    if (vList.length > 0) {
      playVideo(vList[0].lecture, vList[0].moduleTitle);
    }
  }, [modules, videoLibrary, isLoading]);

  const handleSaveCurriculum = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('lms_token');
    try {
      const response = await fetch(COURSE_ENDPOINTS.UPDATE(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ modules })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to save curriculum.');

      if (result.success) {
        alert('Curriculum saved successfully!');
        setCourse(result.data);
      }
    } catch (err) {
      console.error('Save curriculum error:', err);
      alert(err.message || 'Failed to save curriculum.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddModule = () => {
    const newModule = {
      id: `new-${Date.now()}`,
      title: 'New Module',
      lectures: []
    };
    setModules([...modules, newModule]);
  };

  const handleEditModuleTitle = (moduleId, currentTitle) => {
    const newTitle = prompt('Enter new module title:', currentTitle);
    if (newTitle === null || !newTitle.trim()) return;
    const nextModules = modules.map(m => {
      if (m._id === moduleId || m.id === moduleId) {
        return { ...m, title: newTitle };
      }
      return m;
    });
    setModules(nextModules);
  };

  const handleDeleteModule = (moduleId) => {
    if (!window.confirm('Are you sure you want to delete this module and all its lectures?')) return;
    setModules(modules.filter(m => (m._id !== moduleId && m.id !== moduleId)));
  };

  const handleAddLecture = (moduleId) => {
    const nextModules = modules.map(m => {
      if (m._id === moduleId || m.id === moduleId) {
        return {
          ...m,
          lectures: [...m.lectures, {
            title: 'New Video Lecture',
            duration: '0:00',
            url: '',
            video: null
          }]
        };
      }
      return m;
    });
    setModules(nextModules);
  };

  const handleEditLectureTitle = (moduleId, lectureIdx, currentTitle) => {
    const newTitle = prompt('Enter new lecture title:', currentTitle);
    if (newTitle === null || !newTitle.trim()) return;
    const nextModules = modules.map(m => {
      if (m._id === moduleId || m.id === moduleId) {
        const nextLectures = m.lectures.map((l, idx) => {
          if (idx === lectureIdx) {
            return { ...l, title: newTitle };
          }
          return l;
        });
        return { ...m, lectures: nextLectures };
      }
      return m;
    });
    setModules(nextModules);
  };

  const handleDeleteLecture = (moduleId, lectureIdx) => {
    if (!window.confirm('Are you sure you want to delete this lecture?')) return;
    const nextModules = modules.map(m => {
      if (m._id === moduleId || m.id === moduleId) {
        const nextLectures = m.lectures.filter((_, idx) => idx !== lectureIdx);
        return { ...m, lectures: nextLectures };
      }
      return m;
    });
    setModules(nextModules);
  };

  const handleOpenAssignModal = (moduleId, lectureIdx) => {
    setAssignTarget({ moduleId, lectureIdx });
    setIsAssignModalOpen(true);
  };

  const handleSelectVideoForLecture = (videoItem) => {
    if (!assignTarget) return;
    const { moduleId, lectureIdx } = assignTarget;

    const nextModules = modules.map(m => {
      if (m._id === moduleId || m.id === moduleId) {
        const nextLectures = m.lectures.map((l, idx) => {
          if (idx === lectureIdx) {
            return {
              ...l,
              title: videoItem.title,
              duration: videoItem.duration,
              url: videoItem.videoUrl,
              video: videoItem._id
            };
          }
          return l;
        });
        return { ...m, lectures: nextLectures };
      }
      return m;
    });

    setModules(nextModules);
    setIsAssignModalOpen(false);
    setAssignTarget(null);
  };

  const handleOpenUploadModal = () => {
    setUploadTitle('');
    setUploading(false);
    setUploadProgress(0);
    setIsDragging(false);
    setIsUploadModalOpen(true);
  };

  const handleRealUpload = async (file) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      alert('Video file size must be under 500MB.');
      return;
    }
    if (!uploadTitle.trim()) { alert('Please enter a video title first.'); return; }
    if (!uploadCategory) { alert('Please select a category.'); return; }
    if (!uploadCourse) { alert('Course is not set.'); return; }

    setUploading(true);
    setUploadProgress(5);
    const token = localStorage.getItem('lms_token');

    // ── Read duration from file locally before uploading ──────────────────────
    const getVideoDuration = (f) => new Promise((resolve) => {
      const url = URL.createObjectURL(f);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const secs = vid.duration;
        if (!secs || !isFinite(secs)) { resolve('0:00'); return; }
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) {
          resolve(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        } else {
          resolve(`${m}:${String(s).padStart(2, '0')}`);
        }
      };
      vid.onerror = () => { URL.revokeObjectURL(url); resolve('0:00'); };
      vid.src = url;
    });

    try {
      // 1. Get presigned S3 PUT URL + read duration in parallel
      const s3SigEndpoint = UPLOAD_ENDPOINT.endsWith('/upload')
        ? UPLOAD_ENDPOINT.replace(/\/upload$/, '/upload/s3-signature')
        : `${UPLOAD_ENDPOINT}/s3-signature`;

      const [duration, sigRes] = await Promise.all([
        getVideoDuration(file),
        fetch(
          `${s3SigEndpoint}?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);

      const sigData = await sigRes.json();
      if (!sigRes.ok || !sigData.success) {
        throw new Error(sigData.message || 'Failed to get S3 upload URL from server');
      }

      setUploadProgress(10);

      // 2. PUT file directly to S3
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sigData.presignedUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 78) + 10;
            setUploadProgress(Math.min(percent, 88));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`S3 upload failed (${xhr.status}): ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error('S3 network connection failed.'));
        xhr.send(file);
      });

      setUploadProgress(90);

      const formatBytes = (bytes) => {
        if (!bytes) return 'Unknown size';
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
      };

      // 3. Create Video record in backend
      const createRes = await fetch(VIDEO_ENDPOINTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: uploadTitle,
          videoUrl: sigData.publicUrl,
          thumbnail: '',
          category: uploadCategory,
          course: uploadCourse,
          size: formatBytes(file.size),
          duration,                     // ← real duration read from file
          status: 'Published',
        }),
      });

      setUploadProgress(100);
      const createResult = await createRes.json();
      if (!createRes.ok) throw new Error(createResult.message || 'Saving video details failed.');

      if (createResult.success) {
        setTimeout(() => {
          setUploading(false);
          setIsUploadModalOpen(false);
          setUploadTitle('');
          fetchData();
        }, 800);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert(err.message || 'Failed to upload video.');
      setUploading(false);
    }
  };

  const filteredModalVideos = videoLibrary.filter(v =>
    v.title.toLowerCase().includes(modalSearchTerm.toLowerCase())
  );

  // Derive all videos belonging to this course
  const allCourseVideos = [];
  const seenVideoKeys = new Set();

  modules.forEach((mod) => {
    (mod.lectures || []).forEach((lec, idx) => {
      let vidId = null;
      let vidUrl = lec.url || '';
      let vidTitle = lec.title;
      let vidDuration = lec.duration;

      if (lec.video) {
        if (typeof lec.video === 'object' && lec.video !== null) {
          vidId = lec.video._id ? lec.video._id.toString() : null;
          vidUrl = lec.video.videoUrl || vidUrl;
          vidTitle = lec.video.title || vidTitle;
          vidDuration = lec.video.duration || vidDuration;
        } else if (typeof lec.video === 'string') {
          vidId = lec.video;
          const found = videoLibrary.find(v => v._id === vidId);
          if (found) {
            vidUrl = found.videoUrl || vidUrl;
            vidTitle = found.title || vidTitle;
            vidDuration = found.duration || vidDuration;
          }
        }
      }

      if (vidId || vidUrl) {
        const key = vidId || vidUrl || `lec-${idx}`;
        if (!seenVideoKeys.has(key)) {
          seenVideoKeys.add(key);
          allCourseVideos.push({
            lecture: lec,
            moduleTitle: mod.title,
            vidId,
            vidUrl,
            vidTitle,
            vidDuration
          });
        }
      }
    });
  });

  videoLibrary.forEach(v => {
    const vCourseId = v.course?._id || v.course;
    if (vCourseId === id || vCourseId?.toString() === id?.toString()) {
      if (v._id && !seenVideoKeys.has(v._id.toString())) {
        seenVideoKeys.add(v._id.toString());
        allCourseVideos.push({
          lecture: { title: v.title, duration: v.duration, video: v._id, url: v.videoUrl },
          moduleTitle: 'Library Video',
          vidId: v._id,
          vidUrl: v.videoUrl,
          vidTitle: v.title,
          vidDuration: v.duration
        });
      }
    }
  });

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Loading curriculum builder...</div>;
  }

  return (
    <div className="course-builder-page">
      <div className="builder-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/admin/courses')}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="page-title">Course Details: {course?.title}</h2>
            <p className="page-subtitle">View video lectures and manage course curriculum structure</p>
          </div>
        </div>
        <div className="header-right-buttons" style={{ display: 'flex', gap: '12px' }}>
          <div className="header-tabs">
            <button className={`tab-btn ${activeTab === 'curriculum' ? 'active' : ''}`} onClick={() => setActiveTab('curriculum')}>
              <Video size={16} /> Curriculum & Videos
            </button>
          </div>
          <button className="btn-secondary" onClick={handleOpenUploadModal}>
            <UploadCloud size={16} />
            <span>Upload Video</span>
          </button>
          <button className="btn-primary" onClick={handleSaveCurriculum} disabled={isSaving}>
            {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
            <span>{isSaving ? 'Saving...' : 'Save Curriculum'}</span>
          </button>
        </div>
      </div>

      {/* ── Video Player & Details Section ── */}
      <div ref={playerRef} className="course-video-showcase" style={{ background: '#0f172a', borderRadius: '16px', padding: '24px', color: 'white', marginBottom: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Film size={22} style={{ color: '#38bdf8' }} />
              Course Video Player
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Watch and preview video lectures for {course?.title || 'this course'}
            </p>
          </div>
          {allCourseVideos.length > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 600, background: '#1e293b', color: '#38bdf8', padding: '6px 12px', borderRadius: '20px', border: '1px solid #334155' }}>
              {allCourseVideos.length} Video{allCourseVideos.length === 1 ? '' : 's'} Available
            </span>
          )}
        </div>

        {/* Video Player Display */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: '480px', background: '#000000', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1e293b' }}>
          {isStreamLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
              <Loader size={36} className="spin-icon" style={{ color: '#38bdf8' }} />
              <span>Loading video stream...</span>
            </div>
          ) : streamUrl ? (
            <video
              key={streamUrl}
              src={streamUrl}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <Film size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '15px', color: '#94a3b8' }}>
                {allCourseVideos.length === 0 ? 'No video lectures added yet. Click "Upload Video" or "Assign Video" below to add content.' : 'Select a lecture below to play the video.'}
              </p>
            </div>
          )}
        </div>

        {/* Active Playing Video Title */}
        {activePlayingVideo && (
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                {activePlayingVideo.title}
              </h4>
              {activePlayingVideo.moduleTitle && (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Module: {activePlayingVideo.moduleTitle} • Duration: {formatStoredDuration(activePlayingVideo.duration)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick Playlist Chips */}
        {allCourseVideos.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '12px' }}>
              Select Video to Play ({allCourseVideos.length})
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
              {allCourseVideos.map((item, index) => {
                const isActive = activePlayingVideo && (activePlayingVideo.title === item.vidTitle || activePlayingVideo.id === item.vidId);
                return (
                  <button
                    key={index}
                    onClick={() => playVideo(item.lecture, item.moduleTitle)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: isActive ? '#0284c7' : '#1e293b',
                      color: isActive ? '#ffffff' : '#cbd5e1',
                      border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                  >
                    <PlayCircle size={15} style={{ color: isActive ? '#ffffff' : '#38bdf8' }} />
                    <span>{item.vidTitle}</span>
                    <span style={{ fontSize: '11px', opacity: 0.75 }}>({formatStoredDuration(item.vidDuration)})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="builder-content">
        {activeTab === 'curriculum' && (
          <div className="curriculum-tab">
            <div className="tab-toolbar">
              <h3>Course Modules ({modules.length})</h3>
              <button className="btn-primary" onClick={handleAddModule}>
                <Plus size={16} /> Add Module
              </button>
            </div>

            <div className="modules-list">
              {modules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                  No modules created yet. Click "Add Module" to start structuring your course curriculum!
                </div>
              ) : (
                modules.map((mod, index) => (
                  <div key={mod._id || mod.id} className="module-card">
                    <div className="module-header">
                      <div className="module-drag-handle"><GripVertical size={20} /></div>
                      <h4 className="module-title">{mod.title}</h4>
                      <div className="module-actions">
                        <button className="icon-btn" title="Edit Module Title" onClick={() => handleEditModuleTitle(mod._id || mod.id, mod.title)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn delete" title="Delete Module" onClick={() => handleDeleteModule(mod._id || mod.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="lectures-list">
                      {mod.lectures.map((lecture, lIndex) => (
                        <div key={lIndex} className="lecture-item">
                          <div className="lecture-drag-handle"><GripVertical size={16} /></div>
                          <PlayCircle size={16} className="lecture-icon" />
                          <span className="lecture-title">{lecture.title}</span>
                          <span className="lecture-duration">{formatStoredDuration(lecture.duration)}</span>
                          {lecture.video || lecture.url ? (
                            <button
                              onClick={() => playVideo(lecture, mod.title)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginRight: '8px'
                              }}
                            >
                              <PlayCircle size={14} /> Watch Video
                            </button>
                          ) : (
                            <span className="video-linked-tag" style={{ fontSize: '11px', color: '#ef4444', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, marginRight: '8px' }}>No Video</span>
                          )}
                          <button
                            className="btn-text"
                            style={{ fontSize: '12px', marginRight: '8px', color: 'var(--primary-color)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => handleOpenAssignModal(mod._id || mod.id, lIndex)}
                          >
                            Assign Video
                          </button>
                          <div className="lecture-actions">
                            <button className="icon-btn" title="Edit Title" onClick={() => handleEditLectureTitle(mod._id || mod.id, lIndex, lecture.title)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="icon-btn delete" title="Delete Lecture" onClick={() => handleDeleteLecture(mod._id || mod.id, lIndex)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button className="add-lecture-btn" onClick={() => handleAddLecture(mod._id || mod.id)}>
                        <Plus size={14} /> Add Lecture
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Video Modal */}
      {isAssignModalOpen && (() => {
        const courseVideos = filteredModalVideos.filter(v => {
          const vCourseId = v.course?._id || v.course;
          return vCourseId === id;
        });
        const otherVideos = filteredModalVideos.filter(v => {
          const vCourseId = v.course?._id || v.course;
          return vCourseId !== id;
        });
        return (
          <div className="upload-modal-backdrop" style={{ zIndex: 1000 }}>
            <div className="upload-modal" style={{ maxWidth: '600px', width: '90%' }}>
              <div className="modal-header">
                <h3>Select Video from Library</h3>
                <button className="icon-btn close-btn" onClick={() => setIsAssignModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search uploaded videos..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div className="modal-videos-list" style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredModalVideos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No videos match your search or library is empty.
                    </div>
                  ) : (
                    <>
                      {courseVideos.length > 0 && (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>
                            This Course ({courseVideos.length})
                          </div>
                          {courseVideos.map(video => (
                            <div
                              key={video._id}
                              onClick={() => handleSelectVideoForLecture(video)}
                              style={{ padding: '12px', border: '1px solid var(--primary-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.2s ease', backgroundColor: '#fafeff' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fafeff'}
                            >
                              <div>
                                <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>{video.title}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Size: {video.size} | Duration: {formatStoredDuration(video.duration)}</span>
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-color)' }}>Select</span>
                            </div>
                          ))}
                        </>
                      )}
                      {otherVideos.length > 0 && (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0', marginTop: courseVideos.length > 0 ? '8px' : 0 }}>
                            Other Videos ({otherVideos.length})
                          </div>
                          {otherVideos.map(video => (
                            <div
                              key={video._id}
                              onClick={() => handleSelectVideoForLecture(video)}
                              style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.2s ease' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div>
                                <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>{video.title}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Size: {video.size} | Duration: {formatStoredDuration(video.duration)}</span>
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-color)' }}>Select</span>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Upload Video Modal */}
      {isUploadModalOpen && (
        <div className="upload-modal-backdrop" style={{ zIndex: 1001 }}>
          <div className="upload-modal" style={{ maxWidth: '560px', width: '90%' }}>
            <div className="modal-header">
              <h3>Upload Video to Course</h3>
              <button className="icon-btn close-btn" onClick={() => { setIsUploadModalOpen(false); setUploadTitle(''); setUploading(false); }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Video Title <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Introduction to React Hooks"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Category <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  disabled={uploading}
                >
                  <option value="">Select a Category</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Course</label>
                <input
                  type="text"
                  value={course?.title || 'Loading...'}
                  disabled
                  style={{ backgroundColor: '#f8fafc', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                />
              </div>

              <div
                className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleRealUpload(e.dataTransfer.files[0]); }}
              >
                {!uploading ? (
                  <div className="upload-content">
                    <div className="upload-icon-wrapper">
                      <UploadCloud size={32} className="upload-icon" />
                    </div>
                    <h4>Drag & drop video files here</h4>
                    <p>Supports MP4, WebM, MOV up to 20MB.</p>
                    <label className="btn-outline" style={{ marginTop: '12px', display: 'inline-block', cursor: 'pointer' }}>
                      Browse Files
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleRealUpload(e.target.files[0])}
                        style={{ display: 'none' }}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="upload-progress-content">
                    <Film size={32} className="processing-icon" />
                    <h4>{uploadProgress < 100 ? 'Uploading and Saving...' : 'Upload Complete!'}</h4>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p>{uploadProgress}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setIsUploadModalOpen(false); setUploadTitle(''); setUploading(false); }} disabled={uploading}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseBuilder;



