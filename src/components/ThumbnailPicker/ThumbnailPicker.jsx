/**
 * ThumbnailPicker.jsx
 *
 * Opens a modal with the selected video loaded.
 * Scrub the timeline, then click "Capture Frame" to grab that frame as a JPEG blob.
 * Calls onCapture(blob) when the user confirms.
 *
 * Props:
 *   videoFile   — File object (local video file)
 *   videoUrl    — existing remote URL (for edit modal when no new file chosen)
 *   onCapture   — (blob: Blob) => void   called with the captured JPEG blob
 *   onClose     — () => void
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Check } from 'lucide-react';
import './ThumbnailPicker.css';

const ThumbnailPicker = ({ videoFile, videoUrl, onCapture, onClose }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const blobUrlRef = useRef(null);

  const [duration, setDuration]     = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [captured, setCaptured]     = useState(null); // ObjectURL of captured frame
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [ready, setReady]           = useState(false);

  // Create a blob URL from the local file so the <video> can seek freely
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (videoFile) {
      blobUrlRef.current = URL.createObjectURL(videoFile);
      v.src = blobUrlRef.current;
    } else if (videoUrl) {
      v.src = videoUrl;
      v.crossOrigin = 'anonymous';
    }

    v.load();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (captured) URL.revokeObjectURL(captured);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFile, videoUrl]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    setDuration(v.duration || 0);
    setReady(true);
    // Jump to 10% as a starting frame
    v.currentTime = (v.duration || 0) * 0.1;
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    const t = parseFloat(e.target.value);
    if (v) {
      v.currentTime = t;
      setCurrentTime(t);
    }
  };

  // Capture the current frame via canvas
  const captureFrame = useCallback(() => {
    const v   = videoRef.current;
    const cvs = canvasRef.current;
    if (!v || !cvs) return;

    cvs.width  = v.videoWidth  || 1280;
    cvs.height = v.videoHeight || 720;

    const ctx = cvs.getContext('2d');
    ctx.drawImage(v, 0, 0, cvs.width, cvs.height);

    cvs.toBlob((blob) => {
      if (!blob) return;
      if (captured) URL.revokeObjectURL(captured);
      const url = URL.createObjectURL(blob);
      setCaptured(url);
      setCapturedBlob(blob);
    }, 'image/jpeg', 0.92);
  }, [captured]);

  const handleConfirm = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
    onClose();
  };

  const fmt = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="tp-backdrop" onClick={onClose}>
      <div className="tp-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="tp-header">
          <div className="tp-header-left">
            <Camera size={18} />
            <span>Pick Thumbnail from Video</span>
          </div>
          <button className="tp-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="tp-body">
          {/* Hidden video + canvas */}
          <video
            ref={videoRef}
            className="tp-video"
            playsInline
            muted
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={handleTimeUpdate}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!ready && (
            <div className="tp-loading">
              <div className="tp-spinner" />
              <span>Loading video…</span>
            </div>
          )}

          {ready && (
            <>
              {/* Preview: video still on left, captured frame on right */}
              <div className="tp-previews">
                <div className="tp-preview-box">
                  <span className="tp-preview-label">Current Frame</span>
                  {/* We use a canvas snapshot of the current seek position */}
                  <FramePreview videoRef={videoRef} trigger={currentTime} />
                </div>

                <div className="tp-preview-box">
                  <span className="tp-preview-label">Captured Thumbnail</span>
                  {captured
                    ? <img src={captured} alt="Captured thumbnail" className="tp-preview-img" />
                    : <div className="tp-preview-empty">
                        <Camera size={28} />
                        <span>No frame captured yet</span>
                      </div>
                  }
                </div>
              </div>

              {/* Scrubber */}
              <div className="tp-scrubber">
                <span className="tp-time">{fmt(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={currentTime}
                  onChange={handleSeek}
                  className="tp-range"
                  style={{ '--pct': `${progress}%` }}
                />
                <span className="tp-time">{fmt(duration)}</span>
              </div>

              <p className="tp-hint">Drag the scrubber to the frame you want, then click <strong>Capture Frame</strong>.</p>

              {/* Capture button */}
              <button className="tp-capture-btn" onClick={captureFrame}>
                <Camera size={16} />
                <span>Capture Frame</span>
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="tp-footer">
          <button className="tp-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="tp-btn-primary"
            onClick={handleConfirm}
            disabled={!capturedBlob}
          >
            <Check size={15} />
            <span>Use This Thumbnail</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Live frame preview — draws current video frame into a canvas every seek ──
const FramePreview = ({ videoRef, trigger }) => {
  const cvs = useRef(null);

  useEffect(() => {
    const v   = videoRef.current;
    const c   = cvs.current;
    if (!v || !c) return;

    const draw = () => {
      c.width  = v.videoWidth  || 320;
      c.height = v.videoHeight || 180;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    };

    // Wait one tick so the video element has seeked
    const id = setTimeout(draw, 60);
    return () => clearTimeout(id);
  }, [trigger, videoRef]);

  return <canvas ref={cvs} className="tp-preview-img" />;
};

export default ThumbnailPicker;
