import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileWarning, Pencil, RotateCcw, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CmsPageHeader, CmsPanel, cmsButton, cmsSecondaryButton } from "@/components/cms";
import { formatBytes } from "@/lib/dam";
import { uploadEpaperPdf, validatePdfFile, type EpaperEditionRow } from "@/lib/epaper.functions";
import { cn } from "@/lib/utils";

type QueueStatus = "queued" | "uploading" | "processing" | "ready" | "error" | "cancelled";

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
  edition?: EpaperEditionRow;
};

export function EpaperUploadPage({ editionId }: { editionId?: string } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const enqueue = (files: File[]) => {
    const pdfs = files.filter((file) => {
      try {
        validatePdfFile(file);
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Invalid file");
        return false;
      }
    });
    setQueue((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        status: "queued" as const,
        progress: 0,
      })),
    ]);
  };

  const processItem = async (item: QueueItem) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === item.id ? { ...q, status: "uploading", progress: 20, error: undefined } : q,
      ),
    );
    try {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, progress: 55, status: "processing" } : q)),
      );
      const result = await uploadEpaperPdf({
        data: { file: item.file, edition_id: editionId || undefined },
      });
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "ready", progress: 100, edition: result.edition } : q,
        ),
      );
      void qc.invalidateQueries({ queryKey: ["epaper-editions-admin"] });
      void qc.invalidateQueries({ queryKey: ["epaper-dashboard"] });
      if (editionId) void qc.invalidateQueries({ queryKey: ["epaper-edition", editionId] });
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
        title={editionId ? "Replace PDF" : "Upload Edition"}
        description={
          editionId
            ? "Upload a new PDF for this edition. Previous versions stay available in history."
            : "Drag and drop a PDF, or browse your device. A new edition is created automatically."
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
        <p className="mt-4 font-serif text-2xl text-foreground">Drop a PDF to upload</p>
        <p className="mt-2 text-sm text-muted-foreground">PDF files only · up to 100 MB</p>
        <label className={`${cmsButton} mt-6 cursor-pointer`}>
          Browse files
          <input
            type="file"
            className="sr-only"
            accept="application/pdf,.pdf"
            multiple={!editionId}
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                  PDF
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
                  {item.status === "ready" && item.edition ? (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-primary"
                      aria-label="Edit edition"
                      onClick={() =>
                        navigate({ to: "/admin/epaper/$id", params: { id: item.edition!.id } })
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
          <Link to="/admin/epaper/editions" className={cmsSecondaryButton}>
            Go to editions
          </Link>
        </div>
      ) : null}
    </div>
  );
}
