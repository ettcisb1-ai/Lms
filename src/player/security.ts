/**
 * security.ts
 * Browser-level security deterrents for the video player.
 *
 * IMPORTANT: These are deterrents, not guarantees.
 * They cannot prevent:
 *   - OBS, Bandicam, Xbox Game Bar, or any OS-level screen recorder
 *   - A physical camera pointed at the screen
 *   - Widevine bypass by modified browsers
 *
 * What they DO discourage:
 *   - Casual right-click save / download
 *   - DevTools inspection of video URLs
 *   - PrintScreen clipboard capture
 *   - Picture-in-picture extraction
 *   - Drag-and-drop to desktop
 */

export type CleanupFn = () => void;

// ── Shortcut & context-menu blocking ─────────────────────────────────────────

export const blockPlayerShortcuts = (container: HTMLElement): CleanupFn => {
  const onContext = (e: MouseEvent) => {
    if (container.contains(e.target as Node)) e.preventDefault();
  };

  const onKey = (e: KeyboardEvent) => {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // F12
    if (e.key === 'F12') { e.preventDefault(); return; }

    // Ctrl+Shift+I/J/C — DevTools
    if (ctrl && shift && ['i','I','j','J','c','C'].includes(e.key)) {
      e.preventDefault(); return;
    }

    // Ctrl+U — view source
    if (ctrl && ['u','U'].includes(e.key)) { e.preventDefault(); return; }

    // Ctrl+S — save page
    if (ctrl && ['s','S'].includes(e.key)) { e.preventDefault(); return; }

    // PrintScreen
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      // Overwrite clipboard as best-effort
      try { navigator.clipboard.writeText('Content is protected.'); } catch (_) {}
    }
  };

  const onDragStart = (e: DragEvent) => {
    if (container.contains(e.target as Node)) e.preventDefault();
  };

  document.addEventListener('contextmenu', onContext, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('dragstart', onDragStart, true);

  return () => {
    document.removeEventListener('contextmenu', onContext, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('dragstart', onDragStart, true);
  };
};

// ── Picture-in-Picture block ──────────────────────────────────────────────────

export const blockPictureInPicture = (): CleanupFn => {
  const onEnter = () => {
    document.exitPictureInPicture?.().catch(() => {});
  };
  document.addEventListener('enterpictureinpicture', onEnter, true);
  return () => document.removeEventListener('enterpictureinpicture', onEnter, true);
};

// ── Tab visibility blur ───────────────────────────────────────────────────────

export interface TabVisibilityOptions {
  onHide: () => void;
  onShow: () => void;
}

export const attachTabVisibility = (opts: TabVisibilityOptions): CleanupFn => {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') opts.onHide();
    else opts.onShow();
  };
  const onBlur  = () => opts.onHide();
  const onFocus = () => opts.onShow();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur',  onBlur);
  window.addEventListener('focus', onFocus);

  // Periodic check — catches race conditions
  const interval = setInterval(() => {
    if (document.hidden) opts.onHide();
  }, 3000);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur',  onBlur);
    window.removeEventListener('focus', onFocus);
    clearInterval(interval);
  };
};

// ── DevTools detection (heuristic — not reliable, best-effort deterrent) ──────
// Method: measure time taken by a debugger statement.
// A non-zero pause means DevTools profiler/breakpoints may be active.
// This fires a callback; the caller decides what to do.

export const attachDevToolsDetection = (onDetected: () => void, onClosed: () => void): CleanupFn => {
  let devOpen = false;

  const isMobile = () =>
    window.innerWidth < 768 || /iPhone|Android.*Mobile|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const check = () => {
    if (isMobile()) {
      if (devOpen) { devOpen = false; onClosed(); }
      return;
    }
    const threshold = 160; // ms — normal JS loops complete in <1ms
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger; // pauses only when DevTools is open with "Pause on debugger" active
    const elapsed = performance.now() - start;

    const detected = elapsed > threshold;
    if (detected && !devOpen) { devOpen = true;  onDetected(); }
    if (!detected && devOpen) { devOpen = false; onClosed();   }
  };

  // Resize-based detection (DevTools panel changes window size)
  const onResize = () => {
    if (isMobile()) {
      if (devOpen) { devOpen = false; onClosed(); }
      return;
    }
    const widthDiff  = window.outerWidth  - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const detected = widthDiff > 160 || heightDiff > 160;
    if (detected && !devOpen) { devOpen = true;  onDetected(); }
    if (!detected && devOpen) { devOpen = false; onClosed();   }
  };

  window.addEventListener('resize', onResize);
  const interval = setInterval(check, 1500);

  return () => {
    clearInterval(interval);
    window.removeEventListener('resize', onResize);
  };
};

// ── Print protection ──────────────────────────────────────────────────────────

export const injectPrintBlock = (): CleanupFn => {
  const id = 'drm-player-print-block';
  if (document.getElementById(id)) return () => {};

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @media print {
      .drm-player-root, .drm-player-root * { display: none !important; }
      body::before {
        content: 'Printing this content is not permitted.';
        display: block;
        font-size: 22px;
        font-weight: bold;
        text-align: center;
        margin-top: 40vh;
      }
    }
  `;
  document.head.appendChild(style);

  return () => { style.parentNode?.removeChild(style); };
};
