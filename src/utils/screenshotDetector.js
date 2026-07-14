/**
 * Security Screenshot & Key Detection Module (Opaque Mode)
 * Logs and blocks developer tools, print shortcuts, context menus, and copy actions
 * without rendering any full-screen blackout overlays.
 */

export const initScreenshotDetection = () => {
  console.log("[SECURITY_DETECTOR] Initializing background security listeners...");

  // Create or retrieve black overlay
  let overlay = document.getElementById('security-black-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'security-black-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = '#000000';
    overlay.style.zIndex = '99999999';
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'auto'; // Block clicks when displayed
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.flexDirection = 'column';
    overlay.style.color = '#ffffff';
    overlay.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    overlay.style.textAlign = 'center';
    overlay.style.padding = '30px';
    overlay.style.boxSizing = 'border-box';

    // Icon/Emoji indicator
    const icon = document.createElement('div');
    icon.innerHTML = '⚠️';
    icon.style.fontSize = '48px';
    icon.style.marginBottom = '16px';
    overlay.appendChild(icon);

    // Title
    const title = document.createElement('div');
    title.innerText = 'Content Protected';
    title.style.fontSize = '22px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    overlay.appendChild(title);

    // Message
    const subText = document.createElement('div');
    subText.innerText = 'Screenshots and screen recordings are disabled on this portal to protect copyrighted course content.';
    subText.style.fontSize = '14px';
    subText.style.color = '#a0aec0';
    subText.style.maxWidth = '400px';
    subText.style.lineHeight = '1.5';
    overlay.appendChild(subText);

    document.body.appendChild(overlay);
  }

  const showOverlay = () => {
    if (overlay) {
      overlay.style.display = 'flex';
    }
  };

  const hideOverlay = () => {
    if (overlay) {
      // Delay slightly to ensure screenshot/recording registers the black overlay first
      setTimeout(() => {
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          overlay.style.display = 'none';
        }
      }, 500);
    }
  };

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
      showOverlay();
      blockEvent(e);
      setTimeout(hideOverlay, 1500);
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

  // 2. Focus Loss & Gain Listeners (Trigger Black Screen)
  const handleBlur = () => {
    console.log("[SECURITY_DETECTOR] Window lost focus (blur event fired) - Blacking screen");
    showOverlay();
  };

  const handleFocus = () => {
    console.log("[SECURITY_DETECTOR] Window regained focus (focus event fired)");
    hideOverlay();
  };

  // 3. Tab Visibility Change Listener
  const handleVisibilityChange = () => {
    console.log(`[SECURITY_DETECTOR] Document visibilityState changed: ${document.visibilityState}`);
    if (document.visibilityState === 'hidden') {
      showOverlay();
    } else {
      hideOverlay();
    }
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
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
};
