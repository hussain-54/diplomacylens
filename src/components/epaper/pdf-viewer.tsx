import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Printer,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cmsGhostButton, cmsSecondaryButton } from "@/components/cms-ui";
import { cn } from "@/lib/utils";

export function PdfViewer({
  pdfUrl,
  pageCount,
  initialPage = 1,
  allowDownload = true,
  allowPrint = true,
  onPageChange,
  onDownload,
  onPrint,
  onShare,
  className,
  height = "min(82vh, 920px)",
}: {
  pdfUrl: string | null | undefined;
  pageCount?: number | null;
  initialPage?: number;
  allowDownload?: boolean;
  allowPrint?: boolean;
  onPageChange?: (page: number) => void;
  onDownload?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  className?: string;
  height?: string;
}) {
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [zoom, setZoom] = useState(100);
  const [pageInput, setPageInput] = useState(String(Math.max(1, initialPage)));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPage(Math.max(1, initialPage)), [initialPage]);
  useEffect(() => setPageInput(String(page)), [page]);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const src = useMemo(() => {
    if (!pdfUrl) return null;
    const base = pdfUrl.split("#")[0];
    return `${base}#page=${page}&zoom=${zoom}&view=FitH`;
  }, [pdfUrl, page, zoom]);

  const goToPage = (next: number) => {
    const bounded = pageCount ? Math.min(Math.max(1, next), pageCount) : Math.max(1, next);
    setPage(bounded);
    onPageChange?.(bounded);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share && pdfUrl) {
      void navigator.share({ url: pdfUrl }).catch(() => {});
    } else if (pdfUrl) {
      void navigator.clipboard?.writeText(pdfUrl);
    }
  };

  if (!pdfUrl) {
    return (
      <div
        className={cn(
          "flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
      >
        No PDF attached to this edition.
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
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <form
            className="flex items-center gap-1 text-xs text-muted-foreground"
            onSubmit={(event) => {
              event.preventDefault();
              goToPage(Number(pageInput) || 1);
            }}
          >
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => goToPage(Number(pageInput) || 1)}
              className="h-7 w-12 rounded-md border border-input bg-background px-1.5 text-center text-xs outline-none focus:border-ring"
              inputMode="numeric"
              aria-label="Page number"
            />
            <span>/ {pageCount ?? "—"}</span>
          </form>
          <button
            type="button"
            className={cmsGhostButton}
            onClick={() => goToPage(page + 1)}
            disabled={!!pageCount && page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={cmsGhostButton}
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs text-muted-foreground">{zoom}%</span>
          <button
            type="button"
            className={cmsGhostButton}
            onClick={() => setZoom((z) => Math.min(300, z + 25))}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cmsGhostButton}
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {allowPrint ? (
            <button
              type="button"
              className={cmsGhostButton}
              onClick={handlePrint}
              aria-label="Print"
            >
              <Printer className="h-4 w-4" />
            </button>
          ) : null}
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
        className="flex-1 bg-muted/40"
        style={{ height: isFullscreen ? "calc(100vh - 49px)" : height }}
      >
        <iframe
          key={src}
          src={src ?? undefined}
          title="PDF viewer"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
