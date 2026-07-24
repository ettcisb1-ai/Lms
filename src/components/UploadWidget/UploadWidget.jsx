/**
 * UploadWidget — merged floating panel for all concurrent uploads.
 *
 * - One panel, collapsible header
 * - Each job shows: title, filename, progress bar, status
 * - Completed jobs show a green "✓ <title> uploaded successfully" line
 * - Failed jobs show a red error line
 * - Panel auto-hides when all jobs are dismissed
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, Check, AlertTriangle, Loader } from 'lucide-react';
import { useUpload } from '../../context/UploadContext';
import './UploadWidget.css';

const UploadWidget = () => {
  const { jobs, dismissJob } = useUpload();
  const [collapsed, setCollapsed] = useState(false);

  if (!jobs.length) return null;

  const activeCount    = jobs.filter(j => j.status === 'uploading').length;
  const completedCount = jobs.filter(j => j.status === 'done').length;
  const errorCount     = jobs.filter(j => j.status === 'error').length;

  const headerLabel = activeCount > 0
    ? `Uploading ${activeCount} video${activeCount > 1 ? 's' : ''}…`
    : completedCount > 0
      ? `${completedCount} upload${completedCount > 1 ? 's' : ''} complete`
      : `${errorCount} upload${errorCount > 1 ? 's' : ''} failed`;

  return (
    <div className="uw-panel">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="uw-header" onClick={() => setCollapsed(c => !c)}>
        <div className="uw-header-left">
          {activeCount > 0
            ? <Loader size={14} className="uw-spin" />
            : completedCount > 0
              ? <Check size={14} className="uw-done-icon" />
              : <AlertTriangle size={14} className="uw-err-icon" />
          }
          <span className="uw-header-label">{headerLabel}</span>
        </div>
        <button
          className="uw-collapse-btn"
          onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Job list ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="uw-body">
          {jobs.map((job) => {
            const isDone  = job.status === 'done';
            const isError = job.status === 'error';
            const pct     = job.progress;

            return (
              <div key={job.id} className={`uw-job${isDone ? ' done' : ''}${isError ? ' errored' : ''}`}>
                {/* Top row: title + dismiss */}
                <div className="uw-job-top">
                  <div className="uw-job-info">
                    {isDone
                      ? <Check size={13} className="uw-job-icon done" />
                      : isError
                        ? <AlertTriangle size={13} className="uw-job-icon err" />
                        : <Loader size={13} className="uw-job-icon spin" />
                    }
                    <div className="uw-job-text">
                      {isDone
                        ? <span className="uw-success-msg">
                            <strong>{job.title}</strong> uploaded successfully
                          </span>
                        : isError
                          ? <span className="uw-error-msg">
                              <strong>{job.title}</strong> — {job.error}
                            </span>
                          : <span className="uw-job-title">{job.title}</span>
                      }
                      {!isDone && !isError && (
                        <span className="uw-job-file">{job.fileName}</span>
                      )}
                    </div>
                  </div>

                  <button
                    className="uw-dismiss"
                    onClick={() => dismissJob(job.id)}
                    disabled={job.status === 'uploading'}
                    title={job.status === 'uploading' ? 'Upload in progress' : 'Dismiss'}
                    aria-label="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Progress bar — only while uploading */}
                {!isDone && !isError && (
                  <div className="uw-progress-wrap">
                    <div className="uw-progress-track">
                      <div className="uw-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="uw-pct">{pct}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UploadWidget;
