import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { VIDEO_ENDPOINTS, UPLOAD_ENDPOINT } from '../utils/api';

const UploadContext = createContext(null);

export const useUpload = () => useContext(UploadContext);

export const UploadProvider = ({ children }) => {
  // ── state visible to any consumer ──────────────────────────────────────────
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMinimized, setIsMinimized]             = useState(false);
  const [uploading, setUploading]                 = useState(false);
  const [uploadProgress, setUploadProgress]       = useState(0);
  const [selectedFile, setSelectedFile]           = useState(null);
  const [thumbnailFile, setThumbnailFile]         = useState(null);   // ← NEW
  const [newVideoTitle, setNewVideoTitle]         = useState('');
  const [selectedCategory, setSelectedCategory]   = useState('');
  const [selectedCourse, setSelectedCourse]       = useState('');

  // callback fired after a successful upload so Videos page can refresh
  const onSuccessRef = useRef(null);

  // XHR ref — keeps the active XHR alive even when Videos unmounts
  const xhrRef = useRef(null);

  // ── reset everything ────────────────────────────────────────────────────────
  const resetUpload = useCallback(() => {
    setIsUploadModalOpen(false);
    setIsMinimized(false);
    setUploading(false);
    setUploadProgress(0);
    setSelectedFile(null);
    setThumbnailFile(null);
    setNewVideoTitle('');
    setSelectedCategory('');
    setSelectedCourse('');
    onSuccessRef.current = null;
    xhrRef.current = null;
  }, []);

  // ── open the modal (called from Videos page) ────────────────────────────────
  const openUploadModal = useCallback((onSuccess) => {
    onSuccessRef.current = onSuccess || null;
    setIsUploadModalOpen(true);
    setIsMinimized(false);
  }, []);

  // ── read video duration locally ─────────────────────────────────────────────
  const getVideoDuration = (file) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const secs = vid.duration;
        if (!secs || !isFinite(secs)) { resolve('0:00'); return; }
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        resolve(h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${m}:${String(s).padStart(2, '0')}`
        );
      };
      vid.onerror = () => { URL.revokeObjectURL(url); resolve('0:00'); };
      vid.src = url;
    });

  // ── upload a file (video or image) to S3 via presigned URL ─────────────────
  const uploadFileToS3 = async (file, token, onProgress) => {
    const s3SigEndpoint = UPLOAD_ENDPOINT.endsWith('/upload')
      ? UPLOAD_ENDPOINT.replace(/\/upload$/, '/upload/s3-signature')
      : `${UPLOAD_ENDPOINT}/s3-signature`;

    const isImage  = file.type.startsWith('image/');
    const folder   = isImage ? 'lms-thumbnails' : 'lms-videos';

    const sigRes = await fetch(
      `${s3SigEndpoint}?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&folder=${folder}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sigData = await sigRes.json();
    if (!sigRes.ok || !sigData.success)
      throw new Error(sigData.message || 'Failed to get S3 upload URL');

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sigData.presignedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress)
          onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error('S3 network connection failed.'));
      xhr.send(file);
    });

    return sigData.publicUrl;
  };

  // ── main upload function ────────────────────────────────────────────────────
  const startUpload = useCallback(async () => {
    if (!newVideoTitle.trim()) { alert('Please enter a video title.'); return; }
    if (!selectedCategory)     { alert('Please select a category.');   return; }
    if (!selectedCourse)       { alert('Please select a course.');     return; }
    if (!selectedFile)         { alert('Please select a video file.'); return; }

    setUploading(true);
    setUploadProgress(5);
    const token = localStorage.getItem('lms_token');

    const formatBytes = (bytes) => {
      if (!bytes) return 'Unknown size';
      if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    try {
      // Step 1: Get video duration
      const duration = await getVideoDuration(selectedFile);
      setUploadProgress(8);

      // Step 2: Upload thumbnail first (if provided) — quick, usually small
      let thumbnailUrl = '';
      if (thumbnailFile) {
        thumbnailUrl = await uploadFileToS3(thumbnailFile, token, (pct) => {
          setUploadProgress(8 + Math.round(pct * 0.12)); // 8 → 20%
        });
      }
      setUploadProgress(20);

      // Step 3: Get presigned URL for video + upload video to S3
      const s3SigEndpoint = UPLOAD_ENDPOINT.endsWith('/upload')
        ? UPLOAD_ENDPOINT.replace(/\/upload$/, '/upload/s3-signature')
        : `${UPLOAD_ENDPOINT}/s3-signature`;

      const sigRes = await fetch(
        `${s3SigEndpoint}?fileName=${encodeURIComponent(selectedFile.name)}&contentType=${encodeURIComponent(selectedFile.type)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sigData = await sigRes.json();
      if (!sigRes.ok || !sigData.success)
        throw new Error(sigData.message || 'Failed to get S3 upload URL');

      setUploadProgress(22);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('PUT', sigData.presignedUrl, true);
        xhr.setRequestHeader('Content-Type', selectedFile.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 68) + 22;
            setUploadProgress(Math.min(pct, 90));
          }
        };
        xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error('S3 network connection failed.'));
        xhr.send(selectedFile);
      });

      setUploadProgress(92);

      // Step 4: Save video record in MongoDB
      const createRes = await fetch(VIDEO_ENDPOINTS.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title:     newVideoTitle,
          videoUrl:  sigData.publicUrl,
          thumbnail: thumbnailUrl,
          category:  selectedCategory,
          course:    selectedCourse,
          size:      formatBytes(selectedFile.size),
          duration,
          status:    'Published',
        }),
      });

      setUploadProgress(100);
      const createResult = await createRes.json();
      if (!createRes.ok) throw new Error(createResult.message || 'Saving video failed.');

      if (createResult.success) {
        setIsMinimized(false);
        setIsUploadModalOpen(true);
        if (onSuccessRef.current) onSuccessRef.current();
        setTimeout(() => resetUpload(), 1400);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert(err.message || 'Upload failed.');
      setUploading(false);
      setIsMinimized(false);
      setIsUploadModalOpen(true);
    }
  }, [newVideoTitle, selectedCategory, selectedCourse, selectedFile, thumbnailFile, resetUpload]);

  const value = {
    // modal visibility
    isUploadModalOpen, setIsUploadModalOpen,
    isMinimized, setIsMinimized,
    // upload state
    uploading,
    uploadProgress,
    selectedFile, setSelectedFile,
    thumbnailFile, setThumbnailFile,   // ← NEW
    newVideoTitle, setNewVideoTitle,
    selectedCategory, setSelectedCategory,
    selectedCourse, setSelectedCourse,
    // actions
    openUploadModal,
    startUpload,
    resetUpload,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};
