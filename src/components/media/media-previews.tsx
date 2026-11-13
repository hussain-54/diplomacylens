import { FileAudio, FileText, Film, Image as ImageIcon, Play } from "lucide-react";
import type { MediaAssetRow } from "@/lib/media.functions";
import { formatBytes } from "@/lib/dam";
import { cn } from "@/lib/utils";

export function MediaAssetPreview({
  asset,
  className,
}: {
  asset: MediaAssetRow;
  className?: string;
}) {
  const src = asset.thumbnail_url || asset.public_url;
  if (asset.asset_type === "image") {
    return (
      <img
        src={src}
        alt={asset.alt_text || asset.file_name}
        className={className ?? "h-full w-full object-cover"}
        loading="lazy"
      />
    );
  }
  if (asset.asset_type === "video") {
    return (
      <div className="relative h-full w-full bg-navy">
        <video
          src={asset.public_url}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-crimson text-crimson-foreground shadow">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </span>
      </div>
    );
  }
  if (asset.asset_type === "audio") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4">
        <FileAudio className="h-8 w-8 text-muted-foreground" />
        <div className="h-8 w-4/5 rounded-sm bg-border/80" aria-hidden />
      </div>
    );
  }
  const mime = asset.mime_type || "";
  const isPdf = mime.includes("pdf");
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center">
      <FileText className="h-8 w-8 text-muted-foreground" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {isPdf ? "PDF" : mime.split("/").pop() || "FILE"}
      </span>
    </div>
  );
}

export function MediaTypeIcon({ type }: { type: MediaAssetRow["asset_type"] }) {
  if (type === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (type === "video") return <Film className="h-3.5 w-3.5" />;
  if (type === "audio") return <FileAudio className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export function MediaAssetMetaLine({ asset }: { asset: MediaAssetRow }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
      <span className="uppercase">{asset.asset_type}</span>
      <span aria-hidden>·</span>
      <span>{formatBytes(asset.size_bytes)}</span>
    </div>
  );
}

export function formatCount(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function selectionBarClass(active: boolean) {
  return cn(
    "sticky bottom-4 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-sm border border-border bg-card px-4 py-3 shadow-lg",
    !active && "hidden",
  );
}
