/**
 * watermark.tsx
 * Dynamic floating watermark overlay for the DRM video player.
 *
 * Purpose: Discourage redistribution of recordings by embedding
 * user-identifiable information that moves position every 10-15 seconds.
 *
 * Limitations (documented honestly):
 *   - This watermark CAN be cropped out if only one position is visible.
 *   - Two simultaneous watermarks at diagonal positions make cropping harder.
 *   - mix-blend-mode: difference makes post-processing removal disruptive.
 *   - It CANNOT be removed by disabling React — it renders directly in the DOM.
 *   - It CANNOT prevent screen recording; it makes identification of leaks possible.
 */

import React, { useEffect, useState } from 'react';

export interface WatermarkProps {
  userName:   string;
  userEmail:  string;
  courseName: string;
  /** Session ID — unique per player load, helps trace leaked recordings */
  sessionId:  string;
}

interface Position { top: number; left: number; }

const randomPos = (topMin: number, topMax: number, leftMin: number, leftMax: number): Position => ({
  top:  Math.floor(Math.random() * (topMax - topMin)) + topMin,
  left: Math.floor(Math.random() * (leftMax - leftMin)) + leftMin,
});

const formatTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDate = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const Watermark: React.FC<WatermarkProps> = ({ userName, userEmail, courseName, sessionId }) => {
  const [pos1, setPos1] = useState<Position>({ top: 8,  left: 5  });
  const [pos2, setPos2] = useState<Position>({ top: 62, left: 55 });
  const [time, setTime] = useState(formatTime());

  // Update time every minute
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Move both watermarks every 10-15 seconds (random interval)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = 10_000 + Math.random() * 5_000; // 10–15 s
      timeout = setTimeout(() => {
        setPos1(randomPos(5,  40, 3,  55));
        setPos2(randomPos(55, 88, 42, 85));
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeout);
  }, []);

  const line1 = userName;
  const line2 = userEmail;
  const line3 = courseName;
  const line4 = `${formatDate()} · ${time}`;
  const line5 = sessionId;

  const baseStyle: React.CSSProperties = {
    position:     'absolute',
    pointerEvents:'none',
    zIndex:       90,
    display:      'flex',
    flexDirection:'column',
    gap:          '2px',
    fontFamily:   "'Courier New', monospace",
    fontSize:     '10px',
    fontWeight:   600,
    lineHeight:   1.5,
    letterSpacing:'0.4px',
    whiteSpace:   'nowrap',
    color:        '#ffffff',
    textShadow:   '0 1px 3px rgba(0,0,0,0.95)',
    padding:      '5px 9px',
    borderRadius: '4px',
    // Smooth position transition
    transition:   'top 1.5s ease-in-out, left 1.5s ease-in-out',
    userSelect:   'none',
  };

  return (
    <>
      {/* Primary watermark — upper half, difference blend makes removal destructive */}
      <div
        aria-hidden="true"
        style={{
          ...baseStyle,
          top:              `${pos1.top}%`,
          left:             `${pos1.left}%`,
          opacity:          0.25,
          backgroundColor:  'rgba(0,0,0,0.3)',
          mixBlendMode:     'difference',
        }}
      >
        <span>{line1}</span>
        <span>{line2}</span>
        <span>{line3}</span>
        <span>{line4}</span>
        <span style={{ fontSize: 8, opacity: 0.7 }}>{line5}</span>
      </div>

      {/* Secondary watermark — lower half, overlay blend — different visual signature */}
      <div
        aria-hidden="true"
        style={{
          ...baseStyle,
          top:             `${pos2.top}%`,
          left:            `${pos2.left}%`,
          opacity:         0.18,
          backgroundColor: 'rgba(255,255,255,0.06)',
          mixBlendMode:    'overlay',
          fontSize:        '9px',
        }}
      >
        <span>{line1}</span>
        <span style={{ fontSize: 8 }}>{line5}</span>
      </div>
    </>
  );
};
