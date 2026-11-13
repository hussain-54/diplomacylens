import {
  Download,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cmsGhostButton, cmsSecondaryButton } from "@/components/cms-ui";
import { cn } from "@/lib/utils";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const VOLUME_KEY = "dl_podcast_volume";
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

export type AudioPlayerProps = {
  src: string | null | undefined;
  title?: string;
  artworkUrl?: string | null;
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

export function AudioPlayer({
  src,
  title,
  artworkUrl,
  allowDownload = true,
  autoPlay = false,
  className,
  onPlay,
  onPause,
  onSeek,
  onProgress,
  onComplete,
  onDownload,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastReportedRef = useRef(0);
  const seekingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setLoading(true);
    setError(null);
    lastReportedRef.current = 0;
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      void audio.play().catch(() => setError("Playback failed. Try again."));
    } else {
      audio.pause();
    }
  };

  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.min(Math.max(0, audio.currentTime + delta), duration);
    audio.currentTime = next;
    setCurrentTime(next);
    onSeek?.(next);
  };

  const handleSeekInput = (value: number) => {
    setCurrentTime(value);
    seekingRef.current = true;
  };

  const handleSeekCommit = (value: number) => {
    const audio = audioRef.current;
    seekingRef.current = false;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
    onSeek?.(value);
  };

  const cycleVolumeIcon = useMemo(() => {
    if (muted || volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  }, [muted, volume]);
  const VolumeIcon = cycleVolumeIcon;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--cms-shadow)]",
        className,
      )}
    >
      {!src ? (
        <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
          No audio attached to this episode.
        </div>
      ) : (
        <>
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            autoPlay={autoPlay}
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
            }}
            onPause={(event) => {
              setIsPlaying(false);
              onPause?.(event.currentTarget.currentTime);
            }}
            onEnded={() => {
              setIsPlaying(false);
              onComplete?.(duration);
            }}
            onError={() => {
              setLoading(false);
              setError("This audio file could not be loaded.");
            }}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
          />

          <div className="flex items-center gap-3">
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              {title ? (
                <div className="truncate text-sm font-semibold text-foreground">{title}</div>
              ) : null}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="cms-metric">{formatTime(currentTime)}</span>
                <span aria-hidden>/</span>
                <span className="cms-metric">
                  {loading && !duration ? "…" : formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          {error ? <p className="text-xs text-cat-rose">{error}</p> : null}

          <div className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground">
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
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${progressPercent}%, var(--color-muted) ${progressPercent}%)`,
              }}
            />
            <span className="w-9 shrink-0 text-[11px] text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={cmsGhostButton}
                onClick={() => skip(-15)}
                aria-label="Rewind 15 seconds"
                title="Rewind 15s"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cn(cmsSecondaryButton, "h-10 w-10 justify-center rounded-full p-0")}
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </button>
              <button
                type="button"
                className={cmsGhostButton}
                onClick={() => skip(15)}
                aria-label="Forward 15 seconds"
                title="Forward 15s"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={cmsGhostButton}
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? "Unmute" : "Mute"}
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
                  className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
              </div>

              <select
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                aria-label="Playback speed"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground outline-none focus:border-ring"
              >
                {PLAYBACK_RATES.map((option) => (
                  <option key={option} value={option}>
                    {option}×
                  </option>
                ))}
              </select>

              {allowDownload ? (
                <a
                  href={src}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onDownload?.()}
                  className={cmsGhostButton}
                  aria-label="Download episode"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
