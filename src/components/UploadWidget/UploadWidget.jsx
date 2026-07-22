import React from 'react';
import { Check, Loader, X } from 'lucide-react';
import { useUpload } from '../../context/UploadContext';
import './UploadWidget.css';

/**
 * Global floating upload widget.
 * Rendered once in App.jsx — never unmounts during navigation.
 * Visible only when an upload is in progress AND the modal is minimized.
 */
const UploadWidget = () => {
  const {
    uploading,
    isMinimized,
    setIsMinimized,
    setIsUploadModalOpen,
    uploadProgress,
    selectedFile,
    newVideoTitle,
    resetUpload,
  } = useUpload();

  if (!uploading || !isMinimized) return null;

  const displayName = selectedFile?.name || newVideoTitle || 'video';
  const isDone = uploadProgress >= 100;

  const handleExpand = () => {
    setIsMinimized(false);
    setIsUploadModalOpen(true);
  };

  return (
    <div
      className={`upload-mini-widget${isDone ? ' complete' : ''}`}
      onClick={handleExpand}
      title="Click to expand"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
    >
      {/* Left: icon + text */}
      <div className="mini-widget-left">
        {isDone
          ? <Check size={16} className="mini-check" />
          : <Loader size={16} className="spin-icon mini-spin" />
        }
        <div className="mini-widget-text">
          <span className="mini-title">
            {isDone ? 'Upload Complete!' : 'Uploading…'}
          </span>
          <span className="mini-filename">{displayName}</span>
        </div>
      </div>

      {/* Right: ring + close */}
      <div className="mini-widget-right">
        <div className="mini-progress-ring">
          <svg viewBox="0 0 36 36" className="mini-ring-svg">
            <circle cx="18" cy="18" r="15.9"
              fill="none" stroke="#e2e8f0" strokeWidth="3.2" />
            <circle cx="18" cy="18" r="15.9"
              fill="none"
              stroke={isDone ? '#10b981' : 'var(--primary-color, #e74c3c)'}
              strokeWidth="3.2"
              strokeDasharray={`${uploadProgress} 100`}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
          <span className="mini-pct">{uploadProgress}%</span>
        </div>

        <button
          className="mini-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (isDone) resetUpload();
            // while uploading the X is disabled — user must wait or expand
          }}
          disabled={!isDone}
          title={isDone ? 'Dismiss' : 'Upload in progress — please wait'}
          aria-label="Dismiss upload"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default UploadWidget;
