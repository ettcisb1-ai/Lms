/**
 * watermark.tsx
 * Dynamic multi-watermark overlay.
 *
 * Strategy: render FOUR watermarks simultaneously at different positions
 * and blend modes. At least one is always clearly visible in any screenshot,
 * making it trivially easy to identify who leaked the recording.
 *
 * mix-blend-mode: difference — inverts colors relative to the video frame,
 * so removing it in post-processing destroys the underlying video colors.
 */

import React, { useEffect, useState } from 'react';

export interface WatermarkProps {
  userName:   string;
  userEmail:  string;
  courseName: string;
  sessionId:  string;
}

interface Pos { top: number; left: number; }

const rp = (tMin: number, tMax: number, lMin: number, lMax: number): Pos => ({
  top:  Math.floor(Math.random() * (tMax - tMin)) + tMin,
  left: Math.floor(Math.random() * (lMax - lMin)) + lMin,
});

const fmtTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtDate = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const Watermark: React.FC<WatermarkProps> = ({ userName, userEmail, courseName, sessionId }) => {
  const [p1, setP1] = useState<Pos>({ top: 5,  left: 5  });
  const [p2, setP2] = useState<Pos>({ top: 45, left: 50 });
  const [p3, setP3] = useState<Pos>({ top: 75, left: 10 });
  const [p4, setP4] = useState<Pos>({ top: 20, left: 65 });
  const [time, setTime] = useState(fmtTime());

  useEffect(() => {
    const t = setInterval(() => setTime(fmtTime()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const move = () => {
      const delay = 8_000 + Math.random() * 7_000; // 8–15 s
      timer = setTimeout(() => {
        setP1(rp(3,  35, 2,  45));
        setP2(rp(38, 65, 45, 85));
        setP3(rp(68, 90, 3,  50));
        setP4(rp(10, 40, 55, 88));
        move();
      }, delay);
    };
    move();
    return () => clearTimeout(timer);
  }, []);

  const label   = `${userName}  ·  ${userEmail}`;
  const subline = `${courseName}  ·  ${fmtDate()} ${time}`;
  const sid     = sessionId;

  const base: React.CSSProperties = {
    position:     'absolute',
    pointerEvents:'none',
    zIndex:       95,
    fontFamily:   "'Courier New', monospace",
    fontWeight:   700,
    lineHeight:   1.5,
    letterSpacing:'0.3px',
    whiteSpace:   'nowrap',
    userSelect:   'none',
    display:      'flex',
    flexDirection:'column',
    gap:          '1px',
    transition:   'top 2s ease-in-out, left 2s ease-in-out',
    padding:      '4px 8px',
    borderRadius: '3px',
  };

  return (
    <>
      {/* ── Watermark 1: top-left area, difference blend, full info ─────── */}
      <div aria-hidden="true" style={{
        ...base,
        top: `${p1.top}%`, left: `${p1.left}%`,
        fontSize: '11px',
        color: '#ffffff',
        opacity: 0.55,
        mixBlendMode: 'difference',
        backgroundColor: 'rgba(0,0,0,0.45)',
        textShadow: '0 0 4px #000',
      }}>
        <span>{label}</span>
        <span style={{ fontSize: 9, opacity: 0.85 }}>{subline}</span>
        <span style={{ fontSize: 8, opacity: 0.7  }}>{sid}</span>
      </div>

      {/* ── Watermark 2: center-right area, overlay blend ───────────────── */}
      <div aria-hidden="true" style={{
        ...base,
        top: `${p2.top}%`, left: `${p2.left}%`,
        fontSize: '10px',
        color: '#ffff00',
        opacity: 0.35,
        mixBlendMode: 'overlay',
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}>
        <span>{label}</span>
        <span style={{ fontSize: 8, opacity: 0.8 }}>{sid}</span>
      </div>

      {/* ── Watermark 3: bottom-left, screen blend, high visibility ─────── */}
      <div aria-hidden="true" style={{
        ...base,
        top: `${p3.top}%`, left: `${p3.left}%`,
        fontSize: '10px',
        color: '#ffffff',
        opacity: 0.4,
        mixBlendMode: 'screen',
        backgroundColor: 'transparent',
        textShadow: '0 0 6px rgba(255,255,255,0.8)',
      }}>
        <span>{label}</span>
        <span style={{ fontSize: 8 }}>{subline}</span>
      </div>

      {/* ── Watermark 4: top-right, exclusion blend, subtle ─────────────── */}
      <div aria-hidden="true" style={{
        ...base,
        top: `${p4.top}%`, left: `${p4.left}%`,
        fontSize: '9px',
        color: '#ffffff',
        opacity: 0.28,
        mixBlendMode: 'exclusion',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}>
        <span>{userEmail}</span>
        <span style={{ fontSize: 8 }}>{sid}</span>
      </div>
    </>
  );
};
