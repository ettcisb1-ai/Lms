/**
 * Security Screenshot & Key Detection Module
 *
 * Scope:
 *  - Black overlay fires ONLY when the user is on a course-player page
 *    (/dashboard/courses/:id).  All other pages get silent key-blocking only.
 *  - Copy is intercepted silently (no alert) — avoids breaking form usage.
 *  - Print is fully blacked out via a dynamically injected <style> tag.
 *  - picture-in-picture API is blocked at the document level.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

const isOnPlayerPage = () =>
  /^\/dashboard\/courses\/[^/]+/.test(window.location.pathname);

const blockEvent = (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
};

const overwriteClipboard = () => {
  try {
    navigator.clipboard.writeText(
      'Content protected — screenshots are disabled on this portal.'
    );
  } catch (_) {
    /* clipboard API may be unavailable in some contexts */
  }
};

// ── print blackout style (injected once) ─────────────────────────────────────

const injectPrintStyle = () => {
  if (document.getElementById('lms-print-block-style')) return;
  const style = document.createElement('style');
  style.id = 'lms-print-block-style';
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      body::before {
        content: 'Printing this content is not permitted.';
        visibility: visible !important;
        display: flex !important;
        align-items: center;
        justify-content: center;
        position: fixed;
        inset: 0;
        font-size: 24px;
        font-weight: bold;
        color: #000;
        background: #fff;
      }
    }
  `;
  document.head.appendChild(style);
};

// ── overlay (only shown on player pages) ─────────────────────────────────────

const createOverlay = () => {
  let el = document.getElementById('security-black-overlay');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'security-black-overlay';
  Object.assign(el.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000000',
    zIndex: '99999999',
    display: 'none',
    pointerEvents: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    color: '#ffffff',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    textAlign: 'center',
    padding: '30px',
    boxSizing: 'border-box',
  });

  const icon = document.createElement('div');
  icon.innerHTML = '🛡️';
  icon.style.cssText = 'font-size:52px;margin-bottom:18px';
  el.appendChild(icon);

  const title = document.createElement('div');
  title.innerText = 'Content Protected';
  title.style.cssText = 'font-size:22px;font-weight:bold;margin-bottom:10px';
  el.appendChild(title);

  const sub = document.createElement('div');
  sub.innerText =
    'Screenshots and screen recordings are not permitted on this portal.';
  sub.style.cssText =
    'font-size:14px;color:#a0aec0;max-width:400px;line-height:1.6';
  el.appendChild(sub);

  document.body.appendChild(el);
  return el;
};

const showOverlay = () => {
  if (!isOnPlayerPage()) return;
  const overlay = createOverlay();
  overlay.style.display = 'flex';
};

let hideTimer = null;
const hideOverlay = () => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      const overlay = document.getElementById('security-black-overlay');
      if (overlay) overlay.style.display = 'none';
    }
  }, 400);
};

// ── keyboard handler ──────────────────────────────────────────────────────────

const handleKeyDown = (e) => {
  // PrintScreen — overwrite clipboard + overlay
  if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
    overwriteClipboard();
    showOverlay();
    blockEvent(e);
    setTimeout(hideOverlay, 1800);
    return;
  }

  const ctrl = e.ctrlKey || e.metaKey;

  // DevTools & inspect shortcuts
  if (e.key === 'F12' || e.keyCode === 123) { blockEvent(e); return; }
  if (ctrl && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key)) {
    blockEvent(e); return;
  }

  // Print / Save / View-Source
  if (ctrl && ['p','P','s','S','u','U'].includes(e.key)) {
    blockEvent(e); return;
  }

  // Ctrl+A / Ctrl+C / Ctrl+V / Ctrl+X — only block outside form elements
  if (ctrl && ['a','A','c','C','v','V','x','X'].includes(e.key)) {
    const tag = document.activeElement?.tagName;
    const editable = document.activeElement?.isContentEditable;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return; // allow in forms
    blockEvent(e);
  }
};

const handleKeyUp = (e) => {
  if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
    overwriteClipboard();
    blockEvent(e);
  }
};

// ── tab visibility & focus ────────────────────────────────────────────────────

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    showOverlay();
  } else {
    hideOverlay();
  }
};

const handleBlur  = () => showOverlay();
const handleFocus = () => hideOverlay();

// ── copy ─────────────────────────────────────────────────────────────────────
// Silent intercept — no alert; prevents breaking clipboard inside forms
const handleCopy = (e) => {
  const tag = e.target?.tagName;
  const editable = e.target?.isContentEditable;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return; // allow in forms
  e.preventDefault();
};

// ── print ─────────────────────────────────────────────────────────────────────
const handleBeforePrint = () => {
  showOverlay();
};
const handleAfterPrint = () => {
  hideOverlay();
};

// ── picture-in-picture block ──────────────────────────────────────────────────
const handleEnterPiP = (e) => {
  e.preventDefault();
  const vid = document.querySelector('video.secure-video-element');
  if (vid && document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// Public API
// ═════════════════════════════════════════════════════════════════════════════

export const initScreenshotDetection = () => {
  injectPrintStyle();

  window.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('keyup',   handleKeyUp,   { capture: true });
  window.addEventListener('blur',    handleBlur);
  window.addEventListener('focus',   handleFocus);
  window.addEventListener('beforeprint', handleBeforePrint);
  window.addEventListener('afterprint',  handleAfterPrint);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('copy', handleCopy, { capture: true });

  // Block PiP at document level
  document.addEventListener('enterpictureinpicture', handleEnterPiP, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('keyup',   handleKeyUp,   { capture: true });
    window.removeEventListener('blur',    handleBlur);
    window.removeEventListener('focus',   handleFocus);
    window.removeEventListener('beforeprint', handleBeforePrint);
    window.removeEventListener('afterprint',  handleAfterPrint);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('copy', handleCopy, { capture: true });
    document.removeEventListener('enterpictureinpicture', handleEnterPiP, true);

    const overlay = document.getElementById('security-black-overlay');
    if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  };
};
