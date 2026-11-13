import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Copy,
  Eye,
  Mic,
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
  archivePodcastEpisode,
  deletePodcastEpisode,
  duplicatePodcastEpisode,
  formatDuration,
  listPodcastEpisodesAdmin,
  listPodcastShowsAdmin,
  type PodcastEpisode,
  type PodcastStatus,
} from "@/lib/podcast.functions";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const STATUS_OPTIONS: Array<{ value: PodcastStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "processing", label: "Processing" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
  { value: "failed", label: "Failed" },
];

export function PodcastsEpisodesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState<PodcastStatus | "all">("all");
  const [showId, setShowId] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pendingDelete, setPendingDelete] = useState<PodcastEpisode | null>(null);

  useEffect(() => setPage(1), [debouncedSearch, status, showId, category]);

  const showsQ = useQuery({
    queryKey: ["podcast-shows-lite"],
    queryFn: () => listPodcastShowsAdmin({ pageSize: 100, archived: "exclude" }),
  });

  const filters = {
    search: debouncedSearch || undefined,
    status,
    show_id: showId || null,
    category: category || null,
    archived: "exclude" as const,
    page,
    pageSize,
  };

  const episodesQ = useQuery({
    queryKey: ["podcast-episodes-admin", filters],
    queryFn: () => listPodcastEpisodesAdmin(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["podcast-episodes-admin"] });

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicatePodcastEpisode({ data: { id } }),
    onSuccess: () => {
      toast.success("Episode duplicated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archivePodcastEpisode({ data: { id } }),
    onSuccess: () => {
      toast.success("Episode archived");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePodcastEpisode({ data: { id } }),
    onSuccess: () => {
      toast.success("Episode deleted");
      setPendingDelete(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = episodesQ.data?.rows ?? [];
  const total = episodesQ.data?.total ?? 0;
  const shows = showsQ.data?.rows ?? [];
  const showTitleById = new Map(shows.map((s) => [s.id, s.title]));

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Episodes"
        description="Every episode in the newsroom, filterable by status, show, and category."
        actions={
          <Link to="/admin/podcasts/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create episode
          </Link>
        }
      />

      <CmsPanel>
        <FilterBar
          onClear={() => {
            setSearch("");
            setStatus("all");
            setShowId("");
            setCategory("");
          }}
        >
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${cmsInput} pl-9`}
                placeholder="Title, host, guest…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status">
            <select
              className={cmsInput}
              value={status}
              onChange={(e) => setStatus(e.target.value as PodcastStatus | "all")}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Show">
            <select className={cmsInput} value={showId} onChange={(e) => setShowId(e.target.value)}>
              <option value="">All shows</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.title}
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
            { key: "episode", header: "Episode" },
            { key: "show", header: "Show" },
            { key: "status", header: "Status" },
            { key: "duration", header: "Duration" },
            { key: "published", header: "Published" },
            { key: "plays", header: "Plays", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
          footer={
            total > 0 ? (
              <CmsPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            ) : null
          }
        >
          {!episodesQ.isLoading && rows.length === 0 ? (
            <DataTableEmpty
              colSpan={7}
              title="No episodes match these filters"
              description="Try clearing filters or create a new episode."
            />
          ) : null}
          {rows.map((episode) => (
            <DataTableRow key={episode.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {episode.artwork_url ? (
                      <img
                        src={episode.artwork_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Mic className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to="/admin/podcasts/$id"
                      params={{ id: episode.id }}
                      className="truncate font-medium hover:text-primary"
                    >
                      {episode.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {episode.host || "No host set"}
                    </div>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {episode.show_id ? (showTitleById.get(episode.show_id) ?? "—") : "—"}
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={episode.archived_at ? "archived" : episode.status} />
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {episode.duration || formatDuration(episode.duration_seconds) || "—"}
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {episode.published_at ? new Date(episode.published_at).toLocaleDateString() : "—"}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {episode.play_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      aria-label="Episode actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {episode.slug ? (
                      <DropdownMenuItem asChild>
                        <a href={`/podcast/${episode.slug}`} target="_blank" rel="noreferrer">
                          <Eye className="mr-2 h-3.5 w-3.5" /> View
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link to="/admin/podcasts/$id" params={{ id: episode.id }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicate.mutate(episode.id)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!episode.archived_at ? (
                      <DropdownMenuItem onClick={() => archive.mutate(episode.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-cat-rose"
                      onClick={() => setPendingDelete(episode)}
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
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the episode, its audio, and analytics. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete episode"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
