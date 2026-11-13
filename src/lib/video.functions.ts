import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toAppError } from "@/lib/db-errors";
import { uploadMediaAsset } from "@/lib/media.functions";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { absoluteUrl, siteUrl } from "@/lib/seo";

// Untyped table access while schema migrates ahead of generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => (supabase as any).from(table);

export type VideoStatus =
  "draft" | "review" | "processing" | "scheduled" | "published" | "archived" | "failed";

export type VideoRow = {
  id: string;
  title: string;
  slug: string | null;
  category: string | null;
  description: string | null;
  short_description: string | null;
  language: string | null;
  region: string | null;
  tags: string[] | null;
  credits: string | null;
  source: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  thumbnail_asset_id: string | null;
  video_url: string | null;
  video_path: string | null;
  video_asset_id: string | null;
  file_size_bytes: number | null;
  duration: string | null;
  duration_seconds: number | null;
  status: string;
  visibility: string;
  processing_status: string;
  processing_error: string | null;
  allow_download: boolean;
  is_featured: boolean;
  scheduled_for: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  view_count: number;
  watch_seconds_total: number;
  completion_count: number;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoPlaylist = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  is_featured: boolean;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoCaption = {
  id: string;
  video_id: string;
  language: string;
  label: string | null;
  format: string;
  file_url: string;
  file_path: string | null;
  asset_id: string | null;
  is_default: boolean;
  created_at: string;
};

export type VideoListFilters = {
  search?: string;
  status?: VideoStatus | "all";
  category?: string | null;
  year?: number | null;
  archived?: boolean | "only" | "exclude";
  page?: number;
  pageSize?: number;
};

export type VideoInput = Partial<VideoRow> & { title: string };

const VIEW: Permission[] = ["videos:manage"];
const MANAGE: Permission[] = ["videos:manage"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `video-${Math.random().toString(36).slice(2, 8)}`;

const checkAuth = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
};

const requireVideoPermission = async (permissions: Permission[]) => {
  const user = await checkAuth();
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) throw toAppError(error);
  const roleList = (roles ?? []).map((r) => r.role);
  if (!hasAnyPermission(roleList, permissions)) {
    throw new Error(`Forbidden — missing ${permissions.join(" or ")}.`);
  }
  return { user, roles: roleList };
};

const writeAuditLog = async (entry: {
  actor_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown>;
}) => {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: entry.actor_id,
    action: entry.action,
    entity_type: entry.entity_type ?? "video",
    entity_id: entry.entity_id ?? null,
    summary: entry.summary ?? null,
    payload: (entry.payload ?? {}) as Json,
  });
  if (error && !/admin_audit_logs|schema cache|PGRST/i.test(error.message)) {
    console.error("Video audit log failed", error);
  }
};

async function ensureUniqueSlug(table: string, base: string, excludeId?: string | null) {
  const root = slugify(base);
  const { data: rows } = await from(table)
    .select("id,slug")
    .or(`slug.eq.${root},slug.like.${root}-%`)
    .limit(200);
  const taken = new Set(
    ((rows as { id: string; slug: string | null }[]) ?? [])
      .filter((row) => row.id !== excludeId)
      .map((row) => row.slug)
      .filter(Boolean),
  );
  if (!taken.has(root)) return root;
  for (let n = 2; n <= 200; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function isPubliclyVisible(row: {
  status: string;
  visibility: string;
  archived_at: string | null;
  published_at?: string | null;
  scheduled_for?: string | null;
}) {
  if (row.archived_at) return false;
  if (row.visibility === "private") return false;
  if (row.status === "published") return true;
  if (row.status === "scheduled") {
    const due = row.scheduled_for || row.published_at;
    return !!due && new Date(due).getTime() <= Date.now();
  }
  return false;
}

export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const DEFAULT_MAX_VIDEO_BYTES = 524288000;

export function validateVideoFile(file: File, maxBytes = DEFAULT_MAX_VIDEO_BYTES) {
  const name = file.name.toLowerCase();
  const extOk = /\.(mp4|webm|mov)$/i.test(name);
  const mimeOk = !file.type || VIDEO_MIMES.includes(file.type) || file.type.startsWith("video/");
  if (!mimeOk || !extOk) throw new Error("Only MP4, WEBM, or MOV (QuickTime) video is allowed.");
  if (file.size <= 0) throw new Error("The video file is empty.");
  if (file.size > maxBytes)
    throw new Error(`Video must be ${(maxBytes / 1024 / 1024).toFixed(0)} MB or smaller.`);
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function detectVideoDurationSeconds(file: File): Promise<number | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
    };
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      cleanup();
      resolve(d && d > 0 ? d : null);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

async function getMaxVideoBytes(): Promise<number> {
  const { data, error } = await from("video_settings")
    .select("max_video_bytes")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return DEFAULT_MAX_VIDEO_BYTES;
  return (data.max_video_bytes as number) || DEFAULT_MAX_VIDEO_BYTES;
}

export const getVideoDashboard = async () => {
  await requireVideoPermission(VIEW);
  const [{ data: videos }, { data: playlists }] = await Promise.all([
    from("videos").select("*").order("published_at", { ascending: false }).limit(500),
    from("video_playlists").select("*").order("sort_order").limit(8),
  ]);
  const videoRows = (videos as VideoRow[]) ?? [];
  const playlistRows = (playlists as VideoPlaylist[]) ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return {
    kpis: {
      totalVideos: videoRows.filter((v) => !v.archived_at).length,
      published: videoRows.filter((v) => v.status === "published" && !v.archived_at).length,
      draft: videoRows.filter((v) => v.status === "draft").length,
      scheduled: videoRows.filter((v) => v.status === "scheduled" && !v.archived_at).length,
      totalViews: videoRows.reduce((s, v) => s + (v.view_count ?? 0), 0),
      totalWatchSeconds: videoRows.reduce((s, v) => s + Number(v.watch_seconds_total ?? 0), 0),
      completions: videoRows.reduce((s, v) => s + (v.completion_count ?? 0), 0),
      videosThisMonth: videoRows.filter((v) => v.created_at >= monthStart).length,
    },
    recent: videoRows.slice(0, 12),
    playlists: playlistRows,
  };
};

export const listVideosAdmin = async (filters: VideoListFilters = {}) => {
  await requireVideoPermission(VIEW);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  let query = from("videos")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,author_name.ilike.%${q}%`);
  }
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.year) {
    query = query
      .gte("published_at", `${filters.year}-01-01T00:00:00.000Z`)
      .lt("published_at", `${filters.year + 1}-01-01T00:00:00.000Z`);
  }
  if (filters.archived === "only") query = query.not("archived_at", "is", null);
  else if (filters.archived === "exclude" || filters.archived === false)
    query = query.is("archived_at", null);
  const fromIdx = (page - 1) * pageSize;
  const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
  if (error) throw toAppError(error);
  return { rows: (data as VideoRow[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getVideoAdmin = async (id: string) => {
  await requireVideoPermission(VIEW);
  const { data, error } = await from("videos").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error("Video not found.");
  return data as VideoRow;
};

export const upsertVideoFull = async ({ data }: { data: VideoInput }) => {
  const { user } = await requireVideoPermission(MANAGE);
  if (!data.title?.trim()) throw new Error("Video title is required.");
  const slug = await ensureUniqueSlug("videos", data.slug?.trim() || data.title, data.id ?? null);
  const status = data.status ?? "draft";
  const payload = {
    title: data.title.trim(),
    slug,
    category: data.category?.trim() || null,
    thumbnail_url: data.thumbnail_url?.trim() || null,
    thumbnail_asset_id: data.thumbnail_asset_id || null,
    video_url: data.video_url?.trim() || null,
    video_path: data.video_path?.trim() || null,
    video_asset_id: data.video_asset_id || null,
    file_size_bytes: data.file_size_bytes ?? null,
    duration: data.duration || formatDuration(data.duration_seconds) || null,
    duration_seconds: data.duration_seconds ?? null,
    description: data.description?.trim() || null,
    short_description: data.short_description?.trim() || null,
    credits: data.credits?.trim() || null,
    source: data.source?.trim() || null,
    author_name: data.author_name?.trim() || null,
    language: data.language?.trim() || "en",
    region: data.region?.trim() || null,
    tags: data.tags ?? [],
    status,
    visibility: data.visibility ?? "public",
    processing_status: data.processing_status ?? (data.video_url ? "ready" : "pending"),
    allow_download: Boolean(data.allow_download),
    is_featured: Boolean(data.is_featured) && status === "published",
    seo_title: data.seo_title?.trim() || null,
    seo_description: data.seo_description?.trim() || null,
    og_image_url: data.og_image_url?.trim() || null,
    published_at: data.published_at || new Date().toISOString(),
    scheduled_for: status === "scheduled" ? data.scheduled_for || null : null,
    updated_by: user.id,
    ...(data.id ? {} : { created_by: user.id }),
  };
  const q = data.id
    ? from("videos").update(payload).eq("id", data.id)
    : from("videos").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.id
      ? status === "published"
        ? "video.published"
        : "video.edited"
      : "video.created",
    entity_type: "video",
    entity_id: row.id,
    summary: `${data.id ? "Updated" : "Created"} video "${row.title}"`,
  });
  return row as VideoRow;
};

export const uploadVideoFile = async ({
  data,
}: {
  data: { file: File; video_id?: string | null; title?: string };
}) => {
  const { user } = await requireVideoPermission(MANAGE);
  const maxBytes = await getMaxVideoBytes();
  validateVideoFile(data.file, maxBytes);
  const durationSeconds = await detectVideoDurationSeconds(data.file);
  const uploaded = await uploadMediaAsset({
    data: {
      file: data.file,
      description: data.title ? `Video — ${data.title}` : "Video",
      tags: ["video"],
    },
  });

  let video: VideoRow;
  if (data.video_id) {
    const { data: row, error } = await from("videos")
      .update({
        video_url: uploaded.url,
        video_path: uploaded.path,
        video_asset_id: uploaded.id,
        file_size_bytes: data.file.size,
        duration_seconds: durationSeconds,
        duration: formatDuration(durationSeconds),
        processing_status: "ready",
        processing_error: null,
        updated_by: user.id,
      })
      .eq("id", data.video_id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    video = row as VideoRow;
    await writeAuditLog({
      actor_id: user.id,
      action: "video.file_uploaded",
      entity_type: "video",
      entity_id: video.id,
      summary: `Uploaded video file for "${video.title}"`,
      payload: { asset_id: uploaded.id, size: data.file.size, duration_seconds: durationSeconds },
    });
  } else {
    const title =
      data.title?.trim() ||
      data.file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim() ||
      "Untitled video";
    const slug = await ensureUniqueSlug("videos", title);
    const { data: row, error } = await from("videos")
      .insert({
        title,
        slug,
        video_url: uploaded.url,
        video_path: uploaded.path,
        video_asset_id: uploaded.id,
        file_size_bytes: data.file.size,
        duration_seconds: durationSeconds,
        duration: formatDuration(durationSeconds),
        status: "draft",
        processing_status: "ready",
        published_at: new Date().toISOString(),
        allow_download: false,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw toAppError(error);
    video = row as VideoRow;
    await writeAuditLog({
      actor_id: user.id,
      action: "video.file_uploaded",
      entity_type: "video",
      entity_id: video.id,
      summary: `Uploaded video and created "${video.title}"`,
    });
  }
  return { video, uploaded, durationSeconds };
};

export const duplicateVideo = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireVideoPermission(MANAGE);
  const source = await getVideoAdmin(data.id);
  const slug = await ensureUniqueSlug("videos", `${source.slug || source.title}-copy`);
  const { data: row, error } = await from("videos")
    .insert({
      ...source,
      id: undefined,
      title: `${source.title} (Copy)`,
      slug,
      status: "draft",
      is_featured: false,
      view_count: 0,
      watch_seconds_total: 0,
      completion_count: 0,
      archived_at: null,
      published_at: new Date().toISOString(),
      created_by: user.id,
      updated_by: user.id,
      created_at: undefined,
      updated_at: undefined,
    })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return row as VideoRow;
};

export const archiveVideo = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireVideoPermission(MANAGE);
  const { data: row, error } = await from("videos")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      is_featured: false,
      updated_by: user.id,
    })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "video.archived",
    entity_type: "video",
    entity_id: row.id,
    summary: `Archived "${row.title}"`,
  });
  return row as VideoRow;
};

export const restoreVideo = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireVideoPermission(MANAGE);
  const { data: row, error } = await from("videos")
    .update({ status: "draft", archived_at: null, updated_by: user.id })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return row as VideoRow;
};

export const deleteVideoFull = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireVideoPermission(MANAGE);
  const existing = await getVideoAdmin(data.id);
  const { error } = await from("videos").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "video.deleted",
    entity_type: "video",
    entity_id: data.id,
    summary: `Deleted "${existing.title}"`,
  });
  return { ok: true as const };
};

export const setVideoPublishState = async ({
  data,
}: {
  data: {
    id: string;
    status: "published" | "draft" | "scheduled" | "review";
    scheduled_for?: string | null;
  };
}) => {
  const { user } = await requireVideoPermission(MANAGE);
  const patch: Record<string, unknown> = {
    status: data.status,
    updated_by: user.id,
    archived_at: null,
  };
  if (data.status === "published") {
    patch.published_at = new Date().toISOString();
    patch.scheduled_for = null;
  }
  if (data.status === "scheduled") {
    if (!data.scheduled_for) throw new Error("Schedule date/time is required.");
    patch.scheduled_for = data.scheduled_for;
    patch.published_at = data.scheduled_for;
  }
  const { data: row, error } = await from("videos")
    .update(patch)
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.status === "published" ? "video.published" : "video.status_changed",
    entity_type: "video",
    entity_id: row.id,
    summary: `Set "${row.title}" to ${data.status}`,
  });
  return row as VideoRow;
};

// ============ PLAYLISTS ============

export const listVideoPlaylistsAdmin = async () => {
  await requireVideoPermission(VIEW);
  const { data, error } = await from("video_playlists")
    .select("*")
    .order("sort_order")
    .order("title");
  if (error && !/video_playlists|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
  return (data as VideoPlaylist[]) ?? [];
};

export const upsertVideoPlaylist = async ({
  data,
}: {
  data: {
    id?: string;
    title: string;
    description?: string | null;
    cover_image_url?: string | null;
    status?: string;
    is_featured?: boolean;
    video_ids?: string[];
  };
}) => {
  const { user } = await requireVideoPermission(MANAGE);
  const slug = await ensureUniqueSlug("video_playlists", data.title, data.id ?? null);
  const payload = {
    title: data.title.trim(),
    slug,
    description: data.description?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    status: data.status ?? "draft",
    is_featured: Boolean(data.is_featured),
    updated_by: user.id,
    ...(data.id ? {} : { created_by: user.id }),
  };
  const q = data.id
    ? from("video_playlists").update(payload).eq("id", data.id)
    : from("video_playlists").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  if (data.video_ids) {
    await from("video_playlist_items").delete().eq("playlist_id", row.id);
    if (data.video_ids.length) {
      await from("video_playlist_items").insert(
        data.video_ids.map((video_id, sort_order) => ({
          playlist_id: row.id,
          video_id,
          sort_order,
        })),
      );
    }
  }
  return row as VideoPlaylist;
};

export const getVideoPlaylistItems = async (playlistId: string) => {
  await requireVideoPermission(VIEW);
  const { data, error } = await from("video_playlist_items")
    .select("*, video:videos(*)")
    .eq("playlist_id", playlistId)
    .order("sort_order");
  if (error && !/video_playlist_items|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return data ?? [];
};

export const reorderVideoPlaylistItems = async ({
  data,
}: {
  data: { playlist_id: string; video_ids: string[] };
}) => {
  const { user } = await requireVideoPermission(MANAGE);
  for (let i = 0; i < data.video_ids.length; i += 1) {
    await from("video_playlist_items")
      .update({ sort_order: i })
      .eq("playlist_id", data.playlist_id)
      .eq("video_id", data.video_ids[i]);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "video.playlist_reordered",
    entity_type: "video_playlist",
    entity_id: data.playlist_id,
    summary: "Reordered playlist videos",
  });
  return getVideoPlaylistItems(data.playlist_id);
};

// ============ CAPTIONS ============

export const listVideoCaptions = async (videoId: string) => {
  await requireVideoPermission(VIEW);
  const { data, error } = await from("video_captions")
    .select("*")
    .eq("video_id", videoId)
    .order("created_at");
  if (error && !/video_captions|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
  return (data as VideoCaption[]) ?? [];
};

export const addVideoCaption = async ({
  data,
}: {
  data: {
    video_id: string;
    language: string;
    label?: string | null;
    format?: "vtt" | "srt";
    file: File;
    is_default?: boolean;
  };
}) => {
  const { user } = await requireVideoPermission(MANAGE);
  const uploaded = await uploadMediaAsset({
    data: {
      file: data.file,
      description: `Caption — ${data.label || data.language}`,
      tags: ["video", "caption"],
    },
  });
  if (data.is_default) {
    await from("video_captions").update({ is_default: false }).eq("video_id", data.video_id);
  }
  const { data: row, error } = await from("video_captions")
    .insert({
      video_id: data.video_id,
      language: data.language.trim() || "en",
      label: data.label?.trim() || null,
      format: data.format ?? (data.file.name.toLowerCase().endsWith(".srt") ? "srt" : "vtt"),
      file_url: uploaded.url,
      file_path: uploaded.path,
      asset_id: uploaded.id,
      is_default: Boolean(data.is_default),
    })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "video.caption_added",
    entity_type: "video",
    entity_id: data.video_id,
    summary: `Added ${data.language} caption`,
  });
  return row as VideoCaption;
};

export const deleteVideoCaption = async ({ data }: { data: { id: string } }) => {
  await requireVideoPermission(MANAGE);
  const { error } = await from("video_captions").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true as const };
};

// ============ ANALYTICS ============

export const getVideoAnalyticsOverview = async (days = 30) => {
  await requireVideoPermission(VIEW);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: videos }, { data: events, error }] = await Promise.all([
    from("videos")
      .select("id,title,slug,view_count,watch_seconds_total,completion_count")
      .order("view_count", { ascending: false })
      .limit(50),
    from("video_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);
  if (error && !/video_events|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
  const eventRows =
    (events as {
      event_type: string;
      created_at: string;
      device: string | null;
      position_seconds: number | null;
    }[]) ?? [];
  const byDay: Record<string, { plays: number; downloads: number }> = {};
  const devices: Record<string, number> = {};
  for (const ev of eventRows) {
    const day = ev.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { plays: 0, downloads: 0 };
    if (ev.event_type === "play_started") byDay[day].plays += 1;
    if (ev.event_type === "downloaded") byDay[day].downloads += 1;
    if (ev.device) devices[ev.device] = (devices[ev.device] ?? 0) + 1;
  }
  const videoRows = (videos as VideoRow[]) ?? [];
  return {
    days,
    series: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats })),
    topVideos: videoRows.filter((v) => (v.view_count ?? 0) > 0).slice(0, 10),
    deviceBreakdown: devices,
    totals: {
      views: eventRows.filter((e) => e.event_type === "play_started").length,
      downloads: eventRows.filter((e) => e.event_type === "downloaded").length,
      shares: eventRows.filter((e) => e.event_type === "shared").length,
      completions: eventRows.filter((e) => e.event_type === "play_completed").length,
      watchSeconds: videoRows.reduce((s, v) => s + Number(v.watch_seconds_total ?? 0), 0),
    },
  };
};

function detectDevice(ua: string | null | undefined) {
  const s = (ua || "").toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

function getOrCreateSessionKey() {
  if (typeof window === "undefined") return null;
  const key = "dl_video_session";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

export const trackVideoEvent = async ({
  data,
}: {
  data: {
    video_id: string;
    event_type:
      | "video_opened"
      | "play_started"
      | "play_paused"
      | "play_completed"
      | "seek"
      | "downloaded"
      | "shared"
      | "watch_progress";
    position_seconds?: number | null;
    duration_seconds?: number | null;
  };
}) => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { error } = await from("video_events").insert({
    video_id: data.video_id,
    event_type: data.event_type,
    position_seconds: data.position_seconds ?? null,
    duration_seconds: data.duration_seconds ?? null,
    session_key: getOrCreateSessionKey(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    user_agent: ua,
    device: detectDevice(ua),
  });
  if (error && !/video_events|schema cache|PGRST|row-level/i.test(error.message)) {
    console.error("Video event failed", error);
  }
};

// ============ PUBLIC ============

export const getPublicVideos = async (filters: VideoListFilters = {}) => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  let query = from("videos")
    .select(
      "id,title,slug,category,thumbnail_url,video_url,duration,duration_seconds,short_description,description,published_at,is_featured,allow_download,view_count,author_name,tags",
      { count: "exact" },
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,author_name.ilike.%${q}%`);
  }
  if (filters.category) query = query.eq("category", filters.category);
  const fromIdx = (page - 1) * pageSize;
  const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
  if (error) {
    if (/schema cache|PGRST|column/i.test(error.message)) {
      const fallback = await from("videos")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(pageSize);
      return {
        rows: (fallback.data as VideoRow[]) ?? [],
        total: fallback.data?.length ?? 0,
        page,
        pageSize,
      };
    }
    throw toAppError(error);
  }
  return { rows: (data as VideoRow[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getPublicVideoBySlug = async (slug: string) => {
  const { data, error } = await from("videos").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    if (/schema cache|PGRST|slug/i.test(error.message)) return null;
    throw toAppError(error);
  }
  if (!data || !isPubliclyVisible(data as VideoRow)) return null;
  return data as VideoRow;
};

export const getRelatedVideos = async (videoId: string, limit = 4) => {
  const { data, error } = await from("videos")
    .select("id,title,slug,thumbnail_url,published_at,duration,category")
    .eq("status", "published")
    .neq("id", videoId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export function videoSeo(video: VideoRow) {
  const title = video.seo_title?.trim() || `${video.title} — Video | Diplomacy Lens`;
  const description =
    video.seo_description?.trim() ||
    video.short_description?.trim() ||
    video.description?.trim() ||
    `Watch "${video.title}" on Diplomacy Lens.`;
  const path = `/video/${video.slug || video.id}`;
  const url = absoluteUrl(path);
  const image = video.og_image_url || video.thumbnail_url || absoluteUrl("/images/hero-unsc.jpg");
  return {
    title,
    description,
    canonical: url,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    site: siteUrl(),
  };
}

export function canManageVideos(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, MANAGE);
}

export function canViewVideos(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, VIEW);
}

export const getPublicVideoPlaylists = async () => {
  const { data, error } = await from("video_playlists")
    .select("*")
    .eq("status", "published")
    .order("sort_order")
    .order("title")
    .limit(40);
  if (error) {
    if (/video_playlists|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return (data as VideoPlaylist[]) ?? [];
};

export const getPublicVideoPlaylistBySlug = async (slug: string) => {
  const { data, error } = await from("video_playlists")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    if (/video_playlists|schema cache|PGRST/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return (data as VideoPlaylist) ?? null;
};

export const getPublicVideoPlaylistItems = async (playlistId: string) => {
  const { data, error } = await from("video_playlist_items")
    .select(
      "sort_order, video:videos(id,title,slug,thumbnail_url,duration,duration_seconds,published_at,status,visibility,archived_at)",
    )
    .eq("playlist_id", playlistId)
    .order("sort_order");
  if (error) {
    if (/video_playlist_items|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return ((data as { sort_order: number; video: VideoRow | null }[]) ?? [])
    .map((row) => row.video)
    .filter(
      (video): video is VideoRow =>
        !!video &&
        video.status === "published" &&
        !video.archived_at &&
        video.visibility !== "private",
    );
};

export function videoPlaylistSeo(playlist: VideoPlaylist) {
  const title = `${playlist.title} — Video Playlist | Diplomacy Lens`;
  const description =
    playlist.description?.trim() ||
    `Watch the “${playlist.title}” video playlist on Diplomacy Lens.`;
  const path = `/video/playlist/${playlist.slug || playlist.id}`;
  const url = absoluteUrl(path);
  const image = playlist.cover_image_url || absoluteUrl("/images/hero-unsc.jpg");
  return {
    title,
    description,
    canonical: url,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    site: siteUrl(),
  };
}

export type VideoSettings = {
  id: boolean;
  max_video_bytes: number;
  allow_download_default: boolean;
  updated_at: string;
  updated_by: string | null;
};

const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  id: true,
  max_video_bytes: DEFAULT_MAX_VIDEO_BYTES,
  allow_download_default: false,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const getVideoSettings = async (): Promise<VideoSettings> => {
  await requireVideoPermission(VIEW);
  const { data, error } = await from("video_settings").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (/video_settings|schema cache|PGRST/i.test(error.message)) return DEFAULT_VIDEO_SETTINGS;
    throw toAppError(error);
  }
  return data ? { ...DEFAULT_VIDEO_SETTINGS, ...(data as VideoSettings) } : DEFAULT_VIDEO_SETTINGS;
};

export const updateVideoSettings = async ({
  data,
}: {
  data: Partial<Omit<VideoSettings, "id" | "updated_at" | "updated_by">>;
}) => {
  const { user } = await requireVideoPermission(MANAGE);
  const payload = { ...data, updated_at: new Date().toISOString(), updated_by: user.id };
  const { error } = await from("video_settings").update(payload).eq("id", true);
  if (error) {
    if (/video_settings|schema cache|PGRST/i.test(error.message)) {
      throw new Error("Apply the videos CMS migration before saving settings.");
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "video.settings_update",
    entity_type: "video_settings",
    entity_id: "true",
    summary: "Updated video settings",
    payload: data,
  });
  return { ok: true };
};
