import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Download,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms-ui";
import {
  MediaAssetMetaLine,
  MediaAssetPreview,
  MediaTypeIcon,
  formatCount,
  selectionBarClass,
} from "@/components/media/media-previews";
import { MediaImageEditor } from "@/components/media/media-image-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMe } from "@/lib/admin.functions";
import {
  addMediaToGallery,
  bulkSetMediaCategory,
  bulkUpdateMediaTags,
  getMediaAssetCounts,
  listMediaAssetsPage,
  listMediaAssetUsages,
  listMediaCategoryOptions,
  listMediaFolders,
  listMediaGalleries,
  listMediaUploaders,
  moveMediaAssets,
  permanentlyDeleteMediaAssets,
  replaceMediaAssetFile,
  restoreMediaAssets,
  syncMediaAssetUsages,
  trashMediaAssets,
  updateMediaAsset,
  uploadMediaAsset,
  type MediaAssetRow,
} from "@/lib/media.functions";
import {
  assetTypeLabel,
  buildFolderTree,
  flattenFolderTree,
  formatBytes,
  type MediaAssetType,
  type MediaFolder,
} from "@/lib/dam";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type TypeFilter = MediaAssetType | "all";

const TYPE_TABS: Array<{ id: TypeFilter | "trash"; label: string }> = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Documents" },
  { id: "trash", label: "Trash" },
];

function usageCount(asset: MediaAssetRow) {
  return asset.media_asset_usages?.[0]?.count ?? 0;
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function MediaLibraryPage({
  initialType = "all",
  initialFocusSearch = false,
  listMode = "grid",
}: {
  /** Prefill type filter for locked sidebar deep-links */
  initialType?: TypeFilter | "trash";
  /** Open with search field focused */
  initialFocusSearch?: boolean;
  listMode?: "grid" | "list";
}) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const canUpload = hasPermission(me.data?.roles, "media:upload");
  const canManage = hasPermission(me.data?.roles, "media:manage_all");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [typeFilter, setTypeFilter] = useState<TypeFilter | "trash">(initialType);
  const [uploader, setUploader] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [folderId, setFolderId] = useState<"" | "unfiled" | string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [bulkTags, setBulkTags] = useState("");
  const [bulkGalleryId, setBulkGalleryId] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(listMode);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTypeFilter(initialType);
  }, [initialType]);

  useEffect(() => {
    setViewMode(listMode);
  }, [listMode]);

  useEffect(() => {
    if (initialFocusSearch) searchRef.current?.focus();
  }, [initialFocusSearch]);

  useEffect(
    () => setPage(1),
    [debouncedSearch, typeFilter, uploader, dateFrom, dateTo, categoryId, folderId, pageSize],
  );

  const filters = {
    search: debouncedSearch || undefined,
    asset_type: typeFilter === "trash" || typeFilter === "all" ? ("all" as const) : typeFilter,
    trash: typeFilter === "trash",
    uploaded_by: uploader || null,
    date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
    date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : null,
    category_id: categoryId || null,
    folder_id:
      folderId === "" ? undefined : folderId === "unfiled" ? ("unfiled" as const) : folderId,
    page,
    pageSize,
  };

  const counts = useQuery({ queryKey: ["media-counts"], queryFn: getMediaAssetCounts });
  const uploaders = useQuery({ queryKey: ["media-uploaders"], queryFn: listMediaUploaders });
  const categories = useQuery({
    queryKey: ["media-category-options"],
    queryFn: listMediaCategoryOptions,
  });
  const folders = useQuery({ queryKey: ["media-folders"], queryFn: listMediaFolders });
  const folderOptions = useMemo(
    () => flattenFolderTree(buildFolderTree((folders.data ?? []) as MediaFolder[])),
    [folders.data],
  );
  const galleries = useQuery({
    queryKey: ["media-galleries"],
    queryFn: listMediaGalleries,
    enabled: canUpload,
  });
  const media = useQuery({
    queryKey: ["media-assets-page", filters],
    queryFn: () => listMediaAssetsPage(filters),
  });

  const detailAsset = useMemo(
    () => media.data?.rows.find((a) => a.id === detailId) ?? null,
    [media.data, detailId],
  );
  const usages = useQuery({
    queryKey: ["media-usages", detailId],
    queryFn: () => listMediaAssetUsages({ data: { asset_id: detailId! } }),
    enabled: !!detailId,
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["media-assets-page"] }),
      qc.invalidateQueries({ queryKey: ["media-counts"] }),
      qc.invalidateQueries({ queryKey: ["media-usages"] }),
      qc.invalidateQueries({ queryKey: ["media-galleries"] }),
    ]);
  };

  const trash = useMutation({
    mutationFn: (ids: string[]) => trashMediaAssets({ data: { ids } }),
    onSuccess: async () => {
      setSelected(new Set());
      await invalidate();
    },
  });
  const restore = useMutation({
    mutationFn: (ids: string[]) => restoreMediaAssets({ data: { ids } }),
    onSuccess: async () => {
      setSelected(new Set());
      await invalidate();
    },
  });
  const purge = useMutation({
    mutationFn: (ids: string[]) =>
      permanentlyDeleteMediaAssets({ data: { ids, force: canManage } }),
    onSuccess: async () => {
      setSelected(new Set());
      setDetailId(null);
      await invalidate();
    },
  });
  const saveMeta = useMutation({
    mutationFn: updateMediaAsset,
    onSuccess: invalidate,
  });
  const replaceFile = useMutation({
    mutationFn: (vars: { id: string; file: File }) => replaceMediaAssetFile({ data: vars }),
    onSuccess: invalidate,
  });
  const saveEdited = useMutation({
    mutationFn: async (vars: { mode: "replace" | "new"; file: File; asset: MediaAssetRow }) => {
      if (vars.mode === "replace") {
        return replaceMediaAssetFile({ data: { id: vars.asset.id, file: vars.file } });
      }
      return uploadMediaAsset({
        data: {
          file: vars.file,
          folder_id: vars.asset.folder_id,
          alt_text: vars.asset.alt_text,
          caption: vars.asset.caption,
          description: vars.asset.description,
          credits: vars.asset.credits,
          source: vars.asset.source,
          tags: vars.asset.tags,
          category_id: vars.asset.category_id,
          allow_duplicate: true,
        },
      });
    },
    onSuccess: async () => {
      await invalidate();
    },
  });
  const syncUsages = useMutation({ mutationFn: syncMediaAssetUsages, onSuccess: invalidate });
  const addTags = useMutation({
    mutationFn: () =>
      bulkUpdateMediaTags({
        data: { ids: [...selected], tags: bulkTags.split(",").map((t) => t.trim()), mode: "add" },
      }),
    onSuccess: async () => {
      setBulkTags("");
      await invalidate();
    },
  });
  const setCat = useMutation({
    mutationFn: () =>
      bulkSetMediaCategory({
        data: { ids: [...selected], category_id: bulkCategory || null },
      }),
    onSuccess: invalidate,
  });
  const addToGallery = useMutation({
    mutationFn: () =>
      addMediaToGallery({ data: { gallery_id: bulkGalleryId, asset_ids: [...selected] } }),
    onSuccess: async () => {
      setSelected(new Set());
      await invalidate();
    },
  });
  const moveToFolder = useMutation({
    mutationFn: () =>
      moveMediaAssets({
        data: {
          ids: [...selected],
          folder_id: bulkFolderId === "__unfiled__" ? null : bulkFolderId,
        },
      }),
    onSuccess: async () => {
      setBulkFolderId("");
      setSelected(new Set());
      await invalidate();
    },
  });

  const rows = media.data?.rows ?? [];
  const total = media.data?.total ?? 0;
  const pageCount = media.data?.pageCount ?? 1;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  const countFor = (id: TypeFilter | "trash") => {
    if (!counts.data) return null;
    if (id === "trash") return counts.data.trash;
    if (id === "all") return counts.data.all;
    return counts.data[id];
  };

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Media Library"
        description="Manage all your media files"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cmsSecondaryButton}
              onClick={() => syncUsages.mutate()}
            >
              <RefreshCw className={cn("h-4 w-4", syncUsages.isPending && "animate-spin")} />
              Sync usages
            </button>
            {canUpload ? (
              <a href="/admin/media?view=upload" className={cmsButton}>
                <Plus className="h-4 w-4" />
                Upload Media
              </a>
            ) : null}
          </div>
        }
      />

      <CmsPanel className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              className={`${cmsInput} pl-9`}
              placeholder="Search media…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={cmsSecondaryButton}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            Advanced filters
          </button>
        </div>

        {advancedOpen ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Uploader</span>
              <select
                className={cmsInput}
                value={uploader}
                onChange={(e) => setUploader(e.target.value)}
              >
                <option value="">All uploaders</option>
                {(uploaders.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">From date</span>
              <input
                type="date"
                className={cmsInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">To date</span>
              <input
                type="date"
                className={cmsInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Category</span>
              <select
                className={cmsInput}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">All categories</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Folder</span>
              <select
                className={cmsInput}
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">All folders</option>
                <option value="unfiled">Unfiled</option>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"—".repeat(folder.depth)} {folder.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => {
            const n = countFor(tab.id);
            const active = typeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 border px-3 py-1.5 text-xs uppercase tracking-wide",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
                onClick={() => setTypeFilter(tab.id)}
              >
                {tab.label}
                {n != null ? <span className="opacity-80">({formatCount(n)})</span> : null}
              </button>
            );
          })}
        </div>
      </CmsPanel>

      {media.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-sm border border-border bg-muted"
            />
          ))}
        </div>
      ) : media.isError ? (
        <CmsEmptyState
          title="Could not load media"
          description={media.error instanceof Error ? media.error.message : "Unknown error"}
        />
      ) : rows.length === 0 ? (
        <CmsEmptyState
          title="No media files yet"
          description="Upload your first media file to get started."
          action={
            canUpload ? (
              <a href="/admin/media?view=upload" className={cmsButton}>
                <Plus className="h-4 w-4" /> Upload Media
              </a>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={toggleAll}
              />
              Select page
            </label>
            <div className="flex items-center gap-2">
              <div className="inline-flex border border-border">
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center",
                    viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                  aria-label="Grid view"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center border-l border-border",
                    viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                  aria-label="List view"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <span>
                {formatCount(total)} file{total === 1 ? "" : "s"}
              </span>
              <select
                className={cmsInput}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[12, 24, 48, 96].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={selected.size === rows.length && rows.length > 0}
                        onChange={toggleAll}
                        aria-label="Select page"
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">File</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Uploaded</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((asset) => (
                    <tr key={asset.id} className={cn(selected.has(asset.id) && "bg-crimson/5")}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(asset.id)}
                          onChange={() => toggle(asset.id)}
                          aria-label={`Select ${asset.file_name}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="flex max-w-md items-center gap-2 text-left font-medium hover:underline"
                          onClick={() => setDetailId(asset.id)}
                        >
                          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                            <MediaAssetPreview asset={asset} />
                          </span>
                          <span className="line-clamp-2">{asset.file_name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {assetTypeLabel(asset.asset_type)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatBytes(asset.size_bytes)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(asset.created_at).toLocaleDateString()}
                        {asset.profiles?.name ? ` · ${asset.profiles.name}` : ""}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className={cmsSecondaryButton}
                            onClick={() => setDetailId(asset.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={cmsSecondaryButton}
                            onClick={() => copyUrl(asset.public_url)}
                          >
                            {copied === asset.public_url ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {rows.map((asset) => {
                const checked = selected.has(asset.id);
                return (
                  <article
                    key={asset.id}
                    className={cn(
                      "group relative overflow-hidden rounded-sm border border-border bg-card",
                      checked && "ring-2 ring-crimson",
                    )}
                  >
                    <div className="absolute left-2 top-2 z-10">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(asset.id)}
                        aria-label={`Select ${asset.file_name}`}
                      />
                    </div>
                    <div className="absolute right-2 top-2 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-sm border border-border bg-background/90 p-1 opacity-100 shadow-sm md:opacity-0 md:group-hover:opacity-100"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(asset.id)}>
                            View / Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyUrl(asset.public_url)}>
                            {copied === asset.public_url ? "Copied" : "Copy URL"}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={asset.public_url} download target="_blank" rel="noreferrer">
                              Download
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {typeFilter === "trash" ? (
                            <>
                              <DropdownMenuItem onClick={() => restore.mutate([asset.id])}>
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-crimson"
                                onClick={() => {
                                  if (window.confirm("Permanently delete this file?"))
                                    purge.mutate([asset.id]);
                                }}
                              >
                                Permanently delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              className="text-crimson"
                              onClick={() => {
                                if (window.confirm("Move this file to trash?"))
                                  trash.mutate([asset.id]);
                              }}
                            >
                              Move to trash
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <button
                      type="button"
                      className="block w-full text-left"
                      onClick={() => setDetailId(asset.id)}
                    >
                      <div className="aspect-square overflow-hidden bg-muted">
                        <MediaAssetPreview asset={asset} />
                      </div>
                      <div className="space-y-1 p-3">
                        <div className="flex items-start gap-2">
                          <MediaTypeIcon type={asset.asset_type} />
                          <h3 className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
                            {asset.file_name}
                          </h3>
                        </div>
                        <MediaAssetMetaLine asset={asset} />
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(asset.created_at).toLocaleDateString()}
                          {asset.profiles?.name ? ` · ${asset.profiles.name}` : ""}
                        </div>
                        {usageCount(asset) > 0 ? (
                          <div className="text-[11px] font-medium text-navy">
                            Used in {usageCount(asset)} place(s)
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      <div className={selectionBarClass(selected.size > 0)}>
        <span className="text-sm font-medium">{selected.size} items selected</span>
        {typeFilter === "trash" ? (
          <>
            <button
              type="button"
              className={cmsSecondaryButton}
              onClick={() => restore.mutate([...selected])}
            >
              Restore
            </button>
            <button
              type="button"
              className={cmsButton}
              onClick={() => {
                if (window.confirm(`Permanently delete ${selected.size} file(s)?`))
                  purge.mutate([...selected]);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete forever
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={cmsSecondaryButton}
              onClick={() => {
                if (window.confirm(`Move ${selected.size} file(s) to trash?`))
                  trash.mutate([...selected]);
              }}
            >
              Move to trash
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${cmsInput} w-40`}
                placeholder="Add tags…"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
              />
              <button
                type="button"
                className={cmsSecondaryButton}
                disabled={!bulkTags.trim()}
                onClick={() => addTags.mutate()}
              >
                Add tags
              </button>
            </div>
            <select
              className={cmsInput}
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
            >
              <option value="">Change category…</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={!bulkCategory}
              onClick={() => setCat.mutate()}
            >
              Apply category
            </button>
            <select
              className={cmsInput}
              value={bulkGalleryId}
              onChange={(e) => setBulkGalleryId(e.target.value)}
            >
              <option value="">Add to gallery…</option>
              {(galleries.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={!bulkGalleryId}
              onClick={() => addToGallery.mutate()}
            >
              Add to gallery
            </button>
            <select
              className={cmsInput}
              value={bulkFolderId}
              onChange={(e) => setBulkFolderId(e.target.value)}
            >
              <option value="">Move to folder…</option>
              <option value="__unfiled__">Unfiled</option>
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"—".repeat(folder.depth)} {folder.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={!bulkFolderId || moveToFolder.isPending}
              onClick={() => moveToFolder.mutate()}
            >
              Move
            </button>
            <button
              type="button"
              className={cmsSecondaryButton}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </>
        )}
      </div>

      <Sheet open={!!detailAsset} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detailAsset ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-serif text-2xl">{detailAsset.file_name}</SheetTitle>
                <SheetDescription>
                  {assetTypeLabel(detailAsset.asset_type)} · {formatBytes(detailAsset.size_bytes)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 aspect-video overflow-hidden rounded-sm border border-border bg-muted">
                <MediaAssetPreview asset={detailAsset} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Uploaded</dt>
                  <dd>{new Date(detailAsset.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Uploader</dt>
                  <dd>{detailAsset.profiles?.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd>
                    {detailAsset.width && detailAsset.height
                      ? `${detailAsset.width} × ${detailAsset.height}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Storage path</dt>
                  <dd className="break-all">{detailAsset.object_path}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cmsSecondaryButton}
                  onClick={() => copyUrl(detailAsset.public_url)}
                >
                  {copied === detailAsset.public_url ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy URL
                </button>
                <a
                  className={cmsSecondaryButton}
                  href={detailAsset.public_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
                {canUpload ? (
                  <label className={cmsSecondaryButton}>
                    Replace file
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) replaceFile.mutate({ id: detailAsset.id, file });
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
              </div>

              {canUpload && detailAsset.asset_type === "image" ? (
                <div className="mt-4">
                  <MediaImageEditor
                    imageUrl={detailAsset.public_url}
                    bucket={detailAsset.bucket}
                    objectPath={detailAsset.object_path}
                    fileName={detailAsset.file_name}
                    busy={saveEdited.isPending || replaceFile.isPending}
                    onExport={(file, mode) => saveEdited.mutate({ mode, file, asset: detailAsset })}
                  />
                  {saveEdited.isSuccess ? (
                    <p className="mt-2 text-xs text-emerald-700">Edited image saved.</p>
                  ) : null}
                  {saveEdited.isError ? (
                    <p className="mt-2 text-xs text-crimson">
                      {saveEdited.error instanceof Error ? saveEdited.error.message : "Save failed"}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveMeta.mutate({
                    data: {
                      id: detailAsset.id,
                      file_name: String(fd.get("file_name") || detailAsset.file_name),
                      alt_text: String(fd.get("alt_text") || "") || null,
                      caption: String(fd.get("caption") || "") || null,
                      description: String(fd.get("description") || "") || null,
                      credits: String(fd.get("credits") || "") || null,
                      copyright: String(fd.get("copyright") || "") || null,
                      source: String(fd.get("source") || "") || null,
                      tags: String(fd.get("tags") || "")
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                      category_id: String(fd.get("category_id") || "") || null,
                    },
                  });
                }}
              >
                {(
                  [
                    ["file_name", "File name", detailAsset.file_name],
                    ["alt_text", "Alt text", detailAsset.alt_text ?? ""],
                    ["caption", "Caption", detailAsset.caption ?? ""],
                    ["description", "Description", detailAsset.description ?? ""],
                    ["credits", "Credits", detailAsset.credits ?? ""],
                    ["copyright", "Copyright", detailAsset.copyright ?? ""],
                    ["source", "Source", detailAsset.source ?? ""],
                    ["tags", "Tags (comma-separated)", (detailAsset.tags ?? []).join(", ")],
                  ] as const
                ).map(([name, label, value]) => (
                  <label key={name} className="block space-y-1 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    {name === "description" ? (
                      <textarea name={name} className={cmsInput} rows={3} defaultValue={value} />
                    ) : (
                      <input name={name} className={cmsInput} defaultValue={value} />
                    )}
                  </label>
                ))}
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Category</span>
                  <select
                    name="category_id"
                    className={cmsInput}
                    defaultValue={detailAsset.category_id ?? ""}
                  >
                    <option value="">None</option>
                    {(categories.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={cmsButton} disabled={saveMeta.isPending}>
                  {saveMeta.isPending ? "Saving…" : "Save metadata"}
                </button>
              </form>

              <div className="mt-8">
                <h3 className="text-sm font-semibold">Related articles</h3>
                {usages.isLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">Loading usages…</p>
                ) : (usages.data ?? []).length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Not currently referenced in tracked articles.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {(usages.data ?? []).map((u) => (
                      <li key={u.id} className="rounded-sm border border-border px-3 py-2">
                        <div className="font-medium">{u.entity_title || u.entity_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.field}
                          {u.entity_path ? (
                            <>
                              {" · "}
                              <a href={u.entity_path} className="underline hover:text-crimson">
                                Open
                              </a>
                            </>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
