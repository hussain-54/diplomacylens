import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Copy,
  Eye,
  Film,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CmsPageHeader,
  CmsPanel,
  StatusBadge,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { CmsPagination } from "@/components/cms/pagination";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
import { FilterBar, FilterField } from "@/components/cms/filter-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  archiveVideo,
  deleteVideoFull,
  duplicateVideo,
  formatDuration,
  listVideosAdmin,
  type VideoRow,
  type VideoStatus,
} from "@/lib/video.functions";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const STATUS_OPTIONS: Array<{ value: VideoStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "processing", label: "Processing" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
  { value: "failed", label: "Failed" },
];

export function VideosLibraryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState<VideoStatus | "all">("all");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pendingDelete, setPendingDelete] = useState<VideoRow | null>(null);

  useEffect(() => setPage(1), [debouncedSearch, status, category]);

  const filters = {
    search: debouncedSearch || undefined,
    status,
    category: category || null,
    archived: "exclude" as const,
    page,
    pageSize,
  };

  const videosQ = useQuery({
    queryKey: ["videos-admin", filters],
    queryFn: () => listVideosAdmin(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["videos-admin"] });

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateVideo({ data: { id } }),
    onSuccess: () => {
      toast.success("Video duplicated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveVideo({ data: { id } }),
    onSuccess: () => {
      toast.success("Video archived");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteVideoFull({ data: { id } }),
    onSuccess: () => {
      toast.success("Video deleted");
      setPendingDelete(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = videosQ.data?.rows ?? [];
  const total = videosQ.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Library"
        description="Every video in the newsroom, filterable by status and category."
        actions={
          <Link to="/admin/videos/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create video
          </Link>
        }
      />

      <CmsPanel>
        <FilterBar
          onClear={() => {
            setSearch("");
            setStatus("all");
            setCategory("");
          }}
        >
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${cmsInput} pl-9`}
                placeholder="Title, author, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status">
            <select
              className={cmsInput}
              value={status}
              onChange={(e) => setStatus(e.target.value as VideoStatus | "all")}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Category">
            <input
              className={cmsInput}
              placeholder="e.g. Diplomacy"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={[
            { key: "video", header: "Video" },
            { key: "status", header: "Status" },
            { key: "duration", header: "Duration" },
            { key: "published", header: "Published" },
            { key: "views", header: "Views", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
          footer={
            total > 0 ? (
              <CmsPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            ) : null
          }
        >
          {!videosQ.isLoading && rows.length === 0 ? (
            <DataTableEmpty
              colSpan={6}
              title="No videos match these filters"
              description="Try clearing filters or create a new video."
            />
          ) : null}
          {rows.map((video) => (
            <DataTableRow key={video.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to="/admin/videos/$id"
                      params={{ id: video.id }}
                      className="truncate font-medium hover:text-primary"
                    >
                      {video.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {video.category || "Uncategorized"}
                    </div>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={video.archived_at ? "archived" : video.status} />
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {video.duration || formatDuration(video.duration_seconds) || "—"}
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {video.published_at ? new Date(video.published_at).toLocaleDateString() : "—"}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {video.view_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={cmsSecondaryButton} aria-label="Video actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {video.slug ? (
                      <DropdownMenuItem asChild>
                        <a href={`/video/${video.slug}`} target="_blank" rel="noreferrer">
                          <Eye className="mr-2 h-3.5 w-3.5" /> View
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link to="/admin/videos/$id" params={{ id: video.id }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicate.mutate(video.id)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!video.archived_at ? (
                      <DropdownMenuItem onClick={() => archive.mutate(video.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-cat-rose"
                      onClick={() => setPendingDelete(video)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      </CmsPanel>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the video, its file, and analytics. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete video"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
