import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Radio, RotateCcw, Trash2 } from "lucide-react";
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
import { FilterBar, SegmentedControl, SegmentedItem } from "@/components/cms/filter-bar";
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
  deletePodcastEpisode,
  deletePodcastShow,
  listPodcastEpisodesAdmin,
  listPodcastShowsAdmin,
  restorePodcastEpisode,
  restorePodcastShow,
  type PodcastEpisode,
  type PodcastShow,
} from "@/lib/podcast.functions";

export function PodcastsArchivePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"episodes" | "shows">("episodes");
  const [pendingDeleteEpisode, setPendingDeleteEpisode] = useState<PodcastEpisode | null>(null);
  const [pendingDeleteShow, setPendingDeleteShow] = useState<PodcastShow | null>(null);

  const episodesQ = useQuery({
    queryKey: ["podcast-episodes-archive"],
    queryFn: () => listPodcastEpisodesAdmin({ archived: "only", pageSize: 100 }),
    enabled: tab === "episodes",
  });
  const showsQ = useQuery({
    queryKey: ["podcast-shows-archive"],
    queryFn: () => listPodcastShowsAdmin({ archived: "only", pageSize: 100 }),
    enabled: tab === "shows",
  });

  const restoreEpisode = useMutation({
    mutationFn: (id: string) => restorePodcastEpisode({ data: { id } }),
    onSuccess: () => {
      toast.success("Episode restored to draft");
      void qc.invalidateQueries({ queryKey: ["podcast-episodes-archive"] });
      void qc.invalidateQueries({ queryKey: ["podcasts-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeEpisode = useMutation({
    mutationFn: (id: string) => deletePodcastEpisode({ data: { id } }),
    onSuccess: () => {
      toast.success("Episode permanently deleted");
      setPendingDeleteEpisode(null);
      void qc.invalidateQueries({ queryKey: ["podcast-episodes-archive"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const restoreShow = useMutation({
    mutationFn: (id: string) => restorePodcastShow({ data: { id } }),
    onSuccess: () => {
      toast.success("Show restored to draft");
      void qc.invalidateQueries({ queryKey: ["podcast-shows-archive"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeShow = useMutation({
    mutationFn: (id: string) => deletePodcastShow({ data: { id } }),
    onSuccess: () => {
      toast.success("Show permanently deleted");
      setPendingDeleteShow(null);
      void qc.invalidateQueries({ queryKey: ["podcast-shows-archive"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const episodes = episodesQ.data?.rows ?? [];
  const shows = showsQ.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Archive"
        description="Archived shows and episodes are hidden from listeners but kept for records."
      />

      <CmsPanel>
        <FilterBar
          trailing={
            <SegmentedControl className="ml-auto">
              <SegmentedItem active={tab === "episodes"} onClick={() => setTab("episodes")}>
                <Mic className="h-3.5 w-3.5" /> Episodes
              </SegmentedItem>
              <SegmentedItem active={tab === "shows"} onClick={() => setTab("shows")}>
                <Radio className="h-3.5 w-3.5" /> Shows
              </SegmentedItem>
            </SegmentedControl>
          }
        >
          {null}
        </FilterBar>

        {tab === "episodes" ? (
          !episodesQ.isLoading && episodes.length === 0 ? (
            <CmsEmptyState
              title="No archived episodes"
              description="Episodes you archive will appear here."
            />
          ) : (
            <DataTable
              columns={[
                { key: "episode", header: "Episode" },
                { key: "archived", header: "Archived" },
                { key: "actions", header: "", align: "right" },
              ]}
            >
              {episodes.map((episode) => (
                <DataTableRow key={episode.id}>
                  <DataTableCell>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{episode.title}</span>
                      <StatusBadge status="archived" />
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {episode.archived_at ? new Date(episode.archived_at).toLocaleDateString() : "—"}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={cmsSecondaryButton}
                        onClick={() => restoreEpisode.mutate(episode.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </button>
                      <button
                        type="button"
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold text-cat-rose hover:bg-cat-rose/10"
                        onClick={() => setPendingDeleteEpisode(episode)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          )
        ) : !showsQ.isLoading && shows.length === 0 ? (
          <CmsEmptyState
            title="No archived shows"
            description="Shows you archive will appear here."
          />
        ) : (
          <DataTable
            columns={[
              { key: "show", header: "Show" },
              { key: "archived", header: "Archived" },
              { key: "actions", header: "", align: "right" },
            ]}
          >
            {shows.map((show) => (
              <DataTableRow key={show.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{show.title}</span>
                    <StatusBadge status="archived" />
                  </div>
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">
                  {show.archived_at ? new Date(show.archived_at).toLocaleDateString() : "—"}
                </DataTableCell>
                <DataTableCell align="right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      onClick={() => restoreShow.mutate(show.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold text-cat-rose hover:bg-cat-rose/10"
                      onClick={() => setPendingDeleteShow(show)}
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

      <AlertDialog
        open={!!pendingDeleteEpisode}
        onOpenChange={(open) => !open && setPendingDeleteEpisode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete “{pendingDeleteEpisode?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the episode, its audio, and analytics for good. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={removeEpisode.isPending}
              onClick={() => pendingDeleteEpisode && removeEpisode.mutate(pendingDeleteEpisode.id)}
            >
              {removeEpisode.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDeleteShow}
        onOpenChange={(open) => !open && setPendingDeleteShow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete “{pendingDeleteShow?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the show for good. Linked episodes are kept but lose their show
              association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={removeShow.isPending}
              onClick={() => pendingDeleteShow && removeShow.mutate(pendingDeleteShow.id)}
            >
              {removeShow.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
