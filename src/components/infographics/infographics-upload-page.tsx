import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileWarning, ImagePlus, Pencil, RotateCcw, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CmsPageHeader, CmsPanel, cmsButton, cmsSecondaryButton } from "@/components/cms";
import { formatBytes } from "@/lib/dam";
import {
  uploadInfographicAsset,
  validateInfographicFile,
  type Infographic,
} from "@/lib/infographics.functions";
import { cn } from "@/lib/utils";

type QueueStatus = "queued" | "uploading" | "processing" | "ready" | "error";

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
  item?: Infographic;
};

export function InfographicsUploadPage({ infographicId }: { infographicId?: string } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const enqueue = (files: File[]) => {
    const valid = files.filter((file) => {
      try {
        validateInfographicFile(file);
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Invalid file");
        return false;
      }
    });
    setQueue((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        status: "queued" as const,
        progress: 0,
      })),
    ]);
  };

  const processItem = async (queued: QueueItem) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === queued.id ? { ...q, status: "uploading", progress: 25, error: undefined } : q,
      ),
    );
    try {
      setQueue((prev) =>
        prev.map((q) => (q.id === queued.id ? { ...q, progress: 60, status: "processing" } : q)),
      );
      const result = await uploadInfographicAsset({
        data: { file: queued.file, infographic_id: infographicId || undefined },
      });
      setQueue((prev) =>
        prev.map((q) =>
          q.id === queued.id ? { ...q, status: "ready", progress: 100, item: result.item } : q,
        ),
      );
      void qc.invalidateQueries({ queryKey: ["infographics-library-admin"] });
      void qc.invalidateQueries({ queryKey: ["infographics-dashboard"] });
      if (infographicId)
        void qc.invalidateQueries({ queryKey: ["infographic-admin", infographicId] });
    } catch (error) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === queued.id
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
  };

  const upload = useMutation({
    mutationFn: async () => {
      const pending = queue.filter((item) => item.status === "queued" || item.status === "error");
      for (const item of pending) {
        // eslint-disable-next-line no-await-in-loop
        await processItem(item);
      }
    },
  });

  const remove = (id: string) => setQueue((prev) => prev.filter((item) => item.id !== id));
  const retry = (item: QueueItem) => void processItem(item);

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title={infographicId ? "Replace asset" : "Upload Infographic"}
        description={
          infographicId
            ? "Upload a new image or PDF for this infographic."
            : "Drag and drop images or PDFs. A new infographic is created automatically for each file."
        }
      />

      <div
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          enqueue([...event.dataTransfer.files]);
        }}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-serif text-2xl text-foreground">Drop an image or PDF to upload</p>
        <p className="mt-2 text-sm text-muted-foreground">
          PNG, JPG, WebP, SVG, or PDF · up to 50 MB
        </p>
        <label className={`${cmsButton} mt-6 cursor-pointer`}>
          Browse files
          <input
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
            multiple={!infographicId}
            onChange={(event) => {
              enqueue([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {queue.length ? (
        <CmsPanel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Upload queue ({queue.length})</h2>
            <button
              type="button"
              className={cmsButton}
              disabled={
                upload.isPending ||
                !queue.some((item) => item.status === "queued" || item.status === "error")
              }
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? "Uploading…" : "Start upload"}
            </button>
          </div>
          <ul className="divide-y divide-border">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                  {item.file.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(item.file)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)} ·{" "}
                    {item.status === "uploading"
                      ? "Uploading…"
                      : item.status === "processing"
                        ? "Processing…"
                        : item.status === "ready"
                          ? "Ready"
                          : item.status === "error"
                            ? "Failed"
                            : "Queued"}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all",
                        item.status === "error"
                          ? "bg-cat-rose"
                          : item.status === "ready"
                            ? "bg-cat-green"
                            : "bg-primary",
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  {item.error ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-cat-rose">
                      <FileWarning className="h-3.5 w-3.5" /> {item.error}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.status === "ready" ? (
                    <CheckCircle2 className="h-5 w-5 text-cat-green" />
                  ) : null}
                  {item.status === "error" ? (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Retry upload"
                      onClick={() => retry(item)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : null}
                  {item.status === "ready" && item.item ? (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-primary"
                      aria-label="Edit infographic"
                      onClick={() =>
                        navigate({ to: "/admin/infographics/$id", params: { id: item.item!.id } })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : null}
                  {item.status === "queued" || item.status === "error" ? (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-cat-rose"
                      aria-label="Remove from queue"
                      onClick={() => remove(item.id)}
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

      {queue.some((item) => item.status === "ready") ? (
        <div className="flex justify-end">
          <Link to="/admin/infographics/library" className={cmsSecondaryButton}>
            Go to library
          </Link>
        </div>
      ) : null}
    </div>
  );
}
