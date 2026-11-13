import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  StatusBadge,
  cmsSecondaryButton,
} from "@/components/cms";
import { DataTable, DataTableCell, DataTableRow } from "@/components/cms/data-table";
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
  deleteVideoFull,
  listVideosAdmin,
  restoreVideo,
  type VideoRow,
} from "@/lib/video.functions";

export function VideosArchivePage() {
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<VideoRow | null>(null);

  const videosQ = useQuery({
    queryKey: ["videos-archive"],
    queryFn: () => listVideosAdmin({ archived: "only", pageSize: 100 }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreVideo({ data: { id } }),
    onSuccess: () => {
      toast.success("Video restored to draft");
      void qc.invalidateQueries({ queryKey: ["videos-archive"] });
      void qc.invalidateQueries({ queryKey: ["videos-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteVideoFull({ data: { id } }),
    onSuccess: () => {
      toast.success("Video permanently deleted");
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["videos-archive"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const videos = videosQ.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Archive"
        description="Archived videos are hidden from viewers but kept for records."
      />

      <CmsPanel>
        {!videosQ.isLoading && videos.length === 0 ? (
          <CmsEmptyState
            title="No archived videos"
            description="Videos you archive will appear here."
          />
        ) : (
          <DataTable
            columns={[
              { key: "video", header: "Video" },
              { key: "archived", header: "Archived" },
              { key: "actions", header: "", align: "right" },
            ]}
          >
            {videos.map((video) => (
              <DataTableRow key={video.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{video.title}</span>
                    <StatusBadge status="archived" />
                  </div>
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">
                  {video.archived_at ? new Date(video.archived_at).toLocaleDateString() : "—"}
                </DataTableCell>
                <DataTableCell align="right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      onClick={() => restore.mutate(video.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold text-cat-rose hover:bg-cat-rose/10"
                      onClick={() => setPendingDelete(video)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        )}
      </CmsPanel>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete "{pendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the video, its file, and analytics for good. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
