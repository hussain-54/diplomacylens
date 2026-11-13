import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  collectUrlsFromBody,
  detectAssetType,
  isAllowedMime,
  MAX_HERO_BYTES,
  MAX_LIBRARY_BYTES,
  type MediaAssetType,
  type MediaBucket,
} from "@/lib/dam";
import { toAppError } from "@/lib/db-errors";
import { hasPermission, type AppRole, type Permission } from "@/lib/permissions";

type Json = Database["public"]["Tables"]["admin_audit_logs"]["Insert"]["payload"];

export type MediaAssetRow = {
  id: string;
  bucket: string;
  object_path: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  alt_text: string | null;
  caption: string | null;
  copyright: string | null;
  description: string | null;
  credits: string | null;
  source: string | null;
  tags: string[];
  thumbnail_url: string | null;
  original_object_path: string | null;
  category_id: string | null;
  deleted_at: string | null;
  asset_type: MediaAssetType;
  folder_id: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  content_hash?: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  profiles: { name: string | null } | null;
  media_asset_usages?: Array<{ count: number }> | null;
};

export type MediaListFilters = {
  asset_type?: MediaAssetType | "all";
  folder_id?: string | null | "unfiled";
  search?: string;
  uploaded_by?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  category_id?: string | null;
  tags?: string[];
  trash?: boolean;
  page?: number;
  pageSize?: number;
};

export type MediaCounts = {
  all: number;
  image: number;
  video: number;
  audio: number;
  document: number;
  trash: number;
};

export type MediaGalleryType = "photo" | "video" | "album" | "featured";
export type MediaGalleryStatus = "draft" | "published" | "archived";
export type MediaGalleryVisibility = "public" | "private" | "unlisted";

export type MediaGalleryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_asset_id: string | null;
  gallery_type: MediaGalleryType;
  tags: string[];
  status: MediaGalleryStatus;
  visibility: MediaGalleryVisibility;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  media_count?: number;
  cover_url?: string | null;
};

export type MediaSettingsRow = {
  id: boolean;
  max_upload_bytes: number;
  bulk_upload_limit: number;
  allowed_image_types: string[];
  allowed_video_types: string[];
  allowed_audio_types: string[];
  allowed_document_types: string[];
  auto_compress: boolean;
  generate_thumbnails: boolean;
  preserve_originals: boolean;
  watermark_images: boolean;
  delete_unused_files: boolean;
  thumbnail_width: number;
  thumbnail_height: number;
  image_quality: number;
  default_image_format: "webp" | "jpeg" | "original";
  storage_quota_bytes: number;
  detect_duplicates: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type MediaStorageStats = {
  used_bytes: number;
  quota_bytes: number;
  available_bytes: number;
  percent_used: number;
  asset_count: number;
  quota_source: "configured";
};

const DEFAULT_SETTINGS: MediaSettingsRow = {
  id: true,
  max_upload_bytes: MAX_LIBRARY_BYTES,
  bulk_upload_limit: 20,
  allowed_image_types: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  allowed_video_types: ["video/mp4", "video/webm", "video/quicktime"],
  allowed_audio_types: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"],
  allowed_document_types: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  auto_compress: true,
  generate_thumbnails: true,
  preserve_originals: true,
  watermark_images: false,
  delete_unused_files: false,
  thumbnail_width: 300,
  thumbnail_height: 300,
  image_quality: 80,
  default_image_format: "webp",
  storage_quota_bytes: 536870912000,
  detect_duplicates: true,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

async function checkAuth() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
}

async function requireNewsroomRole() {
  const user = await checkAuth();
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) throw toAppError(error);
  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  if (!roleList.length) {
    throw new Error("No newsroom role assigned. Contact a super admin.");
  }
  return { user, roles: roleList };
}

async function requirePermission(permission: Permission) {
  const newsroom = await requireNewsroomRole();
  if (!hasPermission(newsroom.roles, permission)) {
    throw new Error(`Forbidden — missing ${permission} permission.`);
  }
  return newsroom;
}

async function writeAuditLog(entry: {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  summary?: string | null;
  payload?: Json;
}) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: entry.actor_id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    summary: entry.summary ?? null,
    payload: entry.payload ?? {},
  });
  if (error && !/admin_audit_logs|schema cache|PGRST/i.test(error.message)) {
    console.error("Audit log write failed", error);
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `gallery-${Math.random().toString(36).slice(2, 8)}`;

function normalizeTags(tags?: string[] | null) {
  if (!tags?.length) return [] as string[];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 40);
}

function applyAssetFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: MediaListFilters,
) {
  let q = query;
  if (filters.trash) {
    q = q.not("deleted_at", "is", null);
  } else {
    q = q.is("deleted_at", null);
  }
  if (filters.asset_type && filters.asset_type !== "all") {
    q = q.eq("asset_type", filters.asset_type);
  }
  if (filters.folder_id === "unfiled") {
    q = q.is("folder_id", null);
  } else if (filters.folder_id) {
    q = q.eq("folder_id", filters.folder_id);
  }
  if (filters.uploaded_by) {
    q = q.eq("uploaded_by", filters.uploaded_by);
  }
  if (filters.category_id) {
    q = q.eq("category_id", filters.category_id);
  }
  if (filters.date_from) {
    q = q.gte("created_at", filters.date_from);
  }
  if (filters.date_to) {
    q = q.lte("created_at", filters.date_to);
  }
  if (filters.tags?.length) {
    q = q.overlaps("tags", normalizeTags(filters.tags));
  }
  const search = filters.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    q = q.or(
      `file_name.ilike.%${escaped}%,alt_text.ilike.%${escaped}%,caption.ilike.%${escaped}%,credits.ilike.%${escaped}%,source.ilike.%${escaped}%,description.ilike.%${escaped}%`,
    );
  }
  return q;
}

export const listMediaCategoryOptions = async () => {
  await requirePermission("media:view");
  const { data, error } = await supabase
    .from("sections")
    .select("id, name, slug")
    .order("sort_order")
    .order("name");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const getMediaAssetCounts = async (): Promise<MediaCounts> => {
  await requirePermission("media:view");
  const empty: MediaCounts = { all: 0, image: 0, video: 0, audio: 0, document: 0, trash: 0 };
  try {
    const types: Array<MediaAssetType | "all" | "trash"> = [
      "all",
      "image",
      "video",
      "audio",
      "document",
      "trash",
    ];
    const results = await Promise.all(
      types.map(async (type) => {
        let query = supabase.from("media_assets").select("id", { count: "exact", head: true });
        if (type === "trash") {
          query = query.not("deleted_at", "is", null);
        } else {
          query = query.is("deleted_at", null);
          if (type !== "all") query = query.eq("asset_type", type);
        }
        const { count, error } = await query;
        if (error) {
          // Migration may not be applied yet — fall back to unfiltered totals without trash.
          if (type === "trash") return [type, 0] as const;
          let fallback = supabase.from("media_assets").select("id", { count: "exact", head: true });
          if (type !== "all") fallback = fallback.eq("asset_type", type);
          const legacy = await fallback;
          return [type, legacy.count ?? 0] as const;
        }
        return [type, count ?? 0] as const;
      }),
    );
    const map = Object.fromEntries(results) as Record<string, number>;
    return {
      all: map.all ?? 0,
      image: map.image ?? 0,
      video: map.video ?? 0,
      audio: map.audio ?? 0,
      document: map.document ?? 0,
      trash: map.trash ?? 0,
    };
  } catch {
    return empty;
  }
};

export const getMediaDashboard = async () => {
  await requirePermission("media:view");
  const [counts, storage, recentRes, usedRes] = await Promise.all([
    getMediaAssetCounts(),
    getMediaStorageStats(),
    supabase
      .from("media_assets")
      .select("id,file_name,public_url,thumbnail_url,asset_type,mime_type,size_bytes,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("media_asset_usages")
      .select(
        "asset_id, created_at, media_assets(id,file_name,public_url,thumbnail_url,asset_type)",
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const folders = await listMediaFolders();

  return {
    counts,
    storage,
    folderCount: folders.length,
    recentlyUploaded: recentRes.error ? [] : (recentRes.data ?? []),
    recentlyUsed: usedRes.error ? [] : (usedRes.data ?? []),
  };
};

export const listMediaActivityLogs = async (limit = 100) => {
  await requirePermission("media:view");
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select(
      "id,action,entity_type,entity_id,summary,payload,created_at,actor_id,profiles(name,email)",
    )
    .or(
      "action.ilike.media.%,entity_type.eq.media_asset,entity_type.eq.media_folder,entity_type.eq.media_gallery,entity_type.eq.media_settings",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    // Fallback without ilike OR join if schema differs
    const legacy = await supabase
      .from("admin_audit_logs")
      .select("id,action,entity_type,entity_id,summary,payload,created_at,actor_id")
      .order("created_at", { ascending: false })
      .limit(300);
    if (legacy.error) {
      if (/admin_audit_logs|schema cache|PGRST/i.test(error.message)) return [];
      throw toAppError(error);
    }
    return (legacy.data ?? []).filter(
      (row) =>
        row.action?.startsWith("media.") ||
        row.action?.startsWith("gallery.") ||
        ["media_asset", "media_folder", "media_gallery", "media_settings"].includes(
          row.entity_type,
        ),
    );
  }
  return data ?? [];
};

export const listMediaAssetsPage = async (filters: MediaListFilters = {}) => {
  await requirePermission("media:view");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = [12, 24, 48, 96].includes(filters.pageSize ?? 24)
    ? (filters.pageSize ?? 24)
    : 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from("media_assets")
      .select("*, profiles!media_assets_uploaded_by_fkey(name), media_asset_usages(count)", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);

    query = applyAssetFilters(query, filters);

    const { data, error, count } = await query;
    if (error) {
      // Any schema / join / missing-column issue → legacy path (never crash the UI).
      return safeListMediaAssetsLegacy(filters, page, pageSize);
    }

    const rows = ((data ?? []) as MediaAssetRow[]).map((row) => ({
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : [],
      description: row.description ?? null,
      credits: row.credits ?? null,
      source: row.source ?? null,
      thumbnail_url: row.thumbnail_url ?? null,
      deleted_at: row.deleted_at ?? null,
      profiles: normalizeProfile(row.profiles),
      media_asset_usages: row.media_asset_usages ?? [],
    }));

    return {
      rows,
      total: count ?? rows.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil((count ?? rows.length) / pageSize)),
    };
  } catch {
    return safeListMediaAssetsLegacy(filters, page, pageSize);
  }
};

function normalizeProfile(
  profiles: MediaAssetRow["profiles"] | Array<{ name: string | null }> | null | undefined,
): MediaAssetRow["profiles"] {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

async function safeListMediaAssetsLegacy(
  filters: MediaListFilters,
  page: number,
  pageSize: number,
) {
  try {
    return await listMediaAssetsLegacy(filters);
  } catch (error) {
    console.error("listMediaAssetsLegacy failed", error);
    return { rows: [] as MediaAssetRow[], total: 0, page, pageSize, pageCount: 1 };
  }
}

/** @deprecated Prefer listMediaAssetsPage — kept for article picker compatibility */
export const listMediaAssets = async (filters?: {
  asset_type?: MediaAssetType | "all";
  folder_id?: string | null | "unfiled";
  search?: string;
}) => {
  const page = await listMediaAssetsPage({ ...filters, page: 1, pageSize: 96 });
  return page.rows;
};

async function listMediaAssetsLegacy(filters: MediaListFilters) {
  let query = supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.asset_type && filters.asset_type !== "all") {
    query = query.eq("asset_type", filters.asset_type);
  }
  const { data, error } = await query;
  if (error) throw toAppError(error);
  let rows = (data ?? []).map((row) => ({
    ...row,
    asset_type: (row.asset_type as MediaAssetType) || detectAssetType(row.mime_type || ""),
    caption: (row as { caption?: string | null }).caption ?? null,
    copyright: (row as { copyright?: string | null }).copyright ?? null,
    folder_id: (row as { folder_id?: string | null }).folder_id ?? null,
    width: (row as { width?: number | null }).width ?? null,
    height: (row as { height?: number | null }).height ?? null,
    duration_seconds: (row as { duration_seconds?: number | null }).duration_seconds ?? null,
    updated_at: (row as { updated_at?: string }).updated_at ?? row.created_at,
    description: null,
    credits: null,
    source: null,
    tags: [] as string[],
    thumbnail_url: null,
    original_object_path: null,
    category_id: null,
    deleted_at: null,
    profiles: null,
    media_asset_usages: [],
  })) as MediaAssetRow[];

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (asset) =>
        asset.file_name.toLowerCase().includes(search) ||
        asset.alt_text?.toLowerCase().includes(search) ||
        asset.caption?.toLowerCase().includes(search),
    );
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 24;
  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    total: rows.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
  };
}

export const listMediaUploaders = async () => {
  await requirePermission("media:view");
  try {
    const { data, error } = await supabase
      .from("media_assets")
      .select("uploaded_by, profiles!media_assets_uploaded_by_fkey(name)")
      .is("deleted_at", null)
      .not("uploaded_by", "is", null)
      .limit(500);
    if (error) {
      // Fall back without deleted_at / join if migration or FK hint fails.
      const legacy = await supabase
        .from("media_assets")
        .select("uploaded_by")
        .not("uploaded_by", "is", null)
        .limit(500);
      if (legacy.error) return [];
      const map = new Map<string, string>();
      for (const row of legacy.data ?? []) {
        if (!row.uploaded_by) continue;
        map.set(row.uploaded_by, row.uploaded_by.slice(0, 8));
      }
      return [...map.entries()].map(([id, name]) => ({ id, name }));
    }
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      if (!row.uploaded_by) continue;
      const profile = normalizeProfile(row.profiles as MediaAssetRow["profiles"]);
      const name = profile?.name || row.uploaded_by.slice(0, 8);
      map.set(row.uploaded_by, name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  } catch {
    return [];
  }
};

const indexMediaAsset = async (row: {
  bucket: string;
  object_path: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  asset_type: MediaAssetType;
  folder_id?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  copyright?: string | null;
  description?: string | null;
  credits?: string | null;
  source?: string | null;
  tags?: string[];
  thumbnail_url?: string | null;
  original_object_path?: string | null;
  category_id?: string | null;
  width?: number | null;
  height?: number | null;
  content_hash?: string | null;
}) => {
  const payload: Record<string, unknown> = {
    bucket: row.bucket,
    object_path: row.object_path,
    public_url: row.public_url,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    uploaded_by: row.uploaded_by,
    asset_type: row.asset_type,
    folder_id: row.folder_id || null,
    alt_text: row.alt_text?.trim() || null,
    caption: row.caption?.trim() || null,
    copyright: row.copyright?.trim() || null,
    description: row.description?.trim() || null,
    credits: row.credits?.trim() || null,
    source: row.source?.trim() || null,
    tags: normalizeTags(row.tags),
    thumbnail_url: row.thumbnail_url || null,
    original_object_path: row.original_object_path || null,
    category_id: row.category_id || null,
    width: row.width ?? null,
    height: row.height ?? null,
  };
  if (row.content_hash) payload.content_hash = row.content_hash;

  const { data, error } = await supabase
    .from("media_assets")
    .insert(payload as never)
    .select("id")
    .maybeSingle();
  if (error && /content_hash/i.test(error.message) && row.content_hash) {
    delete payload.content_hash;
    const retry = await supabase
      .from("media_assets")
      .insert(payload as never)
      .select("id")
      .maybeSingle();
    if (
      retry.error &&
      !/media_assets|schema cache|PGRST|description|credits|tags/i.test(retry.error.message)
    ) {
      console.error("File uploaded but media indexing failed", retry.error);
    }
    return retry.data?.id ?? null;
  }
  if (error && !/media_assets|schema cache|PGRST|description|credits|tags/i.test(error.message)) {
    console.error("File uploaded but media indexing failed", error);
  }
  return data?.id ?? null;
};

export const getMediaSettings = async (): Promise<MediaSettingsRow> => {
  await requirePermission("media:view");
  const { data, error } = await supabase
    .from("media_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    if (/media_settings|schema cache|PGRST/i.test(error.message)) return DEFAULT_SETTINGS;
    throw toAppError(error);
  }
  if (!data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(data as MediaSettingsRow) };
};

export const updateMediaSettings = async ({
  data,
}: {
  data: Partial<Omit<MediaSettingsRow, "id" | "updated_at">>;
}) => {
  const { user } = await requirePermission("media:manage_all");
  if (data.delete_unused_files) {
    // Destructive toggle requires manage_all (already checked) — persisted only.
  }
  const payload = {
    ...data,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  // Generated Database types lag media_settings optional columns (detect_duplicates, etc.).
  const settingsTable = supabase.from("media_settings") as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: boolean) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await settingsTable.update(payload as Record<string, unknown>).eq("id", true);
  if (error) {
    if (/media_settings|schema cache|PGRST/i.test(error.message)) {
      throw new Error("Apply the media management migration before saving settings.");
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "media.settings.update",
    entity_type: "media_settings",
    entity_id: "true",
    summary: "Updated media settings",
    payload: data as Json,
  });
  return { ok: true };
};

export const getMediaStorageStats = async (): Promise<MediaStorageStats> => {
  await requirePermission("media:view");
  const settings = await getMediaSettings();
  const { data, error } = await supabase
    .from("media_assets")
    .select("size_bytes")
    .is("deleted_at", null);
  if (error) {
    if (/deleted_at|schema cache|PGRST/i.test(error.message)) {
      const legacy = await supabase.from("media_assets").select("size_bytes");
      const used = (legacy.data ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
      return {
        used_bytes: used,
        quota_bytes: settings.storage_quota_bytes,
        available_bytes: Math.max(0, settings.storage_quota_bytes - used),
        percent_used: settings.storage_quota_bytes
          ? Math.min(100, Math.round((used / settings.storage_quota_bytes) * 100))
          : 0,
        asset_count: legacy.data?.length ?? 0,
        quota_source: "configured",
      };
    }
    throw toAppError(error);
  }
  const used = (data ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
  const quota = settings.storage_quota_bytes;
  return {
    used_bytes: used,
    quota_bytes: quota,
    available_bytes: Math.max(0, quota - used),
    percent_used: quota ? Math.min(100, Math.round((used / quota) * 100)) : 0,
    asset_count: data?.length ?? 0,
    quota_source: "configured",
  };
};

function assertMimeAllowed(mime: string, settings: MediaSettingsRow) {
  const allowed = new Set([
    ...settings.allowed_image_types,
    ...settings.allowed_video_types,
    ...settings.allowed_audio_types,
    ...settings.allowed_document_types,
  ]);
  if (!allowed.has(mime) && !isAllowedMime(mime)) {
    throw new Error(`Unsupported file type: ${mime}`);
  }
}

export async function sha256FileHex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const findMediaByContentHash = async (hash: string) => {
  if (!hash) return [];
  // content_hash added in media upgrade migrations; generated types may lag.
  type HashRow = {
    id: string;
    file_name: string;
    public_url: string;
    thumbnail_url: string | null;
    size_bytes: number;
    mime_type: string;
    asset_type: string;
    created_at: string;
    uploaded_by: string | null;
    content_hash?: string | null;
  };
  const assetsTable = supabase.from("media_assets") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        is: (
          col: string,
          val: null,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => PromiseLike<{ data: HashRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
  const { data, error } = await assetsTable
    .select(
      "id,file_name,public_url,thumbnail_url,size_bytes,mime_type,asset_type,created_at,uploaded_by,content_hash",
    )
    .eq("content_hash", hash)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) {
    if (/content_hash|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export type DuplicateMediaGroup = {
  content_hash: string;
  count: number;
  total_bytes: number;
  assets: Array<{
    id: string;
    file_name: string;
    public_url: string;
    thumbnail_url: string | null;
    size_bytes: number;
    mime_type: string;
    asset_type: string;
    created_at: string;
    uploaded_by: string | null;
  }>;
};

export const listDuplicateMediaGroups = async (): Promise<DuplicateMediaGroup[]> => {
  await requirePermission("media:view");
  type DupRow = {
    id: string;
    file_name: string;
    public_url: string;
    thumbnail_url: string | null;
    size_bytes: number;
    mime_type: string;
    asset_type: string;
    created_at: string;
    uploaded_by: string | null;
    content_hash?: string | null;
  };
  const assetsTable = supabase.from("media_assets") as unknown as {
    select: (cols: string) => {
      not: (
        col: string,
        op: string,
        val: null,
      ) => {
        is: (
          col: string,
          val: null,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => PromiseLike<{ data: DupRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
  const { data, error } = await assetsTable
    .select(
      "id,file_name,public_url,thumbnail_url,size_bytes,mime_type,asset_type,created_at,uploaded_by,content_hash",
    )
    .not("content_hash", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) {
    if (/content_hash|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  const rows = data ?? [];
  const map = new Map<string, DuplicateMediaGroup["assets"]>();
  for (const row of rows) {
    const hash = row.content_hash;
    if (!hash) continue;
    const list = map.get(hash) ?? [];
    list.push({
      id: row.id,
      file_name: row.file_name,
      public_url: row.public_url,
      thumbnail_url: row.thumbnail_url,
      size_bytes: row.size_bytes,
      mime_type: row.mime_type,
      asset_type: row.asset_type,
      created_at: row.created_at,
      uploaded_by: row.uploaded_by,
    });
    map.set(hash, list);
  }
  return [...map.entries()]
    .filter(([, assets]) => assets.length > 1)
    .map(([content_hash, assets]) => ({
      content_hash,
      count: assets.length,
      total_bytes: assets.reduce((sum, a) => sum + (a.size_bytes ?? 0), 0),
      assets,
    }))
    .sort((a, b) => b.count - a.count || b.total_bytes - a.total_bytes);
};

export const uploadHeroImage = async ({
  data,
}: {
  data: {
    fileName: string;
    contentType: string;
    base64: string;
    bucket?: "article-hero" | "avatars";
    folder_id?: string | null;
  };
}) => {
  const { user } = await requirePermission("media:upload");
  const bucket = data.bucket ?? "article-hero";
  if (!data.contentType.startsWith("image/")) {
    throw new Error("Only image files can be uploaded.");
  }
  const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > MAX_HERO_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }
  const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const path = bucket === "avatars" ? `${user.id}/${fileName}` : fileName;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: data.contentType,
    upsert: false,
  });
  if (error) throw toAppError(error);
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error("Upload succeeded but public URL could not be created.");

  const assetId = await indexMediaAsset({
    bucket,
    object_path: path,
    public_url: pub.publicUrl,
    file_name: data.fileName,
    mime_type: data.contentType,
    size_bytes: bytes.byteLength,
    uploaded_by: user.id,
    asset_type: "image",
    folder_id: data.folder_id,
  });

  await writeAuditLog({
    actor_id: user.id,
    action: "media.upload",
    entity_type: "media_asset",
    entity_id: assetId,
    summary: `Uploaded ${data.fileName}`,
  });

  return { path, url: pub.publicUrl, id: assetId };
};

export const uploadMediaAsset = async ({
  data,
}: {
  data: {
    file: File;
    folder_id?: string | null;
    alt_text?: string | null;
    caption?: string | null;
    copyright?: string | null;
    description?: string | null;
    credits?: string | null;
    source?: string | null;
    tags?: string[];
    category_id?: string | null;
    bucket?: MediaBucket;
    width?: number | null;
    height?: number | null;
    thumbnail?: File | null;
    original?: File | null;
    allow_duplicate?: boolean;
  };
}) => {
  const { user } = await requirePermission("media:upload");
  const settings = await getMediaSettings();
  const mime = data.file.type || "application/octet-stream";
  assertMimeAllowed(mime, settings);

  let contentHash: string | null = null;
  try {
    contentHash = await sha256FileHex(data.file);
  } catch {
    contentHash = null;
  }

  let duplicateOf: Awaited<ReturnType<typeof findMediaByContentHash>>[number] | null = null;
  if (contentHash && settings.detect_duplicates) {
    const matches = await findMediaByContentHash(contentHash);
    if (matches.length) {
      duplicateOf = matches[0];
      if (!data.allow_duplicate) {
        throw new Error(
          `Duplicate file detected (same content as “${duplicateOf.file_name}”). Open Duplicates to review, or re-upload with allow duplicate.`,
        );
      }
    }
  }

  const assetType = detectAssetType(mime);
  const bucket: MediaBucket =
    data.bucket ??
    (assetType === "image" && data.file.size <= MAX_HERO_BYTES ? "article-hero" : "media-library");
  const maxBytes =
    bucket === "media-library" ? settings.max_upload_bytes || MAX_LIBRARY_BYTES : MAX_HERO_BYTES;
  if (data.file.size > maxBytes) {
    throw new Error(`Files must be ${(maxBytes / 1024 / 1024).toFixed(0)} MB or smaller.`);
  }
  if (bucket !== "media-library" && assetType !== "image") {
    throw new Error("Only images can be uploaded to the hero/avatar buckets.");
  }

  const safeName = data.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
  const path =
    bucket === "avatars"
      ? `${user.id}/${fileName}`
      : bucket === "media-library"
        ? `${assetType}/${fileName}`
        : fileName;

  let originalPath: string | null = null;
  if (data.original && settings.preserve_originals && bucket === "media-library") {
    const origSafe = data.original.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    originalPath = `originals/${Date.now()}-${origSafe}`;
    const { error: origError } = await supabase.storage
      .from(bucket)
      .upload(originalPath, data.original, {
        contentType: data.original.type || mime,
        upsert: false,
      });
    if (origError) throw toAppError(origError);
  }

  const { error } = await supabase.storage.from(bucket).upload(path, data.file, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw toAppError(error);
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error("Upload succeeded but public URL could not be created.");

  let thumbnailUrl: string | null = null;
  if (data.thumbnail && settings.generate_thumbnails && bucket === "media-library") {
    const thumbPath = `thumbnails/${Date.now()}-${safeName}`;
    const { error: thumbError } = await supabase.storage
      .from(bucket)
      .upload(thumbPath, data.thumbnail, {
        contentType: data.thumbnail.type || "image/webp",
        upsert: false,
      });
    if (!thumbError) {
      const { data: thumbPub } = supabase.storage.from(bucket).getPublicUrl(thumbPath);
      thumbnailUrl = thumbPub?.publicUrl ?? null;
    }
  }

  const assetId = await indexMediaAsset({
    bucket,
    object_path: path,
    public_url: pub.publicUrl,
    file_name: data.file.name,
    mime_type: mime,
    size_bytes: data.file.size,
    uploaded_by: user.id,
    asset_type: assetType,
    folder_id: data.folder_id,
    alt_text: data.alt_text,
    caption: data.caption,
    copyright: data.copyright,
    description: data.description,
    credits: data.credits,
    source: data.source,
    tags: data.tags,
    category_id: data.category_id,
    thumbnail_url: thumbnailUrl,
    original_object_path: originalPath,
    width: data.width,
    height: data.height,
    content_hash: contentHash,
  });

  await writeAuditLog({
    actor_id: user.id,
    action: "media.upload",
    entity_type: "media_asset",
    entity_id: assetId,
    summary: duplicateOf
      ? `Uploaded ${data.file.name} (duplicate of ${duplicateOf.file_name})`
      : `Uploaded ${data.file.name}`,
  });

  return {
    id: assetId,
    path,
    url: pub.publicUrl,
    duplicate_of: duplicateOf,
    asset_type: assetType,
    bucket,
    thumbnail_url: thumbnailUrl,
  };
};

export const uploadMediaAssetsBulk = async ({
  data,
}: {
  data: {
    files: File[];
    folder_id?: string | null;
    alt_text?: string | null;
    caption?: string | null;
    copyright?: string | null;
    description?: string | null;
    credits?: string | null;
    source?: string | null;
    tags?: string[];
    category_id?: string | null;
  };
}) => {
  await requirePermission("media:upload");
  const settings = await getMediaSettings();
  if (!data.files.length) throw new Error("Select at least one file.");
  if (data.files.length > settings.bulk_upload_limit) {
    throw new Error(`Bulk upload is limited to ${settings.bulk_upload_limit} files.`);
  }
  const results: Array<{
    fileName: string;
    ok: boolean;
    error?: string;
    url?: string;
    id?: string | null;
  }> = [];
  for (const file of data.files) {
    try {
      const uploaded = await uploadMediaAsset({
        data: {
          file,
          folder_id: data.folder_id,
          bucket: "media-library",
          alt_text: data.alt_text,
          caption: data.caption,
          copyright: data.copyright,
          description: data.description,
          credits: data.credits,
          source: data.source,
          tags: data.tags,
          category_id: data.category_id,
        },
      });
      results.push({ fileName: file.name, ok: true, url: uploaded.url, id: uploaded.id });
    } catch (error) {
      results.push({
        fileName: file.name,
        ok: false,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }
  return {
    uploaded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
};

export const updateMediaAsset = async ({
  data,
}: {
  data: {
    id: string;
    alt_text?: string | null;
    caption?: string | null;
    copyright?: string | null;
    description?: string | null;
    credits?: string | null;
    source?: string | null;
    tags?: string[];
    category_id?: string | null;
    folder_id?: string | null;
    file_name?: string;
  };
}) => {
  const { user } = await requirePermission("media:view");
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.alt_text !== undefined) payload.alt_text = data.alt_text?.trim() || null;
  if (data.caption !== undefined) payload.caption = data.caption?.trim() || null;
  if (data.copyright !== undefined) payload.copyright = data.copyright?.trim() || null;
  if (data.description !== undefined) payload.description = data.description?.trim() || null;
  if (data.credits !== undefined) payload.credits = data.credits?.trim() || null;
  if (data.source !== undefined) payload.source = data.source?.trim() || null;
  if (data.tags !== undefined) payload.tags = normalizeTags(data.tags);
  if (data.category_id !== undefined) payload.category_id = data.category_id || null;
  if (data.folder_id !== undefined) payload.folder_id = data.folder_id || null;
  if (data.file_name !== undefined) payload.file_name = data.file_name.trim();

  const { error } = await supabase
    .from("media_assets")
    .update(payload as never)
    .eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "media.edit",
    entity_type: "media_asset",
    entity_id: data.id,
    summary: "Updated media metadata",
  });
  return { ok: true };
};

export const moveMediaAssets = async ({
  data,
}: {
  data: { ids: string[]; folder_id: string | null };
}) => {
  await requirePermission("media:upload");
  if (!data.ids.length) throw new Error("Select at least one asset.");
  const { error } = await supabase
    .from("media_assets")
    .update({ folder_id: data.folder_id, updated_at: new Date().toISOString() })
    .in("id", data.ids);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const bulkUpdateMediaTags = async ({
  data,
}: {
  data: { ids: string[]; tags: string[]; mode?: "add" | "replace" };
}) => {
  await requirePermission("media:upload");
  if (!data.ids.length) throw new Error("Select at least one asset.");
  const tags = normalizeTags(data.tags);
  if (data.mode === "replace") {
    const { error } = await supabase
      .from("media_assets")
      .update({ tags, updated_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw toAppError(error);
    return { ok: true };
  }
  const { data: rows, error: readError } = await supabase
    .from("media_assets")
    .select("id, tags")
    .in("id", data.ids);
  if (readError) throw toAppError(readError);
  for (const row of rows ?? []) {
    const next = normalizeTags([...(row.tags ?? []), ...tags]);
    const { error } = await supabase
      .from("media_assets")
      .update({ tags: next, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const bulkSetMediaCategory = async ({
  data,
}: {
  data: { ids: string[]; category_id: string | null };
}) => {
  await requirePermission("media:upload");
  if (!data.ids.length) throw new Error("Select at least one asset.");
  const { error } = await supabase
    .from("media_assets")
    .update({ category_id: data.category_id, updated_at: new Date().toISOString() })
    .in("id", data.ids);
  if (error) throw toAppError(error);
  return { ok: true };
};

async function assertDeletable(
  asset: {
    id: string;
    public_url: string;
  },
  force = false,
) {
  const [heroes, ogs, twitters, usages, galleryLinks] = await Promise.all([
    supabase.from("articles").select("id").eq("hero_image_url", asset.public_url).limit(5),
    supabase.from("articles").select("id").eq("og_image_url", asset.public_url).limit(5),
    supabase.from("articles").select("id").eq("twitter_image_url", asset.public_url).limit(5),
    supabase
      .from("media_asset_usages")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", asset.id),
    supabase
      .from("gallery_media")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", asset.id),
  ]);
  const articleHits =
    (heroes.data?.length ?? 0) + (ogs.data?.length ?? 0) + (twitters.data?.length ?? 0);
  const usageCount = usages.error ? 0 : (usages.count ?? 0);
  const galleryCount = galleryLinks.error ? 0 : (galleryLinks.count ?? 0);
  if (!force && (articleHits > 0 || usageCount > 0)) {
    throw new Error(
      `This file is used in ${articleHits + usageCount} article reference(s)${
        galleryCount ? ` and ${galleryCount} gallery(ies)` : ""
      }. Remove those references or force permanent delete.`,
    );
  }
  return { articleHits, usageCount, galleryCount };
}

export const trashMediaAssets = async ({ data }: { data: { ids: string[] } }) => {
  const { user } = await requirePermission("media:upload");
  if (!data.ids.length) throw new Error("Select at least one asset.");
  const { error } = await supabase
    .from("media_assets")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in("id", data.ids);
  if (error) {
    if (/deleted_at|schema cache|PGRST/i.test(error.message)) {
      // Soft delete unavailable — fall back to hard delete one by one with checks
      for (const id of data.ids) {
        await deleteMediaAsset({ data: { id } });
      }
      return { ok: true, mode: "hard" as const };
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "media.trash",
    entity_type: "media_asset",
    summary: `Moved ${data.ids.length} asset(s) to trash`,
    payload: { ids: data.ids },
  });
  return { ok: true, mode: "soft" as const };
};

export const restoreMediaAssets = async ({ data }: { data: { ids: string[] } }) => {
  const { user } = await requirePermission("media:upload");
  if (!data.ids.length) throw new Error("Select at least one asset.");
  const { error } = await supabase
    .from("media_assets")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .in("id", data.ids);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "media.restore",
    entity_type: "media_asset",
    summary: `Restored ${data.ids.length} asset(s)`,
    payload: { ids: data.ids },
  });
  return { ok: true };
};

export const deleteMediaAsset = async ({ data }: { data: { id: string; force?: boolean } }) => {
  const { user } = await requirePermission("media:upload");
  const { data: asset, error: readError } = await supabase
    .from("media_assets")
    .select("bucket, object_path, public_url, original_object_path, thumbnail_url")
    .eq("id", data.id)
    .single();
  if (readError) throw toAppError(readError);

  await assertDeletable({ id: data.id, public_url: asset.public_url }, data.force);

  const paths = [asset.object_path];
  if (asset.original_object_path) paths.push(asset.original_object_path);
  const { error: storageError } = await supabase.storage.from(asset.bucket).remove(paths);
  if (storageError) throw toAppError(storageError);
  const { error } = await supabase.from("media_assets").delete().eq("id", data.id);
  if (error) throw toAppError(error);

  await writeAuditLog({
    actor_id: user.id,
    action: "media.delete",
    entity_type: "media_asset",
    entity_id: data.id,
    summary: "Permanently deleted media asset",
  });
  return { ok: true };
};

export const permanentlyDeleteMediaAssets = async ({
  data,
}: {
  data: { ids: string[]; force?: boolean };
}) => {
  for (const id of data.ids) {
    await deleteMediaAsset({ data: { id, force: data.force } });
  }
  return { ok: true };
};

export const replaceMediaAssetFile = async ({ data }: { data: { id: string; file: File } }) => {
  const { user } = await requirePermission("media:upload");
  const settings = await getMediaSettings();
  const mime = data.file.type || "application/octet-stream";
  assertMimeAllowed(mime, settings);
  if (data.file.size > settings.max_upload_bytes) {
    throw new Error(
      `Files must be ${(settings.max_upload_bytes / 1024 / 1024).toFixed(0)} MB or smaller.`,
    );
  }

  const { data: asset, error: readError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", data.id)
    .single();
  if (readError) throw toAppError(readError);

  const safeName = data.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
  const assetType = detectAssetType(mime);
  const path = asset.bucket === "media-library" ? `${assetType}/${fileName}` : fileName;

  const { error: uploadError } = await supabase.storage.from(asset.bucket).upload(path, data.file, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) throw toAppError(uploadError);
  const { data: pub } = supabase.storage.from(asset.bucket).getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error("Replace upload succeeded but public URL missing.");

  await supabase.storage.from(asset.bucket).remove([asset.object_path]);

  const { error } = await supabase
    .from("media_assets")
    .update({
      object_path: path,
      public_url: pub.publicUrl,
      file_name: data.file.name,
      mime_type: mime,
      size_bytes: data.file.size,
      asset_type: assetType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (error) throw toAppError(error);

  await writeAuditLog({
    actor_id: user.id,
    action: "media.replace",
    entity_type: "media_asset",
    entity_id: data.id,
    summary: `Replaced file with ${data.file.name}`,
  });
  return { ok: true, url: pub.publicUrl };
};

export const listMediaAssetUsages = async ({ data }: { data: { asset_id: string } }) => {
  await requirePermission("media:view");
  const { data: rows, error } = await supabase
    .from("media_asset_usages")
    .select("*")
    .eq("asset_id", data.asset_id)
    .order("created_at", { ascending: false });
  if (error) {
    if (/media_asset_usages|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return rows ?? [];
};

export const syncMediaAssetUsages = async () => {
  await requirePermission("media:view");
  const { data: assets, error: assetsError } = await supabase
    .from("media_assets")
    .select("id, public_url")
    .is("deleted_at", null);
  if (assetsError) {
    if (/deleted_at/i.test(assetsError.message)) {
      const legacy = await supabase.from("media_assets").select("id, public_url");
      if (legacy.error) throw toAppError(legacy.error);
      return syncUsagesForAssets(legacy.data ?? []);
    }
    throw toAppError(assetsError);
  }
  return syncUsagesForAssets(assets ?? []);
};

async function syncUsagesForAssets(assets: Array<{ id: string; public_url: string }>) {
  const byUrl = new Map(assets.map((asset) => [asset.public_url, asset.id]));
  if (!byUrl.size) return { synced: 0 };

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("id, title, slug, hero_image_url, og_image_url, twitter_image_url, body");
  if (articlesError) throw toAppError(articlesError);

  const rows: Array<{
    asset_id: string;
    entity_type: "article";
    entity_id: string;
    field: string;
    entity_title: string;
    entity_path: string;
  }> = [];

  for (const article of articles ?? []) {
    const path = article.slug ? `/article/${article.slug}` : `/admin/articles/${article.id}`;
    const title = article.title;
    const fields: Array<[string, string | null | undefined]> = [
      ["hero_image_url", article.hero_image_url],
      ["og_image_url", article.og_image_url],
      ["twitter_image_url", article.twitter_image_url],
    ];
    for (const [field, url] of fields) {
      if (url && byUrl.has(url)) {
        rows.push({
          asset_id: byUrl.get(url)!,
          entity_type: "article",
          entity_id: article.id,
          field,
          entity_title: title,
          entity_path: path,
        });
      }
    }
    for (const url of collectUrlsFromBody(article.body)) {
      if (byUrl.has(url)) {
        rows.push({
          asset_id: byUrl.get(url)!,
          entity_type: "article",
          entity_id: article.id,
          field: "body",
          entity_title: title,
          entity_path: path,
        });
      }
    }
  }

  if (rows.length) {
    const { error } = await supabase.from("media_asset_usages").upsert(rows, {
      onConflict: "asset_id,entity_type,entity_id,field",
    });
    if (error && !/media_asset_usages|schema cache|PGRST/i.test(error.message)) {
      throw toAppError(error);
    }
  }
  return { synced: rows.length };
}

// Folders — re-export implementations that live with media module
export const listMediaFolders = async () => {
  await requirePermission("media:view");
  const { data, error } = await supabase
    .from("media_folders")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) {
    if (/media_folders|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const upsertMediaFolder = async ({
  data,
}: {
  data: { id?: string; name: string; parent_id?: string | null; sort_order?: number };
}) => {
  const { user } = await requirePermission("media:upload");
  const payload = {
    name: data.name.trim(),
    parent_id: data.parent_id ?? null,
    sort_order: data.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };
  if (data.id) {
    const { error } = await supabase.from("media_folders").update(payload).eq("id", data.id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from("media_folders").insert({
      ...payload,
      created_by: user.id,
    });
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const deleteMediaFolder = async ({ data }: { data: { id: string } }) => {
  await requirePermission("media:upload");
  const { count: childCount, error: childError } = await supabase
    .from("media_folders")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", data.id);
  if (childError) throw toAppError(childError);
  if (childCount) throw new Error("Delete or move child folders first.");

  const { count: assetCount, error: assetError } = await supabase
    .from("media_assets")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", data.id)
    .is("deleted_at", null);
  if (assetError && !/deleted_at/i.test(assetError.message)) throw toAppError(assetError);
  if (assetCount) throw new Error("Move or delete assets in this folder first.");

  const { error } = await supabase.from("media_folders").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

// ============ GALLERIES ============

export const getGalleryCounts = async () => {
  await requirePermission("media:view");
  const types: MediaGalleryType[] = ["photo", "video", "album", "featured"];
  const counts = await Promise.all(
    types.map(async (type) => {
      const { count, error } = await supabase
        .from("media_galleries")
        .select("id", { count: "exact", head: true })
        .eq("gallery_type", type);
      if (error) {
        if (/media_galleries|schema cache|PGRST/i.test(error.message)) return [type, 0] as const;
        throw toAppError(error);
      }
      return [type, count ?? 0] as const;
    }),
  );
  const { count: total, error } = await supabase
    .from("media_galleries")
    .select("id", { count: "exact", head: true });
  if (error && !/media_galleries|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
  return {
    total: total ?? 0,
    photo: Object.fromEntries(counts).photo ?? 0,
    video: Object.fromEntries(counts).video ?? 0,
    album: Object.fromEntries(counts).album ?? 0,
    featured: Object.fromEntries(counts).featured ?? 0,
  };
};

export const listMediaGalleries = async () => {
  await requirePermission("media:view");
  const { data, error } = await supabase
    .from("media_galleries")
    .select(
      "*, gallery_media(count), cover:media_assets!media_galleries_cover_asset_id_fkey(public_url, thumbnail_url)",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    if (/media_galleries|schema cache|PGRST/i.test(error.message)) return [] as MediaGalleryRow[];
    // Simpler select fallback
    const simple = await supabase
      .from("media_galleries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (simple.error) throw toAppError(simple.error);
    return (simple.data ?? []) as MediaGalleryRow[];
  }
  return (data ?? []).map((row) => {
    const cover = row.cover as { public_url?: string; thumbnail_url?: string | null } | null;
    const countWrap = row.gallery_media as Array<{ count: number }> | null;
    return {
      ...(row as unknown as MediaGalleryRow),
      media_count: countWrap?.[0]?.count ?? 0,
      cover_url: cover?.thumbnail_url || cover?.public_url || null,
    };
  });
};

export const getMediaGallery = async ({ data }: { data: { id: string } }) => {
  await requirePermission("media:view");
  const { data: gallery, error } = await supabase
    .from("media_galleries")
    .select("*")
    .eq("id", data.id)
    .single();
  if (error) throw toAppError(error);
  const { data: items, error: itemsError } = await supabase
    .from("gallery_media")
    .select("*, media_assets(*)")
    .eq("gallery_id", data.id)
    .order("sort_order");
  if (itemsError) throw toAppError(itemsError);
  return { gallery: gallery as MediaGalleryRow, items: items ?? [] };
};

export const upsertMediaGallery = async ({
  data,
}: {
  data: {
    id?: string;
    name: string;
    description?: string | null;
    cover_asset_id?: string | null;
    gallery_type?: MediaGalleryType;
    tags?: string[];
    status?: MediaGalleryStatus;
    visibility?: MediaGalleryVisibility;
    published_at?: string | null;
    slug?: string;
  };
}) => {
  const { user } = await requirePermission("media:upload");
  const slug = data.slug?.trim() || slugify(data.name);
  const payload = {
    name: data.name.trim(),
    slug,
    description: data.description?.trim() || null,
    cover_asset_id: data.cover_asset_id || null,
    gallery_type: data.gallery_type ?? "photo",
    tags: normalizeTags(data.tags),
    status: data.status ?? "draft",
    visibility: data.visibility ?? "private",
    published_at:
      data.status === "published"
        ? data.published_at || new Date().toISOString()
        : (data.published_at ?? null),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (data.id) {
    const { data: row, error } = await supabase
      .from("media_galleries")
      .update(payload)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    await writeAuditLog({
      actor_id: user.id,
      action: "gallery.update",
      entity_type: "media_gallery",
      entity_id: data.id,
      summary: `Updated gallery ${payload.name}`,
    });
    return row as MediaGalleryRow;
  }

  const { data: row, error } = await supabase
    .from("media_galleries")
    .insert({ ...payload, created_by: user.id })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "gallery.create",
    entity_type: "media_gallery",
    entity_id: row.id,
    summary: `Created gallery ${payload.name}`,
  });
  return row as MediaGalleryRow;
};

export const deleteMediaGallery = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePermission("media:upload");
  const { error } = await supabase.from("media_galleries").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "gallery.delete",
    entity_type: "media_gallery",
    entity_id: data.id,
    summary: "Deleted gallery",
  });
  return { ok: true };
};

export const duplicateMediaGallery = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePermission("media:upload");
  const detail = await getMediaGallery({ data: { id: data.id } });
  const copy = await upsertMediaGallery({
    data: {
      name: `${detail.gallery.name} (Copy)`,
      description: detail.gallery.description,
      gallery_type: detail.gallery.gallery_type,
      tags: detail.gallery.tags,
      status: "draft",
      visibility: detail.gallery.visibility,
      cover_asset_id: detail.gallery.cover_asset_id,
    },
  });
  if (detail.items.length) {
    await addMediaToGallery({
      data: {
        gallery_id: copy.id,
        asset_ids: detail.items.map((item) => item.asset_id as string),
      },
    });
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "gallery.duplicate",
    entity_type: "media_gallery",
    entity_id: copy.id,
    summary: `Duplicated gallery from ${data.id}`,
  });
  return copy;
};

export const addMediaToGallery = async ({
  data,
}: {
  data: { gallery_id: string; asset_ids: string[] };
}) => {
  await requirePermission("media:upload");
  if (!data.asset_ids.length) throw new Error("Select at least one asset.");
  const { data: existing } = await supabase
    .from("gallery_media")
    .select("sort_order")
    .eq("gallery_id", data.gallery_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  let order = (existing?.[0]?.sort_order ?? -1) + 1;
  const rows = data.asset_ids.map((asset_id) => ({
    gallery_id: data.gallery_id,
    asset_id,
    sort_order: order++,
  }));
  const { error } = await supabase.from("gallery_media").upsert(rows, {
    onConflict: "gallery_id,asset_id",
    ignoreDuplicates: true,
  });
  if (error) throw toAppError(error);
  return { ok: true };
};

export const removeMediaFromGallery = async ({
  data,
}: {
  data: { gallery_id: string; asset_ids: string[] };
}) => {
  await requirePermission("media:upload");
  const { error } = await supabase
    .from("gallery_media")
    .delete()
    .eq("gallery_id", data.gallery_id)
    .in("asset_id", data.asset_ids);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const reorderGalleryMedia = async ({
  data,
}: {
  data: { gallery_id: string; ordered_asset_ids: string[] };
}) => {
  await requirePermission("media:upload");
  for (let i = 0; i < data.ordered_asset_ids.length; i++) {
    const { error } = await supabase
      .from("gallery_media")
      .update({ sort_order: i })
      .eq("gallery_id", data.gallery_id)
      .eq("asset_id", data.ordered_asset_ids[i]);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const recordArticleMediaUsages = async ({
  data,
}: {
  data: {
    article_id: string;
    title: string;
    slug?: string | null;
    urls: Array<{ field: string; url: string | null | undefined }>;
  };
}) => {
  try {
    await requirePermission("media:view");
  } catch {
    return { ok: false };
  }

  const urls = data.urls.filter((item) => item.url);
  const { error: clearError } = await supabase
    .from("media_asset_usages")
    .delete()
    .eq("entity_type", "article")
    .eq("entity_id", data.article_id);
  if (clearError) {
    if (/media_asset_usages|schema cache|PGRST/i.test(clearError.message)) return { ok: false };
    return { ok: false };
  }
  if (!urls.length) return { ok: true };

  const { data: assets } = await supabase
    .from("media_assets")
    .select("id, public_url")
    .in("public_url", urls.map((item) => item.url!).filter(Boolean));
  if (!assets?.length) return { ok: true };

  const byUrl = new Map(assets.map((asset) => [asset.public_url, asset.id]));
  const path = data.slug ? `/article/${data.slug}` : `/admin/articles/${data.article_id}`;
  const rows = urls
    .map((item) => {
      const assetId = item.url ? byUrl.get(item.url) : undefined;
      if (!assetId) return null;
      return {
        asset_id: assetId,
        entity_type: "article" as const,
        entity_id: data.article_id,
        field: item.field,
        entity_title: data.title,
        entity_path: path,
      };
    })
    .filter(Boolean);

  if (!rows.length) return { ok: true };
  const { error } = await supabase.from("media_asset_usages").upsert(rows as never, {
    onConflict: "asset_id,entity_type,entity_id,field",
  });
  if (error && !/media_asset_usages|schema cache|PGRST/i.test(error.message)) {
    console.error("recordArticleMediaUsages failed", error);
    return { ok: false };
  }
  return { ok: true };
};

export const getPublicGalleryBySlug = async (slug: string) => {
  const { data: gallery, error } = await supabase
    .from("media_galleries")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!gallery) return null;
  const { data: items, error: itemsError } = await supabase
    .from("gallery_media")
    .select("sort_order, caption_override, media_assets(*)")
    .eq("gallery_id", gallery.id)
    .order("sort_order");
  if (itemsError) throw toAppError(itemsError);
  return { gallery: gallery as MediaGalleryRow, items: items ?? [] };
};
