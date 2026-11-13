import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Film,
  ListVideo,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
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
  archiveVideo,
  deleteVideoFull,
  duplicateVideo,
  formatDuration,
  getVideoDashboard,
  type VideoRow,
} from "@/lib/video.functions";

export function VideosDashboardPage() {
  const qc = useQueryClient();
  const snapshot = useQuery({
    queryKey: ["videos-dashboard"],
    queryFn: getVideoDashboard,
    staleTime: 20_000,
  });
  const [pendingDelete, setPendingDelete] = useState<VideoRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["videos-dashboard"] });

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

  if (snapshot.isLoading) return <CmsPageSkeleton metrics={8} panels={2} />;

  const kpis = snapshot.data?.kpis;
  const recent = snapshot.data?.recent ?? [];
  const watchHours = Math.round((kpis?.totalWatchSeconds ?? 0) / 3600);

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow="Content · Videos"
        title="Videos dashboard"
        description="Live video counts, viewer engagement, and recent publishing activity."
      />

      {snapshot.error ? <CmsAlert>{snapshot.error.message}</CmsAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Videos" value={kpis?.totalVideos ?? 0} icon={Film} />
        <MetricCard label="Published" value={kpis?.published ?? 0} icon={Play} />
        <MetricCard label="Draft" value={kpis?.draft ?? 0} icon={Pencil} />
        <MetricCard label="Scheduled" value={kpis?.scheduled ?? 0} icon={Clock} />
        <MetricCard label="Total Views" value={kpis?.totalViews ?? 0} icon={Eye} />
        <MetricCard label="Watch Hours" value={watchHours} icon={Clock} />
        <MetricCard label="Completions" value={kpis?.completions ?? 0} icon={CheckCircle2} />
        <MetricCard label="New This Month" value={kpis?.videosThisMonth ?? 0} icon={Eye} />
      </div>

      <CmsPanel title="Quick actions">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/admin/videos/upload" className={cmsSecondaryButton}>
            <Upload className="h-4 w-4" /> Upload video
          </Link>
          <Link to="/admin/videos/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create video
          </Link>
          <Link to="/admin/videos/playlists" className={cmsSecondaryButton}>
            <ListVideo className="h-4 w-4" /> Manage playlists
          </Link>
          <Link to="/admin/videos/analytics" className={cmsSecondaryButton}>
            <BarChart3 className="h-4 w-4" /> View analytics
          </Link>
        </div>
      </CmsPanel>

      <CmsPanel
        title="Recent videos"
        action={
          <Link
            to="/admin/videos/library"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </Link>
        }
      >
        <DataTable
          columns={[
            { key: "video", header: "Video" },
            { key: "status", header: "Status" },
            { key: "duration", header: "Duration" },
            { key: "published", header: "Published" },
            { key: "views", header: "Views", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
        >
          {recent.length === 0 ? (
            <DataTableEmpty
              colSpan={6}
              title="No videos yet"
              description="Upload a video file or create a video to get started."
              action={
                <Link to="/admin/videos/upload" className={cmsButton}>
                  <Upload className="h-4 w-4" /> Upload video
                </Link>
              }
            />
          ) : null}
          {recent.map((video) => (
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
