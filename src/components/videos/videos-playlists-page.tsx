import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Film, ListVideo, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  StatusBadge,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getVideoPlaylistItems,
  listVideoPlaylistsAdmin,
  listVideosAdmin,
  reorderVideoPlaylistItems,
  upsertVideoPlaylist,
  type VideoPlaylist,
  type VideoRow,
} from "@/lib/video.functions";
import { cn } from "@/lib/utils";

type PlaylistFormState = {
  id?: string;
  title: string;
  description: string;
  cover_image_url: string;
  status: string;
  is_featured: boolean;
};

const EMPTY_FORM: PlaylistFormState = {
  title: "",
  description: "",
  cover_image_url: "",
  status: "draft",
  is_featured: false,
};

function publicPlaylistPath(playlist: VideoPlaylist) {
  return `/video/playlist/${playlist.slug || playlist.id}`;
}

function publicPlaylistUrl(playlist: VideoPlaylist) {
  if (typeof window === "undefined") return publicPlaylistPath(playlist);
  return `${window.location.origin}${publicPlaylistPath(playlist)}`;
}

export function VideosPlaylistsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PlaylistFormState>(EMPTY_FORM);
  const [addVideoId, setAddVideoId] = useState("");

  const playlistsQ = useQuery({
    queryKey: ["video-playlists-admin"],
    queryFn: listVideoPlaylistsAdmin,
  });
  const videosQ = useQuery({
    queryKey: ["videos-lite"],
    queryFn: () => listVideosAdmin({ pageSize: 100, archived: "exclude" }),
  });

  useEffect(() => {
    if (!selectedId && playlistsQ.data?.length) setSelectedId(playlistsQ.data[0].id);
  }, [playlistsQ.data, selectedId]);

  const itemsQ = useQuery({
    queryKey: ["video-playlist-items", selectedId],
    queryFn: () => getVideoPlaylistItems(selectedId!),
    enabled: !!selectedId,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["video-playlists-admin"] });
    void qc.invalidateQueries({ queryKey: ["video-playlist-items", selectedId] });
  };

  const save = useMutation({
    mutationFn: () =>
      upsertVideoPlaylist({
        data: {
          id: form.id,
          title: form.title,
          description: form.description || null,
          cover_image_url: form.cover_image_url || null,
          status: form.status,
          is_featured: form.is_featured,
        },
      }),
    onSuccess: (row) => {
      toast.success(form.id ? "Playlist updated" : "Playlist created");
      setFormOpen(false);
      setSelectedId(row.id);
      void qc.invalidateQueries({ queryKey: ["video-playlists-admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (video_ids: string[]) =>
      reorderVideoPlaylistItems({ data: { playlist_id: selectedId!, video_ids } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const addVideo = useMutation({
    mutationFn: (videoId: string) => {
      const currentIds = (itemsQ.data ?? []).map((item: { video_id: string }) => item.video_id);
      return upsertVideoPlaylist({
        data: {
          id: selectedId!,
          title: selectedPlaylist!.title,
          video_ids: [...currentIds, videoId],
        },
      });
    },
    onSuccess: () => {
      toast.success("Video added");
      setAddVideoId("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeVideo = useMutation({
    mutationFn: (videoId: string) => {
      const currentIds = (itemsQ.data ?? [])
        .map((item: { video_id: string }) => item.video_id)
        .filter((id: string) => id !== videoId);
      return upsertVideoPlaylist({
        data: { id: selectedId!, title: selectedPlaylist!.title, video_ids: currentIds },
      });
    },
    onSuccess: () => {
      toast.success("Video removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const playlists = playlistsQ.data ?? [];
  const selectedPlaylist = playlists.find((p: VideoPlaylist) => p.id === selectedId) ?? null;
  const items = (itemsQ.data ?? []) as Array<{
    video_id: string;
    sort_order: number;
    video: VideoRow | null;
  }>;
  const videosInPlaylist = new Set(items.map((i) => i.video_id));
  const availableVideos = (videosQ.data?.rows ?? []).filter((v) => !videosInPlaylist.has(v.id));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!selectedPlaylist) return;
    setForm({
      id: selectedPlaylist.id,
      title: selectedPlaylist.title,
      description: selectedPlaylist.description ?? "",
      cover_image_url: selectedPlaylist.cover_image_url ?? "",
      status: selectedPlaylist.status,
      is_featured: selectedPlaylist.is_featured,
    });
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Playlists"
        description="Curate ordered collections of videos for viewers and embeds."
        actions={
          <button type="button" className={cmsButton} onClick={openCreate}>
            <Plus className="h-4 w-4" /> New playlist
          </button>
        }
      />

      {playlistsQ.error ? <CmsAlert>{playlistsQ.error.message}</CmsAlert> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <CmsPanel title="All playlists" className="h-fit">
          {playlists.length === 0 ? (
            <CmsEmptyState
              title="No playlists yet"
              description="Group videos into a themed playlist."
              icon={<ListVideo className="h-6 w-6" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {playlists.map((playlist: VideoPlaylist) => (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(playlist.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm cms-transition hover:bg-accent/60",
                      selectedId === playlist.id && "bg-primary/[0.06]",
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">{playlist.title}</span>
                    <StatusBadge status={playlist.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CmsPanel>

        <CmsPanel
          title={selectedPlaylist ? selectedPlaylist.title : "Select a playlist"}
          description={selectedPlaylist?.description ?? undefined}
          action={
            selectedPlaylist ? (
              <div className="flex flex-wrap gap-2">
                {selectedPlaylist.status === "published" ? (
                  <>
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(publicPlaylistUrl(selectedPlaylist))
                          .then(
                            () => toast.success("Public URL copied"),
                            () => toast.error("Could not copy URL"),
                          );
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy public URL
                    </button>
                    <a
                      className={cmsSecondaryButton}
                      href={publicPlaylistPath(selectedPlaylist)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" /> View
                    </a>
                  </>
                ) : null}
                <button type="button" className={cmsSecondaryButton} onClick={openEdit}>
                  Edit details
                </button>
              </div>
            ) : null
          }
        >
          {!selectedPlaylist ? (
            <CmsEmptyState
              title="No playlist selected"
              description="Choose a playlist on the left, or create one."
            />
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Field label="Add video">
                    <select
                      className={cmsInput}
                      value={addVideoId}
                      onChange={(e) => setAddVideoId(e.target.value)}
                    >
                      <option value="">Select a video…</option>
                      {availableVideos.map((video) => (
                        <option key={video.id} value={video.id}>
                          {video.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  className={cmsButton}
                  disabled={!addVideoId || addVideo.isPending}
                  onClick={() => addVideo.mutate(addVideoId)}
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>

              {items.length === 0 ? (
                <CmsEmptyState
                  title="No videos yet"
                  description="Add videos to this playlist above."
                />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {items.map((item, index) => (
                    <li key={item.video_id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                        {item.video?.thumbnail_url ? (
                          <img
                            src={item.video.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Film className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {item.video?.title ?? "Unknown video"}
                        </div>
                        <div className="text-xs text-muted-foreground">Position {index + 1}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="text-[10px] font-semibold uppercase text-primary hover:underline disabled:opacity-30"
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => {
                            const ids = items.map((i) => i.video_id);
                            [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                            reorder.mutate(ids);
                          }}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-semibold uppercase text-primary hover:underline disabled:opacity-30"
                          disabled={index === items.length - 1 || reorder.isPending}
                          onClick={() => {
                            const ids = items.map((i) => i.video_id);
                            [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                            reorder.mutate(ids);
                          }}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="p-1 text-muted-foreground hover:text-cat-rose"
                          aria-label="Remove from playlist"
                          onClick={() => removeVideo.mutate(item.video_id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CmsPanel>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit playlist" : "New playlist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Title" hint="Required">
              <input
                className={cmsInput}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={`${cmsInput} h-auto py-2`}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Cover image URL">
              <input
                className={cmsInput}
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select
                  className={cmsInput}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {["draft", "published", "archived"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 self-end">
                <span className="text-xs font-semibold">Featured</span>
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                className={cmsSecondaryButton}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cmsButton}
                disabled={save.isPending || !form.title.trim()}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : form.id ? "Save changes" : "Create playlist"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
