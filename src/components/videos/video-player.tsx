import { Maximize, Minimize, Pause, Play, Settings, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cmsGhostButton } from "@/components/cms-ui";
import { cn } from "@/lib/utils";
import type { VideoCaption } from "@/lib/video.functions";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const VOLUME_KEY = "dl_video_volume";
const PROGRESS_REPORT_INTERVAL_SECONDS = 15;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initialVolume() {
  if (typeof window === "undefined") return 1;
  const saved = window.localStorage.getItem(VOLUME_KEY);
  const parsed = saved ? Number(saved) : NaN;
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
}

export type VideoPlayerProps = {
  src: string | null | undefined;
  poster?: string | null;
  title?: string;
  captions?: VideoCaption[];
  allowDownload?: boolean;
  autoPlay?: boolean;
  className?: string;
  onPlay?: (position: number) => void;
  onPause?: (position: number) => void;
  onSeek?: (position: number) => void;
  onProgress?: (position: number, duration: number) => void;
  onComplete?: (duration: number) => void;
  onDownload?: () => void;
};

export function VideoPlayer({
  src,
  poster,
  title,
  captions = [],
  allowDownload = false,
  autoPlay = false,
  className,
  onPlay,
  onPause,
  onSeek,
  onProgress,
  onComplete,
  onDownload,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportedRef = useRef(0);
  const seekingRef = useRef(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setLoading(true);
    setError(null);
    lastReportedRef.current = 0;
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const scheduleHideControls = () => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 2500);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (video.paused) {
      void video.play().catch(() => setError("Playback failed. Try again."));
    } else {
      video.pause();
    }
  };

  const handleSeekInput = (value: number) => {
    setCurrentTime(value);
    seekingRef.current = true;
  };

  const handleSeekCommit = (value: number) => {
    const video = videoRef.current;
    seekingRef.current = false;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
    onSeek?.(value);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen().catch(() => undefined);
    }
  };

  const cycleVolumeIcon = useMemo(() => {
    if (muted || volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  }, [muted, volume]);
  const VolumeIcon = cycleVolumeIcon;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const defaultCaption = captions.find((c) => c.is_default) ?? captions[0];

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-black shadow-[var(--cms-shadow)]",
        className,
      )}
      onMouseMove={() => {
        setControlsVisible(true);
        scheduleHideControls();
      }}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
    >
      {!src ? (
        <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
          No video attached.
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={src}
            poster={poster ?? undefined}
            preload="metadata"
            autoPlay={autoPlay}
            className="aspect-video w-full bg-black"
            onClick={togglePlay}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration || 0);
              setLoading(false);
            }}
            onTimeUpdate={(event) => {
              if (seekingRef.current) return;
              const t = event.currentTarget.currentTime;
              setCurrentTime(t);
              if (t - lastReportedRef.current >= PROGRESS_REPORT_INTERVAL_SECONDS) {
                lastReportedRef.current = t;
                onProgress?.(t, event.currentTarget.duration || duration);
              }
            }}
            onPlay={(event) => {
              setIsPlaying(true);
              onPlay?.(event.currentTarget.currentTime);
              scheduleHideControls();
            }}
            onPause={(event) => {
              setIsPlaying(false);
              onPause?.(event.currentTarget.currentTime);
              setControlsVisible(true);
            }}
            onEnded={() => {
              setIsPlaying(false);
              setControlsVisible(true);
              onComplete?.(duration);
            }}
            onError={() => {
              setLoading(false);
              setError("This video could not be loaded.");
            }}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
          >
            {captions.map((caption) => (
              <track
                key={caption.id}
                kind="subtitles"
                src={caption.file_url}
                srcLang={caption.language}
                label={caption.label || caption.language}
                default={caption.id === defaultCaption?.id}
              />
            ))}
          </video>

          {!isPlaying ? (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play"
              className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-crimson text-crimson-foreground shadow-lg">
                <Play className="h-7 w-7 fill-current" />
              </span>
            </button>
          ) : null}

          {loading ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-x-0 top-0 bg-cat-rose/90 px-3 py-1.5 text-center text-xs font-medium text-white">
              {error}
            </div>
          ) : null}

          <div
            className={cn(
              "absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200",
              controlsVisible || !isPlaying ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-right text-[11px] text-white/90">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(event) => handleSeekInput(Number(event.target.value))}
                onMouseUp={(event) =>
                  handleSeekCommit(Number((event.target as HTMLInputElement).value))
                }
                onTouchEnd={(event) =>
                  handleSeekCommit(Number((event.target as HTMLInputElement).value))
                }
                onKeyUp={(event) =>
                  handleSeekCommit(Number((event.target as HTMLInputElement).value))
                }
                disabled={!duration}
                aria-label="Seek"
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-crimson disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(to right, var(--color-crimson) ${progressPercent}%, rgba(255,255,255,0.25) ${progressPercent}%)`,
                }}
              />
              <span className="w-10 shrink-0 text-[11px] text-white/90">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                  >
                    <VolumeIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(event) => {
                      const v = Number(event.target.value);
                      setVolume(v);
                      setMuted(v === 0);
                    }}
                    aria-label="Volume"
                    className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {title ? (
                  <span className="hidden truncate text-xs font-medium text-white/80 sm:inline">
                    {title}
                  </span>
                ) : null}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu((v) => !v)}
                    aria-label="Playback speed"
                    className="flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-white/90 hover:bg-white/15"
                  >
                    <Settings className="h-3.5 w-3.5" /> {rate}×
                  </button>
                  {showSpeedMenu ? (
                    <div className="absolute bottom-9 right-0 z-10 w-24 rounded-md border border-white/10 bg-black/90 p-1 shadow-lg">
                      {PLAYBACK_RATES.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setRate(option);
                            setShowSpeedMenu(false);
                          }}
                          className={cn(
                            "block w-full rounded px-2 py-1 text-left text-xs text-white/90 hover:bg-white/15",
                            option === rate && "bg-white/15 font-semibold",
                          )}
                        >
                          {option}×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {allowDownload && src ? (
                  <a
                    href={src}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onDownload?.()}
                    className={cn(
                      cmsGhostButton,
                      "h-8 border-white/20 text-white/90 hover:bg-white/15",
                    )}
                    aria-label="Download video"
                    title="Download"
                  >
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
