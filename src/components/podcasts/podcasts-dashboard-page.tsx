import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  Clock,
  Copy,
  Eye,
  Headphones,
  ListMusic,
  Mic,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Radio,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsPageHeader,
  CmsPageSkeleton,
  CmsPanel,
  MetricCard,
  StatusBadge,
  cmsButton,
  cmsSecondaryButton,
} from "@/components/cms";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
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
  getPodcastDashboard,
  type PodcastEpisode,
} from "@/lib/podcast.functions";

export function PodcastsDashboardPage() {
  const qc = useQueryClient();
  const snapshot = useQuery({
    queryKey: ["podcasts-dashboard"],
    queryFn: getPodcastDashboard,
    staleTime: 20_000,
  });
  const [pendingDelete, setPendingDelete] = useState<PodcastEpisode | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["podcasts-dashboard"] });

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

  if (snapshot.isLoading) return <CmsPageSkeleton metrics={8} panels={2} />;

  const kpis = snapshot.data?.kpis;
  const recent = snapshot.data?.recent ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow="Content · Podcasts"
        title="Podcasts dashboard"
        description="Live show and episode counts, listener engagement, and recent publishing activity."
      />

      {snapshot.error ? <CmsAlert>{snapshot.error.message}</CmsAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Shows" value={kpis?.totalShows ?? 0} icon={Radio} />
        <MetricCard label="Total Episodes" value={kpis?.totalEpisodes ?? 0} icon={Mic} />
        <MetricCard label="Published" value={kpis?.published ?? 0} icon={Play} />
        <MetricCard label="Draft" value={kpis?.draft ?? 0} icon={Pencil} />
        <MetricCard label="Scheduled" value={kpis?.scheduled ?? 0} icon={Clock} />
        <MetricCard label="Total Plays" value={kpis?.totalPlays ?? 0} icon={Headphones} />
        <MetricCard label="Unique Listeners" value={kpis?.uniqueListeners ?? 0} icon={Users} />
        <MetricCard label="New This Month" value={kpis?.episodesThisMonth ?? 0} icon={Eye} />
      </div>

      <CmsPanel title="Quick actions">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/admin/podcasts/upload" className={cmsSecondaryButton}>
            <Upload className="h-4 w-4" /> Upload episode
          </Link>
          <Link to="/admin/podcasts/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create episode
          </Link>
          <Link to="/admin/podcasts/playlists" className={cmsSecondaryButton}>
            <ListMusic className="h-4 w-4" /> Manage playlists
          </Link>
          <Link to="/admin/podcasts/analytics" className={cmsSecondaryButton}>
            <BarChart3 className="h-4 w-4" /> View analytics
          </Link>
        </div>
      </CmsPanel>

      <CmsPanel
        title="Recent episodes"
        action={
          <Link
            to="/admin/podcasts/episodes"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </Link>
        }
      >
        <DataTable
          columns={[
            { key: "episode", header: "Episode" },
            { key: "status", header: "Status" },
            { key: "duration", header: "Duration" },
            { key: "published", header: "Published" },
            { key: "plays", header: "Plays", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
        >
          {recent.length === 0 ? (
            <DataTableEmpty
              colSpan={6}
              title="No episodes yet"
              description="Upload an audio file or create an episode to get started."
              action={
                <Link to="/admin/podcasts/upload" className={cmsButton}>
                  <Upload className="h-4 w-4" /> Upload episode
                </Link>
              }
            />
          ) : null}
          {recent.map((episode) => (
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
