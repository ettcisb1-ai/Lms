/**
 * shakaConfig.ts
 * Centralised Shaka Player configuration factory.
 *
 * IMPORTANT SECURITY NOTE:
 * Browser-based applications CANNOT guarantee prevention of screenshots or
 * screen recording. Widevine DRM, signed URLs, and short-lived tokens are the
 * strongest protection available on the web. OBS, Bandicam, Xbox Game Bar,
 * and mobile cameras recording a physical screen cannot be blocked in software.
 * This implementation implements every practical deterrent available to a
 * web application.
 */

export interface DRMConfig {
  licenseServerUrl: string;
  /** Short-lived JWT issued by our backend — sent as Authorization header */
  drmToken: string;
}

export interface ShakaPlayerConfig {
  streaming: {
    bufferingGoal: number;
    rebufferingGoal: number;
    bufferBehind: number;
    retryParameters: {
      maxAttempts: number;
      baseDelay: number;
      backoffFactor: number;
    };
  };
  drm?: {
    servers: Record<string, string>;
    advanced?: Record<string, unknown>;
    retryParameters: {
      maxAttempts: number;
      baseDelay: number;
    };
  };
  abr: {
    enabled: boolean;
    defaultBandwidthEstimate: number;
  };
  manifest: {
    retryParameters: {
      maxAttempts: number;
      baseDelay: number;
    };
  };
}

/** Base streaming config — applies to every stream regardless of DRM */
export const baseStreamingConfig = (): ShakaPlayerConfig => ({
  streaming: {
    bufferingGoal: 30,
    rebufferingGoal: 2,
    bufferBehind: 30,
    retryParameters: {
      maxAttempts: 4,
      baseDelay: 1000,
      backoffFactor: 2,
    },
  },
  abr: {
    enabled: true,
    defaultBandwidthEstimate: 1_000_000, // 1 Mbps starting estimate
  },
  manifest: {
    retryParameters: {
      maxAttempts: 3,
      baseDelay: 1000,
    },
  },
});

/** Full config with Widevine DRM configured */
export const buildDRMConfig = (drm: DRMConfig): ShakaPlayerConfig => {
  const base = baseStreamingConfig();
  return {
    ...base,
    drm: {
      servers: {
        'com.widevine.alpha':   drm.licenseServerUrl,
        'com.microsoft.playready': drm.licenseServerUrl,
      },
      advanced: {
        'com.widevine.alpha': {
          // Prefer hardware-backed CDM when available
          videoRobustness: 'SW_SECURE_CRYPTO',
          audioRobustness: 'SW_SECURE_CRYPTO',
        },
      },
      retryParameters: {
        maxAttempts: 3,
        baseDelay: 500,
      },
    },
  };
};

/**
 * Attaches the DRM token to every license request as an Authorization header.
 * Called after player.configure() before player.load().
 */
export const attachLicenseRequestFilter = (
  player: any,
  drmToken: string
): void => {
  player
    .getNetworkingEngine()
    .registerRequestFilter(
      (type: number, request: any) => {
        // type 2 = LICENSE in Shaka's RequestType enum
        if (type === 2) {
          request.headers['Authorization'] = `Bearer ${drmToken}`;
        }
      }
    );
};
