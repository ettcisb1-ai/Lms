import { useEffect } from 'react';

// ── Keyboard handler — defined at module scope so it's never GC'd ─────────────
const handleKeyDown = (e) => {
  const key   = e.key;
  const ctrl  = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt   = e.altKey;

  // Resolve whether the active element is a form field
  const tag      = document.activeElement?.tagName;
  const editable = document.activeElement?.isContentEditable;
  const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || editable;

  // F1 – F12
  if (/^F([1-9]|1[0-2])$/.test(key)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (ctrl && !alt) {
    if (shift) {
      // Ctrl + Shift + I / J / C / Delete → DevTools
      if (['i','I','j','J','c','C','Delete'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    } else {
      // Ctrl + P / S / U / R → print, save, view-source, reload
      if (['p','P','s','S','u','U','r','R'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl + A / C / V / X / D / H / J / F / O / N / T / W
      // — only block when NOT inside a form field
      if (
        !isFormField &&
        [
          'a','A','c','C','v','V','x','X',
          'f','F','h','H','j','J','d','D',
          'o','O','n','N','t','T','w','W',
        ].includes(key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }

  // Alt + Back/Forward/Home — block page navigation shortcuts
  if (alt && !ctrl) {
    if (['ArrowLeft','ArrowRight','Home'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  // Context menu key
  if (key === 'ContextMenu') {
    e.preventDefault();
    e.stopPropagation();
  }
};

const handleContextMenu = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleSelectStart = (e) => {
  const tag      = e.target?.tagName;
  const editable = e.target?.isContentEditable;
  // Allow text selection inside inputs and textareas
  if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return;
  e.preventDefault();
};

const handleDragStart = (e) => {
  if (['IMG','VIDEO','CANVAS','A'].includes(e.target?.tagName)) {
    e.preventDefault();
  }
};

const handleDrop     = (e) => e.preventDefault();
const handleDragOver = (e) => e.preventDefault();

// Attach immediately at module load — before React even mounts.
// Guarantees listeners survive StrictMode's double-invoke.
window.addEventListener('keydown',     handleKeyDown,     { capture: true });
window.addEventListener('contextmenu', handleContextMenu, { capture: true });
window.addEventListener('selectstart', handleSelectStart, { capture: true });
window.addEventListener('dragstart',   handleDragStart,   { capture: true });
window.addEventListener('drop',        handleDrop,        { capture: true });
window.addEventListener('dragover',    handleDragOver,    { capture: true });

/**
 * SecurityProvider — zero-render wrapper.
 * All protection listeners are attached at module scope above.
 */
const SecurityProvider = ({ children }) => {
  useEffect(() => {
    // Listeners are already live. This hook is a placeholder for any
    // future per-session or per-user security logic.
  }, []);

  return children;
};

export default SecurityProvider;
