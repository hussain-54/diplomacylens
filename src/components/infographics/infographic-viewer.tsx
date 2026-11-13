import { Download, Maximize2, Minimize2, Minus, Plus, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cmsGhostButton, cmsSecondaryButton } from "@/components/cms-ui";
import { cn } from "@/lib/utils";

function isPdfAsset(url: string | null | undefined, fileFormat?: string | null) {
  if (fileFormat) return fileFormat.toLowerCase() === "pdf";
  return /\.pdf(\?|#|$)/i.test(url ?? "");
}

export function InfographicViewer({
  assetUrl,
  fileFormat,
  altText,
  allowDownload = true,
  onZoom,
  onFullscreen,
  onDownload,
  onShare,
  className,
  height = "min(80vh, 900px)",
}: {
  assetUrl: string | null | undefined;
  fileFormat?: string | null;
  altText?: string | null;
  allowDownload?: boolean;
  onZoom?: (zoom: number) => void;
  onFullscreen?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  className?: string;
  height?: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPdf = isPdfAsset(assetUrl, fileFormat);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const changeZoom = (next: number) => {
    const bounded = Math.min(300, Math.max(50, next));
    setZoom(bounded);
    onZoom?.(bounded);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen().catch(() => {});
      onFullscreen?.();
    }
  };

  const handleDownload = () => {
    if (onDownload) onDownload();
    if (assetUrl) window.open(assetUrl, "_blank", "noopener,noreferrer");
  };

  const handleShare = () => {
    if (onShare) onShare();
    if (typeof navigator !== "undefined" && navigator.share && assetUrl) {
      void navigator.share({ url: assetUrl }).catch(() => {});
    } else if (assetUrl) {
      void navigator.clipboard?.writeText(assetUrl);
    }
  };

  if (!assetUrl) {
    return (
      <div
        className={cn(
          "flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
      >
        No asset attached to this infographic.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        isFullscreen && "bg-background",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cmsGhostButton}
            onClick={() => changeZoom(zoom - 25)}
            disabled={isPdf}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs text-muted-foreground">{zoom}%</span>
          <button
            type="button"
            className={cmsGhostButton}
            onClick={() => changeZoom(zoom + 25)}
            disabled={isPdf}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={cmsGhostButton}
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" className={cmsGhostButton} onClick={handleShare} aria-label="Share">
            <Share2 className="h-4 w-4" />
          </button>
          {allowDownload ? (
            <button type="button" className={cmsSecondaryButton} onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="flex-1 overflow-auto bg-muted/40"
        style={{ height: isFullscreen ? "calc(100vh - 49px)" : height }}
      >
        {isPdf ? (
          <iframe
            src={assetUrl}
            title={altText ?? "Infographic PDF"}
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex min-h-full items-center justify-center p-4">
            <img
              src={assetUrl}
              alt={altText ?? ""}
              className="max-w-none transition-[width] duration-150"
              style={{ width: `${zoom}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
