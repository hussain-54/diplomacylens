import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileWarning, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CmsPageHeader,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms-ui";
import {
  getMediaSettings,
  listMediaCategoryOptions,
  uploadMediaAsset,
} from "@/lib/media.functions";
import { detectAssetType, formatBytes, isAllowedMime } from "@/lib/dam";
import { optimizeImageFile } from "@/lib/optimize-image";
import { cn } from "@/lib/utils";

type QueueItem = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
  previewUrl?: string;
};

async function makeThumbnail(file: File, width: number, height: number, quality: number) {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) return null;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(width / bitmap.width, height / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", quality / 100),
    );
    if (!blob) return null;
    return new File([blob], `thumb-${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
    });
  } finally {
    bitmap.close?.();
  }
}

export function MediaUploadPage() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["media-settings"], queryFn: getMediaSettings });
  const categories = useQuery({
    queryKey: ["media-category-options"],
    queryFn: listMediaCategoryOptions,
  });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [meta, setMeta] = useState({
    alt_text: "",
    caption: "",
    description: "",
    credits: "",
    copyright: "",
    source: "",
    tags: "",
    category_id: "",
  });

  const settings = settingsQ.data;
  const accept = useMemo(() => {
    if (!settings) return undefined;
    return [
      ...settings.allowed_image_types,
      ...settings.allowed_video_types,
      ...settings.allowed_audio_types,
      ...settings.allowed_document_types,
    ].join(",");
  }, [settings]);

  const enqueue = (files: File[]) => {
    const limit = settings?.bulk_upload_limit ?? 20;
    const next = files.slice(
      0,
      Math.max(0, limit - queue.filter((q) => q.status !== "done").length),
    );
    setQueue((prev) => [
      ...prev,
      ...next.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        progress: 0,
        status: "queued" as const,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })),
    ]);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Media settings unavailable.");
      const pending = queue.filter((q) => q.status === "queued" || q.status === "error");
      for (const item of pending) {
        if (item.status === "cancelled") continue;
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "uploading", progress: 10, error: undefined } : q,
          ),
        );
        try {
          const mime = item.file.type || "application/octet-stream";
          const allowed = new Set([
            ...settings.allowed_image_types,
            ...settings.allowed_video_types,
            ...settings.allowed_audio_types,
            ...settings.allowed_document_types,
          ]);
          if (!allowed.has(mime) && !isAllowedMime(mime)) {
            throw new Error(`Unsupported file type: ${mime || item.file.name}`);
          }
          if (item.file.size > settings.max_upload_bytes) {
            throw new Error(`Exceeds max size of ${formatBytes(settings.max_upload_bytes)}`);
          }

          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: 35 } : q)));

          let uploadFile = item.file;
          let original: File | null = null;
          let width: number | null = null;
          let height: number | null = null;
          if (
            detectAssetType(mime) === "image" &&
            settings.auto_compress &&
            !mime.includes("svg")
          ) {
            original = settings.preserve_originals ? item.file : null;
            const optimized = await optimizeImageFile(item.file, {
              maxDimension: 1920,
              quality: settings.image_quality / 100,
            });
            uploadFile = settings.default_image_format === "original" ? item.file : optimized.file;
            width = optimized.width;
            height = optimized.height;
          }

          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: 60 } : q)));
          const thumbnail =
            settings.generate_thumbnails && detectAssetType(mime) === "image"
              ? await makeThumbnail(
                  item.file,
                  settings.thumbnail_width,
                  settings.thumbnail_height,
                  settings.image_quality,
                )
              : null;

          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: 80 } : q)));
          await uploadMediaAsset({
            data: {
              file: uploadFile,
              original,
              thumbnail,
              bucket: "media-library",
              width,
              height,
              alt_text: meta.alt_text || null,
              caption: meta.caption || null,
              description: meta.description || null,
              credits: meta.credits || null,
              copyright: meta.copyright || null,
              source: meta.source || null,
              tags: meta.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              category_id: meta.category_id || null,
            },
          });
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: "done", progress: 100 } : q)),
          );
        } catch (error) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: "error",
                    progress: 0,
                    error: error instanceof Error ? error.message : "Upload failed",
                  }
                : q,
            ),
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-assets-page"] });
      qc.invalidateQueries({ queryKey: ["media-counts"] });
      qc.invalidateQueries({ queryKey: ["media-storage"] });
    },
  });

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Upload Media"
        description="Drag and drop files or browse your device. Validation uses live media settings."
      />

      <div
        className={cn(
          "rounded-sm border-2 border-dashed px-6 py-16 text-center transition-colors",
          dragOver ? "border-crimson bg-crimson/5" : "border-border bg-muted/30",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          enqueue([...e.dataTransfer.files]);
        }}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-serif text-2xl text-ink">Drop files to upload</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Images, videos, audio, and documents · max{" "}
          {settings ? formatBytes(settings.max_upload_bytes) : "…"} · up to{" "}
          {settings?.bulk_upload_limit ?? "…"} files
        </p>
        <label className={`${cmsButton} mt-6 cursor-pointer`}>
          Browse files
          <input
            type="file"
            className="sr-only"
            multiple
            accept={accept}
            onChange={(e) => {
              enqueue([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <CmsPanel className="space-y-4 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Upload options
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["alt_text", "Alt text"],
              ["caption", "Caption"],
              ["credits", "Credits"],
              ["copyright", "Copyright"],
              ["source", "Source"],
              ["tags", "Tags (comma-separated)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <input
                className={cmsInput}
                value={meta[key]}
                onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Description</span>
            <textarea
              className={cmsInput}
              rows={3}
              value={meta.description}
              onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Category</span>
            <select
              className={cmsInput}
              value={meta.category_id}
              onChange={(e) => setMeta((m) => ({ ...m, category_id: e.target.value }))}
            >
              <option value="">None</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CmsPanel>

      {queue.length ? (
        <CmsPanel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Upload queue ({queue.length})</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={cmsSecondaryButton}
                onClick={() => setQueue((q) => q.filter((item) => item.status === "done"))}
              >
                Clear finished
              </button>
              <button
                type="button"
                className={cmsButton}
                disabled={
                  upload.isPending ||
                  !queue.some((q) => q.status === "queued" || q.status === "error")
                }
                onClick={() => upload.mutate()}
              >
                {upload.isPending ? "Uploading…" : "Start upload"}
              </button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-muted">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] uppercase text-muted-foreground">
                      {detectAssetType(item.file.type)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)} · {item.file.type || "unknown"}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all",
                        item.status === "error" ? "bg-crimson" : "bg-navy",
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  {item.error ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-crimson">
                      <FileWarning className="h-3.5 w-3.5" /> {item.error}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : null}
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {item.progress}%
                  </span>
                  {item.status === "queued" || item.status === "error" ? (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-crimson"
                      aria-label="Remove from queue"
                      onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CmsPanel>
      ) : null}
    </div>
  );
}
