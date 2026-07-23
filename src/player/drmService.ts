/**
 * drmService.ts
 * Handles Shaka Player lifecycle: lazy-load, init, destroy, license renewal.
 *
 * Shaka Player is loaded lazily from CDN to avoid adding ~500 kB to the
 * initial bundle. Once loaded it is cached on window.shaka.
 */

import { buildDRMConfig, attachLicenseRequestFilter, baseStreamingConfig } from './shakaConfig';
import Hls from 'hls.js';

const CDN_PRIMARY = 'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.5/shaka-player.compiled.js';
const CDN_BACKUP  = 'https://unpkg.com/shaka-player@4.3.5/dist/shaka-player.compiled.js';

// ── Shaka load ────────────────────────────────────────────────────────────────

let shakaLoadPromise: Promise<boolean> | null = null;

const loadScript = (src: string): Promise<boolean> =>
  new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export const ensureShakaLoaded = (): Promise<boolean> => {
  if ((window as any).shaka) return Promise.resolve(true);
  if (shakaLoadPromise)      return shakaLoadPromise;

  shakaLoadPromise = (async () => {
    const ok = await loadScript(CDN_PRIMARY);
    if (ok && (window as any).shaka) return true;

    console.warn('[DRM] Primary Shaka CDN failed, trying backup…');
    const ok2 = await loadScript(CDN_BACKUP);
    if (ok2 && (window as any).shaka) return true;

    console.error('[DRM] All Shaka CDNs failed.');
    shakaLoadPromise = null; // allow retry on next call
    return false;
  })();

  return shakaLoadPromise;
};

// ── Player create / destroy ───────────────────────────────────────────────────

export interface PlayerOptions {
  videoElement: HTMLVideoElement;
  streamUrl: string;
  isDrm: boolean;
  /** Hint: caller already knows the stream is HLS */
  isHLS?: boolean;
  /** Hint: caller already knows the stream is DASH */
  isDASH?: boolean;
  licenseServerUrl?: string;
  drmToken?: string;
  onError: (msg: string) => void;
  onBuffering: (buffering: boolean) => void;
  onDuration: (secs: number) => void;
}

export interface PlayerHandle {
  destroy: () => Promise<void>;
  /** Seek to time in seconds */
  seek: (secs: number) => void;
  /** Returns the current Shaka player instance (may be null for plain src) */
  shakaInstance: any | null;
}

export const createPlayer = async (opts: PlayerOptions): Promise<PlayerHandle> => {
  const { videoElement, streamUrl, isDrm, isHLS: hlsHint, isDASH, licenseServerUrl, drmToken, onError, onBuffering, onDuration } = opts;

  let shakaPlayer: any = null;
  let hlsInstance: any = null;

  const destroy = async () => {
    if (shakaPlayer) {
      try { await shakaPlayer.destroy(); } catch (_) {}
      shakaPlayer = null;
    }
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    // Pause and clear src to stop any ongoing network requests
    try {
      videoElement.pause();
      videoElement.removeAttribute('src');
      // Don't call load() here — it triggers error events on the cleared element
    } catch (_) {}
  };

  // ── Shaka / DASH / DRM path ───────────────────────────────────────────────
  const isDashStream = isDrm || isDASH || streamUrl.endsWith('.mpd') || streamUrl.includes('.mpd?');
  const isHlsStream  = hlsHint || streamUrl.endsWith('.m3u8') || streamUrl.includes('.m3u8?');

  if (isDashStream) {
    const loaded = await ensureShakaLoaded();
    if (!loaded) {
      onError('Shaka Player could not be loaded. Please refresh the page.');
      return { destroy: async () => {}, seek: () => {}, shakaInstance: null };
    }

    const shaka = (window as any).shaka;

    // Check Widevine support
    const support = await shaka.Player.probeSupport();
    const hasWidevine = support.drm?.['com.widevine.alpha'];

    if (isDrm && !hasWidevine) {
      onError(
        navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')
          ? 'Safari requires FairPlay DRM. Please use Chrome or Edge for DRM-protected content.'
          : 'Your browser does not support Widevine DRM. Please use Chrome or Edge.'
      );
      return { destroy: async () => {}, seek: () => {}, shakaInstance: null };
    }

    shakaPlayer = new shaka.Player(videoElement);

    // Error handler
    shakaPlayer.addEventListener('error', (event: any) => {
      const code  = event.detail?.code;
      const msg   = mapShakaError(code);
      onError(msg);
    });

    // Buffering state
    shakaPlayer.addEventListener('buffering', (event: any) => {
      onBuffering(event.buffering);
    });

    // Configure DRM or plain DASH
    if (isDrm && licenseServerUrl && drmToken) {
      shakaPlayer.configure(buildDRMConfig({ licenseServerUrl, drmToken }));
      attachLicenseRequestFilter(shakaPlayer, drmToken);
    } else {
      shakaPlayer.configure(baseStreamingConfig());
    }

    try {
      await shakaPlayer.load(streamUrl);

      // Duration from Shaka
      const duration = shakaPlayer.seekRange().end;
      if (duration && isFinite(duration)) onDuration(duration);
    } catch (err: any) {
      const msg = mapShakaError(err?.code);
      onError(msg);
    }

    return {
      destroy,
      seek: (secs) => { videoElement.currentTime = secs; },
      shakaInstance: shakaPlayer,
    };
  }

  // ── HLS path ──────────────────────────────────────────────────────────────
  if (isHlsStream) {
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        enableWorker: true,
        debug: false,
      });
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(videoElement);
      hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) onError('Stream error. Please try again.');
      });
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        // duration available after manifest
        const dur = videoElement.duration;
        if (dur && isFinite(dur)) onDuration(dur);
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      videoElement.src = streamUrl;
      videoElement.load();
    } else {
      onError('HLS streaming is not supported in this browser.');
    }

    return {
      destroy,
      seek: (secs) => { videoElement.currentTime = secs; },
      shakaInstance: null,
    };
  }

  // ── Plain MP4 / proxy URL path ────────────────────────────────────────────
  // Set src and load. Duration arrives via the loadedmetadata DOM event which
  // is wired in DRMPlayer via attachVideoEvents — no extra work needed here.
  videoElement.src = streamUrl;
  videoElement.load();

  return {
    destroy,
    seek: (secs) => { videoElement.currentTime = secs; },
    shakaInstance: null,
  };
};

// ── Error code → human message ────────────────────────────────────────────────

export const mapShakaError = (code?: number): string => {
  if (!code) return 'Playback error. Please try again.';

  // Shaka error categories: 1xxx=network, 2xxx=text, 3xxx=media, 4xxx=manifest,
  // 5xxx=streaming, 6xxx=DRM, 7xxx=player
  if (code >= 6000 && code < 7000) {
    const drmMessages: Record<number, string> = {
      6001: 'DRM: Failed to create media keys. Your browser may not support Widevine.',
      6002: 'DRM: Failed to create key session.',
      6003: 'DRM: License request failed. Please check your connection.',
      6004: 'DRM: License response was rejected.',
      6007: 'DRM: License has expired. Please reload the page.',
      6008: 'DRM: Required keys are unavailable.',
      6014: 'DRM: Certificate request failed.',
    };
    return drmMessages[code] ?? 'DRM error. Please reload the page.';
  }

  if (code >= 1000 && code < 2000) return 'Network error. Please check your connection.';
  if (code >= 4000 && code < 5000) return 'Stream format error. The video may be unavailable.';
  if (code === 7000)               return 'Playback was interrupted.';

  return `Playback error (${code}). Please try again.`;
};
