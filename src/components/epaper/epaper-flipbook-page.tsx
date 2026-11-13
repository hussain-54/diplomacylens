import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  StatusBadge,
  cmsButton,
  cmsSecondaryButton,
  cmsInput,
} from "@/components/cms";
import { PdfViewer } from "@/components/epaper/pdf-viewer";
import {
  listEpaperEditionsAdmin,
  reprocessEpaperEdition,
  setEpaperPublishState,
} from "@/lib/epaper.functions";
import { cn } from "@/lib/utils";

export function EpaperFlipbookPage({ editionId }: { editionId?: string } = {}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(editionId ?? null);

  const listQ = useQuery({
    queryKey: ["epaper-editions-flipbook-list", search],
    queryFn: () =>
      listEpaperEditionsAdmin({ search: search || undefined, archived: "exclude", pageSize: 50 }),
  });

  useEffect(() => {
    if (editionId) setSelectedId(editionId);
  }, [editionId]);

  useEffect(() => {
    if (!selectedId && listQ.data?.rows.length) {
      setSelectedId(listQ.data.rows[0].id);
    }
  }, [listQ.data, selectedId]);

  const selected = listQ.data?.rows.find((row) => row.id === selectedId) ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["epaper-editions-flipbook-list"] });

  const regenerate = useMutation({
    mutationFn: (id: string) => reprocessEpaperEdition({ data: { id } }),
    onSuccess: () => {
      toast.success("Flipbook assets regenerated");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const togglePublish = useMutation({
    mutationFn: (vars: { id: string; status: "published" | "draft" }) =>
      setEpaperPublishState({ data: vars }),
    onSuccess: (row) => {
      toast.success(row.status === "published" ? "Edition published" : "Edition unpublished");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Flipbook Viewer"
        description="Preview any edition exactly as readers will see it, and manage its PDF."
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <CmsPanel className="overflow-hidden">
          <div className="border-b border-border/70 p-3">
            <input
              className={cmsInput}
              placeholder="Search editions…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {(listQ.data?.rows ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left cms-transition hover:bg-accent/60",
                    selectedId === row.id && "bg-accent",
                  )}
                >
                  <div className="h-10 w-8 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                    {row.cover_image_url ? (
                      <img
                        src={row.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{row.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.published_at ? new Date(row.published_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <StatusBadge status={row.archived_at ? "archived" : row.status} />
                </button>
              </li>
            ))}
            {!listQ.isLoading && (listQ.data?.rows.length ?? 0) === 0 ? (
              <li>
                <CmsEmptyState title="No editions" description="Upload a PDF to preview it here." />
              </li>
            ) : null}
          </ul>
        </CmsPanel>

        <div className="space-y-4">
          {!selected ? (
            <CmsPanel>
              <CmsEmptyState
                title="Select an edition"
                description="Choose an edition from the list to open the viewer."
              />
            </CmsPanel>
          ) : (
            <>
              <CmsPanel
                title={selected.title}
                description={selected.issue_number ? `Issue ${selected.issue_number}` : undefined}
              >
                <div className="flex flex-wrap items-center gap-2 p-4">
                  <StatusBadge status={selected.archived_at ? "archived" : selected.status} />
                  <Link
                    to="/admin/epaper/$id"
                    params={{ id: selected.id }}
                    className={cmsSecondaryButton}
                  >
                    Edit edition
                  </Link>
                  <Link
                    to="/admin/epaper/upload"
                    search={{ edition: selected.id }}
                    className={cmsSecondaryButton}
                  >
                    <Upload className="h-4 w-4" /> Replace PDF
                  </Link>
                  <button
                    type="button"
                    className={cmsSecondaryButton}
                    disabled={regenerate.isPending || !selected.pdf_url}
                    onClick={() => regenerate.mutate(selected.id)}
                  >
                    <RefreshCw className={cn("h-4 w-4", regenerate.isPending && "animate-spin")} />{" "}
                    Regenerate
                  </button>
                  <button
                    type="button"
                    className={cmsButton}
                    disabled={togglePublish.isPending}
                    onClick={() =>
                      togglePublish.mutate({
                        id: selected.id,
                        status: selected.status === "published" ? "draft" : "published",
                      })
                    }
                  >
                    {selected.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </CmsPanel>
              {regenerate.error ? <CmsAlert>{regenerate.error.message}</CmsAlert> : null}
              <PdfViewer
                pdfUrl={selected.pdf_url}
                pageCount={selected.page_count}
                allowDownload={selected.allow_download}
                allowPrint={selected.allow_print}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
