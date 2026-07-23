/**
 * DRMPlayer.tsx — Secure LMS Video Player
 *
 * Supports: plain MP4 (S3 proxy), HLS (HLS.js), DASH+Widevine (Shaka Player)
 *
 * Security features:
 *  - Dynamic dual watermark (moves every 10-15 s, mix-blend-mode)
 *  - Tab-switch / window-blur → blur video + pause
 *  - Right-click disabled on player
 *  - F12 / DevTools shortcuts blocked
 *  - PiP blocked
 *  - Print CSS blackout
 *  - disablePictureInPicture + controlsList="nodownload"
 *
 * NOTE: OBS, Xbox Game Bar, Bandicam, and physical cameras cannot be blocked
 * by any browser application. These measures discourage casual piracy only.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Shield, Maximize, Play, Pause,
    Volume2, VolumeX, RotateCcw, Loader, AlertTriangle,
} from 'lucide-react';
import Hls from 'hls.js';
import { Watermark } from './watermark';
import './DRMPlayer.css';

// ── Shaka lazy-loader ─────────────────────────────────────────────────────────
let _shakaPromise: Promise<boolean> | null = null;

const loadShaka = (): Promise<boolean> => {
    if ((window as any).shaka) return Promise.resolve(true);
    if (_shakaPromise) return _shakaPromise;

    _shakaPromise = new Promise((resolve) => {
        const tryLoad = (src: string, fallback?: string) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve(true);
            s.onerror = () => {
                if (fallback) tryLoad(fallback);
                else { _shakaPromise = null; resolve(false); }
            };
            document.body.appendChild(s);
        };
        tryLoad(
            'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.5/shaka-player.compiled.js',
            'https://unpkg.com/shaka-player@4.3.5/dist/shaka-player.compiled.js',
        );
    });

    return _shakaPromise;
};

// ── Props ─────────────────────────────────────────────────────────────────────
export interface DRMPlayerProps {
    streamUrl: string;
    isDrm?: boolean;
    isHLS?: boolean;
    isDASH?: boolean;
    licenseServerUrl?: string;
    drmToken?: string;
    onEnded?: () => void;
    onDuration?: (secs: number) => void;
    watermark: {
        userName: string;
        userEmail: string;
        courseName: string;
    };
    forcePause?: boolean;
    className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
const DRMPlayer: React.FC<DRMPlayerProps> = ({
    streamUrl,
    isDrm = false,
    isHLS = false,
    isDASH = false,
    licenseServerUrl,
    drmToken,
    onEnded,
    onDuration,
    watermark,
    forcePause,
    className = '',
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const shakaRef = useRef<any>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isBlurred, setIsBlurred] = useState(false);
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [sessionId] = useState(
        () => `SID-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
    );

    // ── Destroy helpers ───────────────────────────────────────────────────────
    const destroyHls = useCallback(() => {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    }, []);

    const destroyShaka = useCallback(async () => {
        if (shakaRef.current) {
            try { await shakaRef.current.destroy(); } catch (_) { }
            shakaRef.current = null;
        }
    }, []);

    const clearVideoSrc = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        v.pause();
        v.removeAttribute('src');
        // Don't call v.load() — fires spurious error events
    }, []);

    // ── Load stream whenever streamUrl changes ────────────────────────────────
    useEffect(() => {
        if (!streamUrl) return;

        const v = videoRef.current;
        if (!v) return;

        setPlayerError(null);
        setIsLoading(true);
        setIsBuffering(false);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);

        // Tear down any previous player
        destroyHls();
        destroyShaka().then(() => {
            // ── DASH / DRM path ─────────────────────────────────────────────────
            const isDashUrl = isDrm || isDASH || streamUrl.includes('.mpd');

            if (isDashUrl) {
                loadShaka().then((loaded) => {
                    if (!loaded) {
                        setPlayerError('Shaka Player failed to load. Please refresh.');
                        setIsLoading(false);
                        return;
                    }

                    const shaka = (window as any).shaka;

                    shaka.Player.probeSupport().then((support: any) => {
                        if (isDrm && !support?.drm?.['com.widevine.alpha']) {
                            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                            setPlayerError(
                                isSafari
                                    ? 'Safari requires FairPlay DRM. Please open in Chrome or Edge.'
                                    : 'Your browser does not support Widevine DRM. Please use Chrome or Edge.'
                            );
                            setIsLoading(false);
                            return;
                        }

                        const player = new shaka.Player(v);
                        shakaRef.current = player;

                        player.addEventListener('error', (e: any) => {
                            const code = e.detail?.code ?? 0;
                            setPlayerError(mapShakaError(code));
                        });

                        if (isDrm && licenseServerUrl && drmToken) {
                            player.configure({
                                drm: {
                                    servers: {
                                        'com.widevine.alpha': licenseServerUrl,
                                        'com.microsoft.playready': licenseServerUrl,
                                    },
                                },
                            });
                            player.getNetworkingEngine().registerRequestFilter(
                                (_type: number, req: any) => {
                                    if (_type === 2) req.headers['Authorization'] = `Bearer ${drmToken}`;
                                }
                            );
                        }

                        player.load(streamUrl)
                            .then(() => { setIsLoading(false); })
                            .catch((err: any) => {
                                setPlayerError(mapShakaError(err?.code));
                                setIsLoading(false);
                            });
                    });
                });

                return;
            }

            // ── HLS path ──────────────────────────────────────────────────────────
            const isHlsUrl = isHLS || streamUrl.includes('.m3u8');

            if (isHlsUrl) {
                if (Hls.isSupported()) {
                    const hls = new Hls({ maxBufferLength: 30, enableWorker: true, debug: false });
                    hlsRef.current = hls;
                    hls.loadSource(streamUrl);
                    hls.attachMedia(v);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => setIsLoading(false));
                    hls.on(Hls.Events.ERROR, (_: any, data: any) => {
                        if (data.fatal) setPlayerError('HLS stream error. Please try again.');
                    });
                } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
                    v.src = streamUrl;
                    v.load();
                    setIsLoading(false);
                } else {
                    setPlayerError('HLS is not supported in this browser.');
                    setIsLoading(false);
                }
                return;
            }

            // ── Plain MP4 / proxy URL ─────────────────────────────────────────────
            v.src = streamUrl;
            v.load();
            setIsLoading(false);
        });

        // Cleanup on src change
        return () => {
            destroyHls();
            destroyShaka();
            clearVideoSrc();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamUrl, isDrm, isHLS, isDASH, licenseServerUrl, drmToken]);

    // ── Destroy on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            destroyHls();
            destroyShaka();
            clearVideoSrc();
        };
    }, [destroyHls, destroyShaka, clearVideoSrc]);

    // ── Volume sync ───────────────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = volume;
        v.muted = isMuted;
    }, [volume, isMuted]);

    // ── Playback rate sync ────────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (v) v.playbackRate = playbackRate;
    }, [playbackRate]);

    // ── forcePause from parent ────────────────────────────────────────────────
    useEffect(() => {
        if (forcePause) {
            const v = videoRef.current;
            if (v && !v.paused) { v.pause(); setIsPlaying(false); }
        }
    }, [forcePause]);

    // ── DevTools detection ────────────────────────────────────────────────────
  // Measures browser chrome size on mount (address bar, bookmarks ~60-90px).
  // Any gap significantly larger than that baseline = DevTools is open.
  // Works for: docked side, docked bottom, any window size.
  // Does NOT work for: undocked (floating) DevTools window.
  // This is a deterrent only.
  useEffect(() => {
    let devOpen = false;

    // Capture baseline chrome size on first load (DevTools assumed closed)
    const baselineW = window.outerWidth  - window.innerWidth;
    const baselineH = window.outerHeight - window.innerHeight;

    const detectDevTools = (): boolean => {
      const wGap = (window.outerWidth  - window.innerWidth)  - baselineW;
      const hGap = (window.outerHeight - window.innerHeight) - baselineH;
      // DevTools panel is typically 200-600px — anything >100px above baseline
      return wGap > 100 || hGap > 100;
    };

    const check = () => {
      const detected = detectDevTools();

      if (detected && !devOpen) {
        devOpen = true;
        setIsDevToolsOpen(true);
        const v = videoRef.current;
        if (v && !v.paused) { v.pause(); setIsPlaying(false); }
      } else if (!detected && devOpen) {
        devOpen = false;
        setIsDevToolsOpen(false);
      }
    };

    window.addEventListener('resize', check);
    const interval = setInterval(check, 800);
    // Small delay before first check so baseline is accurate
    const initTimer = setTimeout(check, 500);

    return () => {
      window.removeEventListener('resize', check);
      clearInterval(interval);
      clearTimeout(initTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
    useEffect(() => {
        const onHide = () => {
            setIsBlurred(true);
            const v = videoRef.current;
            if (v && !v.paused) { v.pause(); setIsPlaying(false); }
        };
        const onShow = () => setIsBlurred(false);
        const onVis = () => document.hidden ? onHide() : onShow();

        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('blur', onHide);
        window.addEventListener('focus', onShow);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('blur', onHide);
            window.removeEventListener('focus', onShow);
        };
    }, []);

    // ── Keyboard / right-click / PiP blocking + PrintScreen blackout ────────
    useEffect(() => {
        let psOverlay: HTMLDivElement | null = null;

        const showBlackout = () => {
            if (!psOverlay) {
                psOverlay = document.createElement('div');
                psOverlay.style.cssText =
                    'position:fixed;inset:0;background:#000;z-index:2147483647;pointer-events:none;display:none';
                document.body.appendChild(psOverlay);
            }
            psOverlay.style.display = 'block';
        };
        const hideBlackout = () => {
            if (psOverlay) psOverlay.style.display = 'none';
        };

        const onKey = (e: KeyboardEvent) => {
            const ctrl  = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            // PrintScreen — cover screen + overwrite clipboard
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                e.preventDefault();
                showBlackout();
                try { navigator.clipboard.writeText('Content is protected.'); } catch (_) {}
                setTimeout(hideBlackout, 1500);
                return;
            }
            if (e.key === 'F12') { e.preventDefault(); return; }
            if (ctrl && shift && ['i','I','j','J','c','C'].includes(e.key)) { e.preventDefault(); return; }
            if (ctrl && ['u','U','s','S'].includes(e.key)) { e.preventDefault(); return; }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                try { navigator.clipboard.writeText('Content is protected.'); } catch (_) {}
                hideBlackout();
            }
        };

        const onCtxMenu = (e: MouseEvent) => {
            if (containerRef.current?.contains(e.target as Node)) e.preventDefault();
        };

        const onPiP = () => { document.exitPictureInPicture?.().catch(() => {}); };

        // Block copy outside form fields
        const onCopy = (e: ClipboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
        };

        // Print → blackout
        const onBeforePrint = () => showBlackout();
        const onAfterPrint  = () => hideBlackout();

        document.addEventListener('keydown',               onKey,          { capture: true });
        document.addEventListener('keyup',                 onKeyUp,        { capture: true });
        document.addEventListener('contextmenu',           onCtxMenu,      { capture: true });
        document.addEventListener('enterpictureinpicture', onPiP,          true);
        document.addEventListener('copy',                  onCopy,         { capture: true });
        window.addEventListener('beforeprint',             onBeforePrint);
        window.addEventListener('afterprint',              onAfterPrint);

        return () => {
            document.removeEventListener('keydown',               onKey,          { capture: true } as any);
            document.removeEventListener('keyup',                 onKeyUp,        { capture: true } as any);
            document.removeEventListener('contextmenu',           onCtxMenu,      { capture: true } as any);
            document.removeEventListener('enterpictureinpicture', onPiP,          true);
            document.removeEventListener('copy',                  onCopy,         { capture: true } as any);
            window.removeEventListener('beforeprint',             onBeforePrint);
            window.removeEventListener('afterprint',              onAfterPrint);
            if (psOverlay?.parentNode) psOverlay.parentNode.removeChild(psOverlay);
        };
    }, []);

    // ── Print CSS blackout ────────────────────────────────────────────────────
    useEffect(() => {
        const id = 'drm-print-block';
        if (document.getElementById(id)) return;
        const s = document.createElement('style');
        s.id = id;
        s.textContent = `@media print { .drm-player-root { display:none!important; } }`;
        document.head.appendChild(s);
    }, []);

    // ── Controls ──────────────────────────────────────────────────────────────
    const togglePlay = () => {
        const v = videoRef.current;
        if (!v || isBlurred || isDevToolsOpen) return;
        if (v.paused) v.play().catch(console.error);
        else v.pause();
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const t = parseFloat(e.target.value);
        const v = videoRef.current;
        if (v) { v.currentTime = t; setCurrentTime(t); }
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        setIsMuted(val === 0);
    };

    const handleFullscreen = () => {
        const c = containerRef.current;
        if (!c) return;
        document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen().catch(() => { });
    };

    const fmt = (t: number) => {
        if (!t || isNaN(t) || !isFinite(t)) return '0:00';
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className={`drm-player-root ${className}`}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Native video element — src managed imperatively above */}
            <video
                ref={videoRef}
                className={`drm-video${isBlurred ? ' drm-video--blurred' : ''}`}
                playsInline
                preload="auto"
                controlsList="nodownload nofullscreen noremoteplayback"
                disablePictureInPicture
                onClick={togglePlay}
                onContextMenu={(e) => e.preventDefault()}

                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsBuffering(true)}
                onCanPlay={() => setIsBuffering(false)}
                onCanPlayThrough={() => setIsBuffering(false)}
                onTimeUpdate={() => { const v = videoRef.current; if (v) setCurrentTime(v.currentTime); }}
                onDurationChange={() => {
                    const v = videoRef.current;
                    if (v && isFinite(v.duration)) { setDuration(v.duration); onDuration?.(v.duration); }
                }}
                onLoadedMetadata={() => {
                    const v = videoRef.current;
                    if (v && isFinite(v.duration)) { setDuration(v.duration); onDuration?.(v.duration); }
                }}
                onEnded={() => { setIsPlaying(false); onEnded?.(); }}
                onError={() => {
                    const v = videoRef.current;
                    if (!v?.src) return; // suppress cleanup-triggered errors
                    const code = v.error?.code ?? 0;
                    const msgs: Record<number, string> = {
                        1: 'Playback aborted.',
                        2: 'Network error while loading video.',
                        3: 'Video decoding failed.',
                        4: 'Video format not supported.',
                    };
                    setPlayerError(msgs[code] ?? 'Playback error. Please try again.');
                }}
            />

            {/* Watermark */}
            {!playerError && (
                <Watermark
                    userName={watermark.userName}
                    userEmail={watermark.userEmail}
                    courseName={watermark.courseName}
                    sessionId={sessionId}
                />
            )}

            {/* Loading spinner */}
            {isLoading && (
                <div className="drm-overlay drm-overlay--loading">
                    <Loader size={32} className="drm-spin" />
                    <span>Loading secure stream…</span>
                </div>
            )}

            {/* Buffering spinner (only after initial load) */}
            {!isLoading && isBuffering && !playerError && (
                <div className="drm-overlay drm-overlay--buffering">
                    <div className="drm-buffer-ring" />
                </div>
            )}

            {/* Tab-switch blur overlay */}
            {isBlurred && (
                <div className="drm-overlay drm-overlay--blur">
                    <div className="drm-overlay__message">
                        <span style={{ fontSize: 32 }}>🔒</span>
                        <span className="drm-overlay__title">Playback Paused</span>
                        <span className="drm-overlay__sub">Return to this tab to resume</span>
                    </div>
                </div>
            )}

            {/* DevTools warning overlay */}
            {isDevToolsOpen && !isBlurred && (
                <div className="drm-overlay drm-overlay--devtools">
                    <div className="drm-overlay__message">
                        <AlertTriangle size={36} color="#f59e0b" />
                        <span className="drm-overlay__title">Developer Tools Detected</span>
                        <span className="drm-overlay__sub">
                            Playback is paused while developer tools are open.
                            Close DevTools to resume.
                        </span>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {playerError && (
                <div className="drm-overlay drm-overlay--error">
                    <div className="drm-overlay__message">
                        <AlertTriangle size={32} color="#e74c3c" />
                        <span className="drm-overlay__title">Playback Error</span>
                        <span className="drm-overlay__sub">{playerError}</span>
                        <button
                            className="drm-retry-btn"
                            onClick={() => { setPlayerError(null); }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Security badge */}
            {!isLoading && (
                <div className="drm-security-badge">
                    <Shield size={11} />
                    <span>Secure Stream{isDrm ? ' · Widevine DRM' : ''}</span>
                </div>
            )}

            {/* Controls */}
            {!isLoading && !playerError && (
                <div className="drm-controls">
                    <div className="drm-controls__progress-row">
                        <input
                            type="range" min={0} max={duration || 100} step={0.5}
                            value={currentTime}
                            onChange={handleSeek}
                            className="drm-slider drm-slider--progress"
                            style={{ '--pct': `${progress}%` } as React.CSSProperties}
                        />
                    </div>

                    <div className="drm-controls__row">
                        <div className="drm-controls__left">
                            <button className="drm-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                            </button>
                            <button className="drm-btn drm-btn--sec" title="Rewind 10s"
                                onClick={() => { const v = videoRef.current; if (v) v.currentTime -= 10; }}>
                                <RotateCcw size={15} />
                            </button>
                            <span className="drm-time">{fmt(currentTime)} / {fmt(duration)}</span>
                        </div>

                        <div className="drm-controls__right">
                            <div className="drm-volume">
                                <button className="drm-btn drm-btn--sec" onClick={() => setIsMuted(m => !m)}>
                                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                </button>
                                <input
                                    type="range" min={0} max={1} step={0.05}
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolume}
                                    className="drm-slider drm-slider--volume"
                                />
                            </div>

                            <div className="drm-speed">
                                {([0.75, 1, 1.25, 1.5, 2] as const).map(r => (
                                    <button key={r}
                                        className={`drm-speed__btn${playbackRate === r ? ' active' : ''}`}
                                        onClick={() => setPlaybackRate(r)}
                                    >{r}x</button>
                                ))}
                            </div>

                            <button className="drm-btn" onClick={handleFullscreen} title="Fullscreen">
                                <Maximize size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DRMPlayer;

// ── Shaka error map ───────────────────────────────────────────────────────────
function mapShakaError(code?: number): string {
    if (!code) return 'Playback error. Please try again.';
    if (code >= 6000 && code < 7000) {
        const m: Record<number, string> = {
            6001: 'DRM: Your browser may not support Widevine.',
            6003: 'DRM: License request failed.',
            6004: 'DRM: License was rejected.',
            6007: 'DRM: License expired. Please reload.',
        };
        return m[code] ?? 'DRM error. Please reload the page.';
    }
    if (code >= 1000 && code < 2000) return 'Network error. Check your connection.';
    if (code >= 4000 && code < 5000) return 'Stream format error.';
    return `Playback error (${code}).`;
}
