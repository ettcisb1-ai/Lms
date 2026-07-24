/**
 * UploadContext — supports concurrent uploads.
 *
 * Architecture:
 *  - "jobs" array: each running/completed/failed upload is an independent job
 *  - "form" state: the current upload form fields (title, file, etc.)
 *  - Starting an upload snapshots the form into a new job, clears the form,
 *    and runs the job in the background — the form is immediately free to use again.
 *  - The floating UploadWidget shows all active/recent jobs.
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { VIDEO_ENDPOINTS, UPLOAD_ENDPOINT } from '../utils/api';

const UploadContext = createContext(null);
export const useUpload = () => useContext(UploadContext);

let jobCounter = 0;
const newId = () => `job-${++jobCounter}-${Date.now()}`;

// job shape:
// { id, title, fileName, progress: 0-100, status: 'uploading'|'done'|'error', error: string|null }

export const UploadProvider = ({ children }) => {
  // ── Form state (the open modal) ────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [newVideoTitle, setNewVideoTitle]     = useState('');
  const [selectedFile, setSelectedFile]       = useState(null);
  const [thumbnailFile, setThumbnailFile]     = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCourse, setSelectedCourse]   = useState('');

  // ── Jobs list (background uploads) ────────────────────────────────────────
  const [jobs, setJobs] = useState([]); // array of job objects

  // per-job success callback ref map
  const onSuccessRefs = useRef({});

  // ── Open / close modal ─────────────────────────────────────────────────────
  const openUploadModal = useCallback((onSuccess) => {
    // store callback by a temp key; replaced when job starts
    onSuccessRefs.current['_pending'] = onSuccess || null;
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setNewVideoTitle('');
    setSelectedFile(null);
    setThumbnailFile(null);
    setSelectedCategory('');
    setSelectedCourse('');
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getVideoDuration = (file) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const s = vid.duration;
        if (!s || !isFinite(s)) { resolve('0:00'); return; }
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
        resolve(h > 0
          ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
          : `${m}:${String(sec).padStart(2,'0')}`);
      };
      vid.onerror = () => { URL.revokeObjectURL(url); resolve('0:00'); };
      vid.src = url;
    });

  const uploadFileToS3 = async (file, token, onProgress) => {
    const base = UPLOAD_ENDPOINT.endsWith('/upload')
      ? UPLOAD_ENDPOINT.replace(/\/upload$/, '/upload/s3-signature')
      : `${UPLOAD_ENDPOINT}/s3-signature`;

    const isImage = file.type.startsWith('image/');
    const folder  = isImage ? 'lms-thumbnails' : 'lms-videos';

    const sigRes = await fetch(
      `${base}?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&folder=${folder}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sigData = await sigRes.json();
    if (!sigRes.ok || !sigData.success) throw new Error(sigData.message || 'Failed to get S3 URL');

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sigData.presignedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error('S3 network error'));
      xhr.send(file);
    });

    return sigData.publicUrl;
  };

  // ── Update a single job field ──────────────────────────────────────────────
  const patchJob = (id, patch) =>
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));

  // ── Dismiss a completed/failed job from the widget ─────────────────────────
  const dismissJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    delete onSuccessRefs.current[id];
  }, []);

  // ── Start upload — snapshots form, clears form, runs in background ─────────
  const startUpload = useCallback(async () => {
    if (!newVideoTitle.trim()) { alert('Please enter a video title.'); return; }
    if (!selectedCategory)     { alert('Please select a category.');   return; }
    if (!selectedCourse)       { alert('Please select a course.');     return; }
    if (!selectedFile)         { alert('Please select a video file.'); return; }

    // Snapshot the form
    const jobId        = newId();
    const snapTitle    = newVideoTitle.trim();
    const snapFile     = selectedFile;
    const snapThumb    = thumbnailFile;
    const snapCat      = selectedCategory;
    const snapCourse   = selectedCourse;
    const snapSuccess  = onSuccessRefs.current['_pending'] || null;
    onSuccessRefs.current[jobId] = snapSuccess;
    delete onSuccessRefs.current['_pending'];

    // Add job to list
    setJobs(prev => [...prev, {
      id: jobId,
      title: snapTitle,
      fileName: snapFile.name,
      progress: 0,
      status: 'uploading',
      error: null,
    }]);

    // Clear the form immediately so a new upload can start
    setNewVideoTitle('');
    setSelectedFile(null);
    setThumbnailFile(null);
    setSelectedCategory('');
    setSelectedCourse('');
    setIsModalOpen(false);  // close modal — user can re-open for next upload

    // ── Run upload in background ─────────────────────────────────────────────
    const formatBytes = (b) => {
      if (!b) return 'Unknown size';
      return b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${(b / 1048576).toFixed(1)} MB`;
    };

    const token = localStorage.getItem('lms_token');

    try {
      // 1. Duration
      const duration = await getVideoDuration(snapFile);
      patchJob(jobId, { progress: 5 });

      // 2. Thumbnail (0→15%)
      let thumbnailUrl = '';
      if (snapThumb) {
        thumbnailUrl = await uploadFileToS3(snapThumb, token, (pct) =>
          patchJob(jobId, { progress: Math.round(pct * 0.1) + 5 })
        );
      }
      patchJob(jobId, { progress: 15 });

      // 3. Get presigned URL for video
      const base = UPLOAD_ENDPOINT.endsWith('/upload')
        ? UPLOAD_ENDPOINT.replace(/\/upload$/, '/upload/s3-signature')
        : `${UPLOAD_ENDPOINT}/s3-signature`;

      const sigRes  = await fetch(
        `${base}?fileName=${encodeURIComponent(snapFile.name)}&contentType=${encodeURIComponent(snapFile.type)}&folder=lms-videos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sigData = await sigRes.json();
      if (!sigRes.ok || !sigData.success) throw new Error(sigData.message || 'Failed to get S3 URL');
      patchJob(jobId, { progress: 18 });

      // 4. Upload video (18→90%)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sigData.presignedUrl, true);
        xhr.setRequestHeader('Content-Type', snapFile.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            patchJob(jobId, { progress: Math.round((e.loaded / e.total) * 72) + 18 });
        };
        xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error('S3 network error'));
        xhr.send(snapFile);
      });
      patchJob(jobId, { progress: 92 });

      // 5. Save to DB
      const createRes = await fetch(VIDEO_ENDPOINTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title:     snapTitle,
          videoUrl:  sigData.publicUrl,
          thumbnail: thumbnailUrl,
          category:  snapCat,
          course:    snapCourse,
          size:      formatBytes(snapFile.size),
          duration,
          status:    'Published',
        }),
      });
      const createResult = await createRes.json();
      if (!createRes.ok) throw new Error(createResult.message || 'Saving video failed.');

      patchJob(jobId, { progress: 100, status: 'done' });

      // Fire success callback (refreshes video list) — do NOT re-open the modal
      if (onSuccessRefs.current[jobId]) onSuccessRefs.current[jobId]();

      // Auto-dismiss completed job after 6 s
      setTimeout(() => dismissJob(jobId), 6000);

    } catch (err) {
      console.error(`[Upload ${jobId}] error:`, err);
      patchJob(jobId, { status: 'error', error: err.message || 'Upload failed.' });
    }
  }, [newVideoTitle, selectedCategory, selectedCourse, selectedFile, thumbnailFile, dismissJob]);

  const value = {
    // modal
    isModalOpen, setIsModalOpen,
    openUploadModal,
    closeModal,
    // form fields
    newVideoTitle, setNewVideoTitle,
    selectedFile,  setSelectedFile,
    thumbnailFile, setThumbnailFile,
    selectedCategory, setSelectedCategory,
    selectedCourse,   setSelectedCourse,
    // jobs
    jobs,
    dismissJob,
    startUpload,

    // ── Legacy aliases so Videos.jsx doesn't need changes ──
    isUploadModalOpen: isModalOpen,
    setIsUploadModalOpen: setIsModalOpen,
    isMinimized: false,          // no longer needed — jobs are always in the widget
    setIsMinimized: () => {},
    uploading: jobs.some(j => j.status === 'uploading'),
    uploadProgress: (() => {
      const active = jobs.filter(j => j.status === 'uploading');
      return active.length ? active[active.length - 1].progress : 0;
    })(),
    resetUpload: closeModal,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};
