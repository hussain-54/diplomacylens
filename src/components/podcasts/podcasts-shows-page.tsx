import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PodcastShowForm } from "@/components/podcasts/podcasts-show-form";
import {
  archivePodcastShow,
  deletePodcastShow,
  listPodcastShowsAdmin,
  restorePodcastShow,
  type PodcastShow,
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

export function PodcastsShowsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingShowId, setEditingShowId] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<PodcastShow | null>(null);

  const filters = {
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : (status as PodcastStatus),
    archived: "exclude" as const,
    pageSize: 100,
  };

  const showsQ = useQuery({
    queryKey: ["podcast-shows-admin", filters],
    queryFn: () => listPodcastShowsAdmin(filters),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["podcast-shows-admin"] });
    void qc.invalidateQueries({ queryKey: ["podcast-shows-lite"] });
  };

  const archive = useMutation({
    mutationFn: (id: string) => archivePodcastShow({ data: { id } }),
    onSuccess: () => {
      toast.success("Show archived");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: (id: string) => restorePodcastShow({ data: { id } }),
    onSuccess: () => {
      toast.success("Show restored");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePodcastShow({ data: { id } }),
    onSuccess: () => {
      toast.success("Show deleted");
      setPendingDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = showsQ.data?.rows ?? [];

  const openCreate = () => {
    setEditingShowId(undefined);
    setFormOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingShowId(id);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Shows"
        description="Podcast shows are the parent series that group episodes together."
        actions={
          <button type="button" className={cmsButton} onClick={openCreate}>
            <Plus className="h-4 w-4" /> New show
          </button>
        }
      />

      <CmsPanel>
        <FilterBar
          onClear={() => {
            setSearch("");
            setStatus("all");
          }}
        >
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${cmsInput} pl-9`}
                placeholder="Title, host, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status">
            <select className={cmsInput} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {["draft", "scheduled", "published", "archived"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        <DataTable
          columns={[
            { key: "show", header: "Show" },
            { key: "host", header: "Host" },
            { key: "status", header: "Status" },
            { key: "episodes", header: "Episodes", align: "right" },
            { key: "plays", header: "Plays", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
        >
          {!showsQ.isLoading && rows.length === 0 ? (
            <DataTableEmpty
              colSpan={6}
              title="No shows yet"
              description="Create a show to start organizing episodes."
              action={
                <button type="button" className={cmsButton} onClick={openCreate}>
                  <Plus className="h-4 w-4" /> New show
                </button>
              }
            />
          ) : null}
          {rows.map((show) => (
            <DataTableRow key={show.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {show.cover_image_url ? (
                      <img
                        src={show.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Radio className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="truncate font-medium hover:text-primary"
                      onClick={() => openEdit(show.id)}
                    >
                      {show.title}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {show.category || "Uncategorized"}
                    </div>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {show.host || "—"}
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={show.archived_at ? "archived" : show.status} />
              </DataTableCell>
              <DataTableCell align="right" mono>
                {show.episode_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {show.play_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={cmsSecondaryButton} aria-label="Show actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {show.slug ? (
                      <DropdownMenuItem asChild>
                        <a href={`/podcast?show=${show.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" /> View
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => openEdit(show.id)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {show.archived_at ? (
                      <DropdownMenuItem onClick={() => restore.mutate(show.id)}>
                        <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => archive.mutate(show.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-cat-rose"
                      onClick={() => setPendingDelete(show)}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShowId ? "Edit show" : "New show"}</DialogTitle>
          </DialogHeader>
          <PodcastShowForm
            showId={editingShowId}
            onSaved={() => setFormOpen(false)}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the show. Episodes linked to it will remain but lose their
              show association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete show"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
