/**
 * playerEvents.ts
 * Typed wrappers for HTMLVideoElement events used by DRMPlayer.
 */

export interface VideoEventHandlers {
  onTimeUpdate:     (currentTime: number) => void;
  onDurationChange: (duration: number)    => void;
  onWaiting:        ()                    => void;
  onCanPlay:        ()                    => void;
  onEnded:          ()                    => void;
  onPlay:           ()                    => void;
  onPause:          ()                    => void;
  onError:          (msg: string)         => void;
}

/** Attaches all standard video events and returns a cleanup function */
export const attachVideoEvents = (
  video: HTMLVideoElement,
  handlers: VideoEventHandlers
): (() => void) => {
  const onTime     = () => handlers.onTimeUpdate(video.currentTime);
  const onDur      = () => {
    if (video.duration && isFinite(video.duration))
      handlers.onDurationChange(video.duration);
  };
  const onWaiting  = () => handlers.onWaiting();
  const onCanPlay  = () => handlers.onCanPlay();
  const onEnded    = () => handlers.onEnded();
  const onPlay     = () => handlers.onPlay();
  const onPause    = () => handlers.onPause();
  const onError    = () => {
    const code = video.error?.code;
    const messages: Record<number, string> = {
      1: 'Playback aborted by the user.',
      2: 'Network error while loading video.',
      3: 'Video decoding failed.',
      4: 'Video format is not supported by your browser.',
    };
    handlers.onError(messages[code ?? 0] ?? 'Unknown video error.');
  };

  video.addEventListener('timeupdate',     onTime);
  video.addEventListener('durationchange', onDur);
  video.addEventListener('loadedmetadata', onDur);
  video.addEventListener('waiting',        onWaiting);
  video.addEventListener('canplay',        onCanPlay);
  video.addEventListener('canplaythrough', onCanPlay);
  video.addEventListener('ended',          onEnded);
  video.addEventListener('play',           onPlay);
  video.addEventListener('pause',          onPause);
  video.addEventListener('error',          onError);

  return () => {
    video.removeEventListener('timeupdate',     onTime);
    video.removeEventListener('durationchange', onDur);
    video.removeEventListener('loadedmetadata', onDur);
    video.removeEventListener('waiting',        onWaiting);
    video.removeEventListener('canplay',        onCanPlay);
    video.removeEventListener('canplaythrough', onCanPlay);
    video.removeEventListener('ended',          onEnded);
    video.removeEventListener('play',           onPlay);
    video.removeEventListener('pause',          onPause);
    video.removeEventListener('error',          onError);
  };
};
