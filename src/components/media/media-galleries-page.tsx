import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Images, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms-ui";
import { formatCount } from "@/components/media/media-previews";
import {
  addMediaToGallery,
  deleteMediaGallery,
  duplicateMediaGallery,
  getGalleryCounts,
  getMediaGallery,
  listMediaAssetsPage,
  listMediaGalleries,
  removeMediaFromGallery,
  reorderGalleryMedia,
  upsertMediaGallery,
  type MediaGalleryRow,
  type MediaGalleryType,
} from "@/lib/media.functions";

const TYPE_LABEL: Record<MediaGalleryType, string> = {
  photo: "Photo Gallery",
  video: "Video Gallery",
  album: "Album",
  featured: "Featured Gallery",
};

export function MediaGalleriesPage() {
  const qc = useQueryClient();
  const counts = useQuery({ queryKey: ["gallery-counts"], queryFn: getGalleryCounts });
  const list = useQuery({ queryKey: ["media-galleries"], queryFn: listMediaGalleries });
  const [editing, setEditing] = useState<Partial<MediaGalleryRow> | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["media-galleries"] }),
      qc.invalidateQueries({ queryKey: ["gallery-counts"] }),
      qc.invalidateQueries({ queryKey: ["gallery-detail"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: (data: Parameters<typeof upsertMediaGallery>[0]["data"]) =>
      upsertMediaGallery({ data }),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteMediaGallery({ data: { id } }),
    onSuccess: invalidate,
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateMediaGallery({ data: { id } }),
    onSuccess: invalidate,
  });

  const detail = useQuery({
    queryKey: ["gallery-detail", manageId],
    queryFn: () => getMediaGallery({ data: { id: manageId! } }),
    enabled: !!manageId,
  });
  const library = useQuery({
    queryKey: ["media-assets-page", "gallery-picker"],
    queryFn: () => listMediaAssetsPage({ page: 1, pageSize: 48, asset_type: "all" }),
    enabled: !!manageId,
  });

  const addAssets = useMutation({
    mutationFn: (asset_ids: string[]) =>
      addMediaToGallery({ data: { gallery_id: manageId!, asset_ids } }),
    onSuccess: invalidate,
  });
  const removeAssets = useMutation({
    mutationFn: (asset_ids: string[]) =>
      removeMediaFromGallery({ data: { gallery_id: manageId!, asset_ids } }),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (ordered_asset_ids: string[]) =>
      reorderGalleryMedia({ data: { gallery_id: manageId!, ordered_asset_ids } }),
    onSuccess: invalidate,
  });

  const cards = [
    { key: "photo" as const, label: "Photo Gallery", count: counts.data?.photo ?? 0 },
    { key: "video" as const, label: "Video Gallery", count: counts.data?.video ?? 0 },
    { key: "album" as const, label: "Albums", count: counts.data?.album ?? 0 },
    { key: "featured" as const, label: "Featured Gallery", count: counts.data?.featured ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Galleries"
        description="Organize media into photo, video, album, and featured galleries."
        actions={
          <button
            type="button"
            className={cmsButton}
            onClick={() =>
              setEditing({
                name: "",
                description: "",
                gallery_type: "photo",
                status: "draft",
                visibility: "private",
                tags: [],
              })
            }
          >
            <Plus className="h-4 w-4" /> Create Gallery
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <CmsPanel key={card.key} className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Images className="h-4 w-4" /> {card.label}
            </div>
            <div className="mt-2 font-serif text-3xl text-ink">{formatCount(card.count)}</div>
          </CmsPanel>
        ))}
      </div>

      {editing ? (
        <CmsPanel className="space-y-3 p-4">
          <h2 className="font-semibold">{editing.id ? "Edit gallery" : "Create gallery"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs sm:col-span-2">
              <span className="text-muted-foreground">Name</span>
              <input
                className={cmsInput}
                value={editing.name ?? ""}
                onChange={(e) => setEditing((g) => ({ ...g!, name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-xs sm:col-span-2">
              <span className="text-muted-foreground">Description</span>
              <textarea
                className={cmsInput}
                rows={3}
                value={editing.description ?? ""}
                onChange={(e) => setEditing((g) => ({ ...g!, description: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Type</span>
              <select
                className={cmsInput}
                value={editing.gallery_type ?? "photo"}
                onChange={(e) =>
                  setEditing((g) => ({ ...g!, gallery_type: e.target.value as MediaGalleryType }))
                }
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Status</span>
              <select
                className={cmsInput}
                value={editing.status ?? "draft"}
                onChange={(e) =>
                  setEditing((g) => ({
                    ...g!,
                    status: e.target.value as MediaGalleryRow["status"],
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Visibility</span>
              <select
                className={cmsInput}
                value={editing.visibility ?? "private"}
                onChange={(e) =>
                  setEditing((g) => ({
                    ...g!,
                    visibility: e.target.value as MediaGalleryRow["visibility"],
                  }))
                }
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Tags</span>
              <input
                className={cmsInput}
                value={(editing.tags ?? []).join(", ")}
                onChange={(e) =>
                  setEditing((g) => ({
                    ...g!,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cmsButton}
              disabled={!editing.name?.trim() || save.isPending}
              onClick={() =>
                save.mutate({
                  id: editing.id,
                  name: editing.name!.trim(),
                  description: editing.description,
                  gallery_type: editing.gallery_type as MediaGalleryType,
                  status: editing.status as MediaGalleryRow["status"],
                  visibility: editing.visibility as MediaGalleryRow["visibility"],
                  tags: editing.tags,
                  cover_asset_id: editing.cover_asset_id,
                })
              }
            >
              Save gallery
            </button>
            <button type="button" className={cmsSecondaryButton} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
          {save.isError ? (
            <p className="text-xs text-crimson">
              {save.error instanceof Error ? save.error.message : "Save failed"}
            </p>
          ) : null}
        </CmsPanel>
      ) : null}

      <CmsPanel className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Gallery Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Media Count</th>
              <th className="p-3">Created</th>
              <th className="p-3">Updated</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <div>{g.name}</div>
                  {g.status === "published" && g.visibility !== "private" ? (
                    <a href={`/gallery/${g.slug}`} className="text-xs text-navy underline">
                      /gallery/{g.slug}
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground">/{g.slug}</div>
                  )}
                </td>
                <td className="p-3">{TYPE_LABEL[g.gallery_type] ?? g.gallery_type}</td>
                <td className="p-3">{formatCount(g.media_count ?? 0)}</td>
                <td className="p-3">{new Date(g.created_at).toLocaleDateString()}</td>
                <td className="p-3">{new Date(g.updated_at).toLocaleDateString()}</td>
                <td className="p-3 capitalize">{g.status}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-navy hover:underline"
                      onClick={() => setManageId(g.id)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="text-xs text-navy hover:underline"
                      onClick={() => setEditing(g)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-navy hover:underline"
                      onClick={() => duplicate.mutate(g.id)}
                    >
                      <Copy className="mr-1 inline h-3 w-3" />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="text-xs text-crimson hover:underline"
                      onClick={() => {
                        if (window.confirm(`Delete gallery “${g.name}”?`)) remove.mutate(g.id);
                      }}
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.isLoading && !(list.data ?? []).length ? (
          <CmsEmptyState
            className="border-0"
            title="No galleries yet"
            description="Create a gallery to group media for the public site."
          />
        ) : null}
      </CmsPanel>

      {manageId && detail.data ? (
        <CmsPanel className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-2xl text-ink">{detail.data.gallery.name}</h2>
            <button type="button" className={cmsSecondaryButton} onClick={() => setManageId(null)}>
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
            {detail.data.items.map((item, index) => {
              const asset = item.media_assets as {
                id: string;
                public_url: string;
                thumbnail_url?: string | null;
                file_name: string;
              };
              return (
                <div key={item.id} className="overflow-hidden rounded-sm border border-border">
                  <div className="aspect-square bg-muted">
                    <img
                      src={asset.thumbnail_url || asset.public_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-2">
                    <div className="truncate text-xs">{asset.file_name}</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="text-[10px] uppercase text-navy hover:underline"
                        disabled={index === 0}
                        onClick={() => {
                          const ids = detail.data!.items.map((i) => i.asset_id as string);
                          const next = [...ids];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          reorder.mutate(next);
                        }}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-[10px] uppercase text-navy hover:underline"
                        disabled={index === detail.data!.items.length - 1}
                        onClick={() => {
                          const ids = detail.data!.items.map((i) => i.asset_id as string);
                          const next = [...ids];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          reorder.mutate(next);
                        }}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="text-[10px] uppercase text-navy hover:underline"
                        onClick={() =>
                          save.mutate({
                            id: detail.data!.gallery.id,
                            name: detail.data!.gallery.name,
                            cover_asset_id: asset.id,
                            gallery_type: detail.data!.gallery.gallery_type,
                            status: detail.data!.gallery.status,
                            visibility: detail.data!.gallery.visibility,
                            tags: detail.data!.gallery.tags,
                            description: detail.data!.gallery.description,
                          })
                        }
                      >
                        Set cover
                      </button>
                      <button
                        type="button"
                        className="text-[10px] uppercase text-crimson hover:underline"
                        onClick={() => removeAssets.mutate([asset.id])}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Add from library</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(library.data?.rows ?? []).map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="overflow-hidden rounded-sm border border-border hover:border-foreground"
                  onClick={() => addAssets.mutate([asset.id])}
                >
                  <div className="aspect-square bg-muted">
                    {asset.asset_type === "image" ? (
                      <img
                        src={asset.thumbnail_url || asset.public_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] uppercase">
                        {asset.asset_type}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CmsPanel>
      ) : null}
    </div>
  );
}
