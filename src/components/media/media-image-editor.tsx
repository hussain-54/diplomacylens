import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Scissors } from "lucide-react";
import { cmsButton, cmsSecondaryButton } from "@/components/cms-ui";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl: string;
  /** Prefer storage download to avoid CORS tainting the canvas. */
  bucket?: string;
  objectPath?: string;
  fileName: string;
  onExport: (file: File, mode: "replace" | "new") => void;
  busy?: boolean;
};

type CropRect = { x: number; y: number; w: number; h: number } | null;

async function loadImageBlob(
  imageUrl: string,
  bucket?: string,
  objectPath?: string,
): Promise<Blob> {
  if (bucket && objectPath) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (!error && data) return data;
  }

  try {
    const res = await fetch(imageUrl, { mode: "cors", credentials: "omit" });
    if (res.ok) return await res.blob();
  } catch {
    // Fall through to Image decode.
  }

  // Last resort: decode via Image + canvas (requires CORS headers on the asset).
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare image canvas."));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((out) => {
          if (out) resolve(out);
          else reject(new Error("Could not decode image for editing (CORS)."));
        }, "image/png");
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Could not decode image for editing (CORS)."));
      }
    };
    img.onerror = () => reject(new Error("Could not load image for editing."));
    img.src = imageUrl;
  });
  return blob;
}

export function MediaImageEditor({
  imageUrl,
  bucket,
  objectPath,
  fileName,
  onExport,
  busy,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState<CropRect>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const blob = await loadImageBlob(imageUrl, bucket, objectPath);
        const bmp = await createImageBitmap(blob);
        if (!cancelled) {
          setBitmap(bmp);
          setRotation(0);
          setFlipH(false);
          setFlipV(false);
          setCrop(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load image");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, bucket, objectPath]);

  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rad = ((rotation % 360) * Math.PI) / 180;
    const swapped = Math.abs(rotation % 180) === 90;
    const w = swapped ? bitmap.height : bitmap.width;
    const h = swapped ? bitmap.width : bitmap.height;
    canvas.width = w;
    canvas.height = h;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();

    if (crop && crop.w > 4 && crop.h > 4) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, w, h);
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      // redraw crop region on top
      ctx.save();
      ctx.beginPath();
      ctx.rect(crop.x, crop.y, crop.w, crop.h);
      ctx.clip();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      ctx.restore();
    }
  }, [bitmap, rotation, flipH, flipV, crop]);

  const pointerPos = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y)),
    };
  };

  const exportCanvas = async (mode: "replace" | "new") => {
    if (!bitmap || !canvasRef.current) return;
    const source = canvasRef.current;
    let out: HTMLCanvasElement = source;

    if (crop && crop.w > 4 && crop.h > 4) {
      const cropped = document.createElement("canvas");
      cropped.width = Math.round(crop.w);
      cropped.height = Math.round(crop.h);
      const cctx = cropped.getContext("2d");
      if (!cctx) return;
      // Draw without overlay: rebuild transformed image then crop
      const tmp = document.createElement("canvas");
      const rad = ((rotation % 360) * Math.PI) / 180;
      const swapped = Math.abs(rotation % 180) === 90;
      tmp.width = swapped ? bitmap.height : bitmap.width;
      tmp.height = swapped ? bitmap.width : bitmap.height;
      const tctx = tmp.getContext("2d");
      if (!tctx) return;
      tctx.translate(tmp.width / 2, tmp.height / 2);
      tctx.rotate(rad);
      tctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      cctx.drawImage(tmp, crop.x, crop.y, crop.w, crop.h, 0, 0, cropped.width, cropped.height);
      out = cropped;
    } else {
      // Rebuild without crop overlay
      const tmp = document.createElement("canvas");
      const rad = ((rotation % 360) * Math.PI) / 180;
      const swapped = Math.abs(rotation % 180) === 90;
      tmp.width = swapped ? bitmap.height : bitmap.width;
      tmp.height = swapped ? bitmap.width : bitmap.height;
      const tctx = tmp.getContext("2d");
      if (!tctx) return;
      tctx.translate(tmp.width / 2, tmp.height / 2);
      tctx.rotate(rad);
      tctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      out = tmp;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob(resolve, "image/webp", 0.92),
    );
    if (!blob) {
      setError("Could not export edited image.");
      return;
    }
    const base = fileName.replace(/\.[^.]+$/, "") || "edited-image";
    const file = new File([blob], `${base}-edited.webp`, { type: "image/webp" });
    onExport(file, mode);
  };

  return (
    <div className="space-y-3 rounded-sm border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Image editor</h3>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={cmsSecondaryButton}
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cmsSecondaryButton}
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button type="button" className={cmsSecondaryButton} onClick={() => setFlipH((v) => !v)}>
            <FlipHorizontal2 className="h-4 w-4" />
          </button>
          <button type="button" className={cmsSecondaryButton} onClick={() => setFlipV((v) => !v)}>
            <FlipVertical2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              cmsSecondaryButton,
              cropMode && "border-foreground bg-foreground text-background",
            )}
            onClick={() => {
              setCropMode((v) => !v);
              setCrop(null);
            }}
          >
            <Scissors className="h-4 w-4" /> Crop
          </button>
        </div>
      </div>

      {loading ? <div className="aspect-video animate-pulse bg-muted" /> : null}
      {error ? <p className="text-xs text-crimson">{error}</p> : null}

      {!loading && !error ? (
        <canvas
          ref={canvasRef}
          className="max-h-72 w-full cursor-crosshair border border-border bg-muted object-contain"
          onPointerDown={(event) => {
            if (!cropMode) return;
            const p = pointerPos(event);
            setDragStart(p);
            setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!cropMode || !dragStart) return;
            const p = pointerPos(event);
            setCrop({
              x: Math.min(dragStart.x, p.x),
              y: Math.min(dragStart.y, p.y),
              w: Math.abs(p.x - dragStart.x),
              h: Math.abs(p.y - dragStart.y),
            });
          }}
          onPointerUp={() => setDragStart(null)}
        />
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Rotate, flip, or drag a crop region. Save as a new asset (keeps original) or replace the
        current file.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cmsSecondaryButton}
          disabled={busy || loading || !!error}
          onClick={() => void exportCanvas("new")}
        >
          Save as new
        </button>
        <button
          type="button"
          className={cmsButton}
          disabled={busy || loading || !!error}
          onClick={() => {
            if (window.confirm("Replace the original file with this edit?")) {
              void exportCanvas("replace");
            }
          }}
        >
          Replace original
        </button>
      </div>
    </div>
  );
}
