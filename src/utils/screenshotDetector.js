/**
 * Security Screenshot & Key Detection Module (Opaque Mode)
 * Logs and blocks developer tools, print shortcuts, context menus, and copy actions
 * without rendering any full-screen blackout overlays.
 */

export const initScreenshotDetection = () => {
  console.log("[SECURITY_DETECTOR] Initializing background security listeners...");

  const triggerBlock = (source, details) => {
    console.warn(`[SECURITY_DETECTOR] [BLOCKED] Source: ${source} | Details:`, details);
  };

  // 1. Keyboard Event Listener
  const handleKeyDown = (e) => {
    const keyData = {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    };

    // Block PrintScreen key
    if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
      triggerBlock('PrintScreen Key', keyData);
      overwriteClipboard();
      blockEvent(e);
      return false;
    }

    // Block Ctrl/Cmd + P (Print)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.keyCode === 80)) {
      triggerBlock('Print Shortcut (Ctrl/Cmd + P)', keyData);
      blockEvent(e);
      return false;
    }

    // Block Ctrl/Cmd + S (Save Page)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
      triggerBlock('Save Shortcut (Ctrl/Cmd + S)', keyData);
      blockEvent(e);
      return false;
    }

    // Block Ctrl/Cmd + U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
      triggerBlock('View Source Shortcut (Ctrl/Cmd + U)', keyData);
      blockEvent(e);
      return false;
    }

    // Block F12 (DevTools)
    if (e.key === 'F12' || e.keyCode === 123 || e.code === 'F12') {
      triggerBlock('F12 DevTools Key', keyData);
      blockEvent(e);
      return false;
    }

    // Block DevTools Shortcuts (Ctrl+Shift+I / J / C or Cmd+Opt+I / J / C)
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)
    ) {
      triggerBlock('DevTools Shortcut (Ctrl/Cmd + Shift + I/J/C)', keyData);
      blockEvent(e);
      return false;
    }
  };

  const handleKeyUp = (e) => {
    const keyData = {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    };

    if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
      triggerBlock('PrintScreen KeyUp', keyData);
      overwriteClipboard();
      blockEvent(e);
    }
  };

  // Helper to block events
  const blockEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // Helper to overwrite clipboard buffer
  const overwriteClipboard = () => {
    try {
      navigator.clipboard.writeText("Screenshots are disabled on this portal for security reasons.");
      console.log("[SECURITY_DETECTOR] Clipboard successfully cleared/overwritten.");
    } catch (err) {
      console.warn("[SECURITY_DETECTOR] Clipboard overwrite failed:", err.message);
    }
  };

  // 2. Focus Loss & Gain Listeners (Logging only)
  const handleBlur = () => {
    console.log("[SECURITY_DETECTOR] Window lost focus (blur event fired)");
  };

  const handleFocus = () => {
    console.log("[SECURITY_DETECTOR] Window regained focus (focus event fired)");
  };

  // 3. Tab Visibility Change Listener (Logging only)
  const handleVisibilityChange = () => {
    console.log(`[SECURITY_DETECTOR] Document visibilityState changed: ${document.visibilityState}`);
  };

  // 4. Print Event Listeners (Triggers before browser prints page)
  const handleBeforePrint = () => {
    console.warn("[SECURITY_DETECTOR] Print dialog requested (beforeprint event fired)");
  };

  // 5. Copy Command Listener
  const handleCopy = (e) => {
    console.warn("[SECURITY_DETECTOR] Copy action intercepted");
    e.preventDefault();
    alert("Copying text is disabled on this portal to protect copyrighted course content.");
    return false;
  };

  // Attach all window/document level listeners
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeprint', handleBeforePrint);
  document.addEventListener('copy', handleCopy);

  // Return clean-up function
  return () => {
    console.log("[SECURITY_DETECTOR] Cleaning up security listeners...");
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeprint', handleBeforePrint);
    document.removeEventListener('copy', handleCopy);
  };
};
