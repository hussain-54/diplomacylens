import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toAppError } from "@/lib/db-errors";
import { uploadMediaAsset } from "@/lib/media.functions";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { absoluteUrl, siteUrl } from "@/lib/seo";

// Untyped table access while schema migrates ahead of generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => (supabase as any).from(table);

export type PodcastStatus =
  "draft" | "review" | "processing" | "scheduled" | "published" | "archived" | "failed";

export type PodcastShow = {
  id: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  description: string | null;
  short_description: string | null;
  cover_image_url: string | null;
  host: string | null;
  co_hosts: string | null;
  category: string | null;
  tags: string[] | null;
  language: string | null;
  region: string | null;
  website_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  rss_feed_url: string | null;
  status: string;
  visibility: string;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  scheduled_for: string | null;
  archived_at: string | null;
  play_count: number;
  episode_count: number;
  created_at: string;
  updated_at: string;
};

export type PodcastEpisode = {
  id: string;
  title: string;
  slug: string | null;
  show_id: string | null;
  host: string | null;
  guests: string | null;
  artwork_url: string | null;
  audio_url: string | null;
  audio_path: string | null;
  audio_asset_id: string | null;
  external_url: string | null;
  category: string | null;
  tags: string[] | null;
  duration: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  transcript: string | null;
  transcript_language: string | null;
  description: string | null;
  short_description: string | null;
  season_number: number | null;
  episode_number: number | null;
  credits: string | null;
  references_text: string | null;
  language: string | null;
  region: string | null;
  status: string;
  visibility: string;
  processing_status: string;
  processing_error: string | null;
  allow_download: boolean;
  allow_embed: boolean;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string;
  scheduled_for: string | null;
  archived_at: string | null;
  play_count: number;
  download_count: number;
  listener_count: number;
  listen_seconds_total: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PodcastPlaylist = {
  id: string;
  show_id: string | null;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PodcastListFilters = {
  search?: string;
  status?: PodcastStatus | "all";
  show_id?: string | null;
  category?: string | null;
  year?: number | null;
  archived?: boolean | "only" | "exclude";
  page?: number;
  pageSize?: number;
};

export type PodcastShowInput = Partial<PodcastShow> & { title: string; host?: string | null };
export type PodcastEpisodeInput = Partial<PodcastEpisode> & { title: string };

const VIEW: Permission[] = ["podcasts:view", "podcasts:manage", "videos:manage"];
const MANAGE: Permission[] = ["podcasts:manage", "videos:manage"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `podcast-${Math.random().toString(36).slice(2, 8)}`;

const checkAuth = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
};

const requirePodcastPermission = async (permissions: Permission[]) => {
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
    entity_type: entry.entity_type ?? "podcast",
    entity_id: entry.entity_id ?? null,
    summary: entry.summary ?? null,
    payload: (entry.payload ?? {}) as Json,
  });
  if (error && !/admin_audit_logs|schema cache|PGRST/i.test(error.message)) {
    console.error("Podcast audit log failed", error);
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

export const AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
];

export function validateAudioFile(file: File, maxBytes = 209715200) {
  const name = file.name.toLowerCase();
  const extOk = /\.(mp3|wav|m4a|ogg|aac|webm)$/i.test(name);
  const mimeOk = !file.type || AUDIO_MIMES.includes(file.type) || file.type.startsWith("audio/");
  if (!mimeOk || !extOk) throw new Error("Only MP3, WAV, M4A, OGG, AAC, or WEBM audio is allowed.");
  if (file.size <= 0) throw new Error("The audio file is empty.");
  if (file.size > maxBytes)
    throw new Error(`Audio must be ${(maxBytes / 1024 / 1024).toFixed(0)} MB or smaller.`);
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function detectAudioDurationSeconds(file: File): Promise<number | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
    };
    audio.onloadedmetadata = () => {
      const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
      cleanup();
      resolve(d && d > 0 ? d : null);
    };
    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
    audio.src = url;
  });
}

export const getPodcastDashboard = async () => {
  await requirePodcastPermission(VIEW);
  const [{ data: shows }, { data: episodes }] = await Promise.all([
    from("podcast_shows").select("*").limit(500),
    from("podcast_episodes").select("*").order("published_at", { ascending: false }).limit(500),
  ]);
  const showRows = (shows as PodcastShow[]) ?? [];
  const episodeRows = (episodes as PodcastEpisode[]) ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return {
    kpis: {
      totalShows: showRows.filter((s) => !s.archived_at).length,
      totalEpisodes: episodeRows.length,
      published: episodeRows.filter((e) => e.status === "published" && !e.archived_at).length,
      draft: episodeRows.filter((e) => e.status === "draft").length,
      scheduled: episodeRows.filter((e) => e.status === "scheduled" && !e.archived_at).length,
      totalPlays: episodeRows.reduce((s, e) => s + (e.play_count ?? 0), 0),
      uniqueListeners: episodeRows.reduce((s, e) => s + (e.listener_count ?? 0), 0),
      totalListenSeconds: episodeRows.reduce((s, e) => s + Number(e.listen_seconds_total ?? 0), 0),
      episodesThisMonth: episodeRows.filter((e) => e.created_at >= monthStart).length,
    },
    recent: episodeRows.slice(0, 12),
    shows: showRows.slice(0, 8),
  };
};

export const listPodcastShowsAdmin = async (filters: PodcastListFilters = {}) => {
  await requirePodcastPermission(VIEW);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  let query = from("podcast_shows")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${q}%,host.ilike.%${q}%,category.ilike.%${q}%`);
  }
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.archived === "only") query = query.not("archived_at", "is", null);
  else if (filters.archived === "exclude" || filters.archived === false)
    query = query.is("archived_at", null);
  const fromIdx = (page - 1) * pageSize;
  const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
  if (error) throw toAppError(error);
  return { rows: (data as PodcastShow[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getPodcastShowAdmin = async (id: string) => {
  await requirePodcastPermission(VIEW);
  const { data, error } = await from("podcast_shows").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error("Show not found.");
  return data as PodcastShow;
};

export const upsertPodcastShow = async ({ data }: { data: PodcastShowInput }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  if (!data.title?.trim()) throw new Error("Show title is required.");
  const slug = await ensureUniqueSlug(
    "podcast_shows",
    data.slug?.trim() || data.title,
    data.id ?? null,
  );
  const payload = {
    title: data.title.trim(),
    slug,
    subtitle: data.subtitle?.trim() || null,
    description: data.description?.trim() || null,
    short_description: data.short_description?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    host: data.host?.trim() || null,
    co_hosts: data.co_hosts?.trim() || null,
    category: data.category?.trim() || null,
    tags: data.tags ?? [],
    language: data.language?.trim() || "en",
    region: data.region?.trim() || null,
    website_url: data.website_url?.trim() || null,
    youtube_url: data.youtube_url?.trim() || null,
    x_url: data.x_url?.trim() || null,
    facebook_url: data.facebook_url?.trim() || null,
    instagram_url: data.instagram_url?.trim() || null,
    linkedin_url: data.linkedin_url?.trim() || null,
    rss_feed_url: data.rss_feed_url?.trim() || null,
    status: data.status ?? "draft",
    visibility: data.visibility ?? "public",
    is_featured: Boolean(data.is_featured) && data.status === "published",
    seo_title: data.seo_title?.trim() || null,
    seo_description: data.seo_description?.trim() || null,
    og_image_url: data.og_image_url?.trim() || null,
    published_at:
      data.published_at || (data.status === "published" ? new Date().toISOString() : null),
    scheduled_for: data.status === "scheduled" ? data.scheduled_for || null : null,
    updated_by: user.id,
    ...(data.id ? {} : { created_by: user.id }),
  };
  const q = data.id
    ? from("podcast_shows").update(payload).eq("id", data.id)
    : from("podcast_shows").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.id ? "podcast.show_edited" : "podcast.show_created",
    entity_type: "podcast_show",
    entity_id: row.id,
    summary: `${data.id ? "Updated" : "Created"} show “${row.title}”`,
  });
  return row as PodcastShow;
};

export const archivePodcastShow = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const { data: row, error } = await from("podcast_shows")
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
    action: "podcast.show_archived",
    entity_type: "podcast_show",
    entity_id: row.id,
    summary: `Archived show “${row.title}”`,
  });
  return row as PodcastShow;
};

export const restorePodcastShow = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const { data: row, error } = await from("podcast_shows")
    .update({ status: "draft", archived_at: null, updated_by: user.id })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return row as PodcastShow;
};

export const deletePodcastShow = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const existing = await getPodcastShowAdmin(data.id);
  const { error } = await from("podcast_shows").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "podcast.show_deleted",
    entity_type: "podcast_show",
    entity_id: data.id,
    summary: `Deleted show “${existing.title}”`,
  });
  return { ok: true as const };
};

export const listPodcastEpisodesAdmin = async (filters: PodcastListFilters = {}) => {
  await requirePodcastPermission(VIEW);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  let query = from("podcast_episodes")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(
      `title.ilike.%${q}%,host.ilike.%${q}%,guests.ilike.%${q}%,category.ilike.%${q}%`,
    );
  }
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.show_id) query = query.eq("show_id", filters.show_id);
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
  return { rows: (data as PodcastEpisode[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getPodcastEpisodeAdmin = async (id: string) => {
  await requirePodcastPermission(VIEW);
  const { data, error } = await from("podcast_episodes").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error("Episode not found.");
  return data as PodcastEpisode;
};

export const upsertPodcastEpisode = async ({ data }: { data: PodcastEpisodeInput }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  if (!data.title?.trim()) throw new Error("Episode title is required.");
  const slug = await ensureUniqueSlug(
    "podcast_episodes",
    data.slug?.trim() || data.title,
    data.id ?? null,
  );
  const status = data.status ?? "draft";
  const payload = {
    title: data.title.trim(),
    slug,
    show_id: data.show_id || null,
    host: data.host?.trim() || null,
    guests: data.guests?.trim() || null,
    artwork_url: data.artwork_url?.trim() || null,
    audio_url: data.audio_url?.trim() || null,
    audio_path: data.audio_path?.trim() || null,
    audio_asset_id: data.audio_asset_id || null,
    external_url: data.external_url?.trim() || null,
    category: data.category?.trim() || null,
    tags: data.tags ?? [],
    duration: data.duration || formatDuration(data.duration_seconds) || null,
    duration_seconds: data.duration_seconds ?? null,
    file_size_bytes: data.file_size_bytes ?? null,
    transcript: data.transcript?.trim() || null,
    transcript_language: data.transcript_language?.trim() || "en",
    description: data.description?.trim() || null,
    short_description: data.short_description?.trim() || null,
    season_number: data.season_number ?? null,
    episode_number: data.episode_number ?? null,
    credits: data.credits?.trim() || null,
    references_text: data.references_text?.trim() || null,
    language: data.language?.trim() || "en",
    region: data.region?.trim() || null,
    status,
    visibility: data.visibility ?? "public",
    processing_status: data.processing_status ?? (data.audio_url ? "ready" : "pending"),
    allow_download: data.allow_download ?? true,
    allow_embed: data.allow_embed ?? true,
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
    ? from("podcast_episodes").update(payload).eq("id", data.id)
    : from("podcast_episodes").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.id
      ? status === "published"
        ? "podcast.episode_published"
        : "podcast.episode_edited"
      : "podcast.episode_created",
    entity_type: "podcast_episode",
    entity_id: row.id,
    summary: `${data.id ? "Updated" : "Created"} episode “${row.title}”`,
  });
  return row as PodcastEpisode;
};

export const uploadPodcastAudio = async ({
  data,
}: {
  data: { file: File; episode_id?: string | null; title?: string; show_id?: string | null };
}) => {
  const { user } = await requirePodcastPermission(MANAGE);
  validateAudioFile(data.file);
  const durationSeconds = await detectAudioDurationSeconds(data.file);
  const uploaded = await uploadMediaAsset({
    data: {
      file: data.file,
      description: data.title ? `Podcast audio — ${data.title}` : "Podcast audio",
      tags: ["podcast", "audio"],
    },
  });

  let episode: PodcastEpisode;
  if (data.episode_id) {
    const { data: row, error } = await from("podcast_episodes")
      .update({
        audio_url: uploaded.url,
        audio_path: uploaded.path,
        audio_asset_id: uploaded.id,
        file_size_bytes: data.file.size,
        duration_seconds: durationSeconds,
        duration: formatDuration(durationSeconds),
        processing_status: "ready",
        processing_error: null,
        updated_by: user.id,
      })
      .eq("id", data.episode_id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    episode = row as PodcastEpisode;
    await writeAuditLog({
      actor_id: user.id,
      action: "podcast.audio_uploaded",
      entity_type: "podcast_episode",
      entity_id: episode.id,
      summary: `Uploaded audio for “${episode.title}”`,
      payload: { asset_id: uploaded.id, size: data.file.size, duration_seconds: durationSeconds },
    });
  } else {
    const title =
      data.title?.trim() ||
      data.file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim() ||
      "Untitled episode";
    const slug = await ensureUniqueSlug("podcast_episodes", title);
    const { data: row, error } = await from("podcast_episodes")
      .insert({
        title,
        slug,
        show_id: data.show_id || null,
        audio_url: uploaded.url,
        audio_path: uploaded.path,
        audio_asset_id: uploaded.id,
        file_size_bytes: data.file.size,
        duration_seconds: durationSeconds,
        duration: formatDuration(durationSeconds),
        status: "draft",
        processing_status: "ready",
        published_at: new Date().toISOString(),
        allow_download: true,
        allow_embed: true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw toAppError(error);
    episode = row as PodcastEpisode;
    await writeAuditLog({
      actor_id: user.id,
      action: "podcast.audio_uploaded",
      entity_type: "podcast_episode",
      entity_id: episode.id,
      summary: `Uploaded audio and created “${episode.title}”`,
    });
  }
  return { episode, uploaded, durationSeconds };
};

export const duplicatePodcastEpisode = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const source = await getPodcastEpisodeAdmin(data.id);
  const slug = await ensureUniqueSlug("podcast_episodes", `${source.slug || source.title}-copy`);
  const { data: row, error } = await from("podcast_episodes")
    .insert({
      ...source,
      id: undefined,
      title: `${source.title} (Copy)`,
      slug,
      status: "draft",
      is_featured: false,
      play_count: 0,
      download_count: 0,
      listener_count: 0,
      listen_seconds_total: 0,
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
  return row as PodcastEpisode;
};

export const archivePodcastEpisode = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const { data: row, error } = await from("podcast_episodes")
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
    action: "podcast.episode_archived",
    entity_type: "podcast_episode",
    entity_id: row.id,
    summary: `Archived “${row.title}”`,
  });
  return row as PodcastEpisode;
};

export const restorePodcastEpisode = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const { data: row, error } = await from("podcast_episodes")
    .update({ status: "draft", archived_at: null, updated_by: user.id })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return row as PodcastEpisode;
};

export const deletePodcastEpisode = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const existing = await getPodcastEpisodeAdmin(data.id);
  const { error } = await from("podcast_episodes").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "podcast.episode_deleted",
    entity_type: "podcast_episode",
    entity_id: data.id,
    summary: `Deleted “${existing.title}”`,
  });
  return { ok: true as const };
};

export const setPodcastEpisodePublishState = async ({
  data,
}: {
  data: {
    id: string;
    status: "published" | "draft" | "scheduled" | "review";
    scheduled_for?: string | null;
  };
}) => {
  const { user } = await requirePodcastPermission(MANAGE);
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
  const { data: row, error } = await from("podcast_episodes")
    .update(patch)
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.status === "published" ? "podcast.episode_published" : "podcast.episode_status",
    entity_type: "podcast_episode",
    entity_id: row.id,
    summary: `Set “${row.title}” to ${data.status}`,
  });
  return row as PodcastEpisode;
};

export const listPodcastPlaylistsAdmin = async () => {
  await requirePodcastPermission(VIEW);
  const { data, error } = await from("podcast_playlists")
    .select("*")
    .order("sort_order")
    .order("title");
  if (error && !/podcast_playlists|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return (data as PodcastPlaylist[]) ?? [];
};

export const upsertPodcastPlaylist = async ({
  data,
}: {
  data: {
    id?: string;
    title: string;
    show_id?: string | null;
    description?: string | null;
    cover_image_url?: string | null;
    status?: string;
    is_featured?: boolean;
    episode_ids?: string[];
  };
}) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const slug = await ensureUniqueSlug("podcast_playlists", data.title, data.id ?? null);
  const payload = {
    title: data.title.trim(),
    slug,
    show_id: data.show_id || null,
    description: data.description?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    status: data.status ?? "draft",
    is_featured: Boolean(data.is_featured),
    updated_by: user.id,
    ...(data.id ? {} : { created_by: user.id }),
  };
  const q = data.id
    ? from("podcast_playlists").update(payload).eq("id", data.id)
    : from("podcast_playlists").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  if (data.episode_ids) {
    await from("podcast_playlist_items").delete().eq("playlist_id", row.id);
    if (data.episode_ids.length) {
      await from("podcast_playlist_items").insert(
        data.episode_ids.map((episode_id, sort_order) => ({
          playlist_id: row.id,
          episode_id,
          sort_order,
        })),
      );
    }
  }
  return row as PodcastPlaylist;
};

export const getPlaylistItems = async (playlistId: string) => {
  await requirePodcastPermission(VIEW);
  const { data, error } = await from("podcast_playlist_items")
    .select("*, episode:podcast_episodes(*)")
    .eq("playlist_id", playlistId)
    .order("sort_order");
  if (error && !/podcast_playlist_items|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return data ?? [];
};

export const reorderPlaylistItems = async ({
  data,
}: {
  data: { playlist_id: string; episode_ids: string[] };
}) => {
  const { user } = await requirePodcastPermission(MANAGE);
  for (let i = 0; i < data.episode_ids.length; i += 1) {
    await from("podcast_playlist_items")
      .update({ sort_order: i })
      .eq("playlist_id", data.playlist_id)
      .eq("episode_id", data.episode_ids[i]);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "podcast.playlist_reordered",
    entity_type: "podcast_playlist",
    entity_id: data.playlist_id,
    summary: "Reordered playlist episodes",
  });
  return getPlaylistItems(data.playlist_id);
};

export const getPodcastAnalyticsOverview = async (days = 30) => {
  await requirePodcastPermission(VIEW);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: episodes }, { data: events, error }] = await Promise.all([
    from("podcast_episodes")
      .select("id,title,slug,play_count,download_count,listener_count,listen_seconds_total,show_id")
      .order("play_count", { ascending: false })
      .limit(50),
    from("podcast_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);
  if (error && !/podcast_events|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
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
  const epRows = (episodes as PodcastEpisode[]) ?? [];
  return {
    days,
    series: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats })),
    topEpisodes: epRows.filter((e) => (e.play_count ?? 0) > 0).slice(0, 10),
    deviceBreakdown: devices,
    totals: {
      plays: eventRows.filter((e) => e.event_type === "play_started").length,
      downloads: eventRows.filter((e) => e.event_type === "downloaded").length,
      shares: eventRows.filter((e) => e.event_type === "shared").length,
      completions: eventRows.filter((e) => e.event_type === "play_completed").length,
      listenSeconds: epRows.reduce((s, e) => s + Number(e.listen_seconds_total ?? 0), 0),
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
  const key = "dl_podcast_session";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

export const trackPodcastEvent = async ({
  data,
}: {
  data: {
    episode_id: string;
    show_id?: string | null;
    event_type:
      | "episode_opened"
      | "play_started"
      | "play_paused"
      | "play_completed"
      | "seek"
      | "downloaded"
      | "shared"
      | "listen_progress";
    position_seconds?: number | null;
    duration_seconds?: number | null;
  };
}) => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { error } = await from("podcast_events").insert({
    episode_id: data.episode_id,
    show_id: data.show_id ?? null,
    event_type: data.event_type,
    position_seconds: data.position_seconds ?? null,
    duration_seconds: data.duration_seconds ?? null,
    session_key: getOrCreateSessionKey(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    user_agent: ua,
    device: detectDevice(ua),
  });
  if (error && !/podcast_events|schema cache|PGRST|row-level/i.test(error.message)) {
    console.error("Podcast event failed", error);
  }
};

export const getPublicPodcastEpisodes = async (filters: PodcastListFilters = {}) => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  let query = from("podcast_episodes")
    .select(
      "id,title,slug,host,artwork_url,audio_url,external_url,category,duration,duration_seconds,short_description,description,published_at,is_featured,allow_download,play_count,show_id",
      {
        count: "exact",
      },
    )
    .order("published_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${q}%,host.ilike.%${q}%,category.ilike.%${q}%`);
  }
  if (filters.show_id) query = query.eq("show_id", filters.show_id);
  if (filters.category) query = query.eq("category", filters.category);
  const fromIdx = (page - 1) * pageSize;
  const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
  if (error) {
    if (/schema cache|PGRST|column/i.test(error.message)) {
      const fallback = await from("podcast_episodes")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(pageSize);
      return {
        rows: (fallback.data as PodcastEpisode[]) ?? [],
        total: fallback.data?.length ?? 0,
        page,
        pageSize,
      };
    }
    throw toAppError(error);
  }
  return { rows: (data as PodcastEpisode[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getPublicPodcastShows = async () => {
  const { data, error } = await from("podcast_shows")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(40);
  if (error) {
    if (/schema cache|PGRST|podcast_shows/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return ((data as PodcastShow[]) ?? []).filter(isPubliclyVisible);
};

export const getPublicPodcastEpisodeBySlug = async (slug: string) => {
  const { data, error } = await from("podcast_episodes").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    if (/schema cache|PGRST|slug/i.test(error.message)) return null;
    throw toAppError(error);
  }
  if (!data || !isPubliclyVisible(data as PodcastEpisode)) return null;
  return data as PodcastEpisode;
};

export const getPublicPodcastShowBySlug = async (slug: string) => {
  const { data, error } = await from("podcast_shows").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    if (/schema cache|PGRST|podcast_shows/i.test(error.message)) return null;
    throw toAppError(error);
  }
  if (!data || !isPubliclyVisible(data as PodcastShow)) return null;
  return data as PodcastShow;
};

export const getPublicPodcastShowById = async (id: string) => {
  const { data, error } = await from("podcast_shows").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (/schema cache|PGRST|podcast_shows/i.test(error.message)) return null;
    throw toAppError(error);
  }
  if (!data || !isPubliclyVisible(data as PodcastShow)) return null;
  return data as PodcastShow;
};

export const getPublicEpisodesForShow = async (showId: string) => {
  const { data, error } = await from("podcast_episodes")
    .select(
      "id,title,slug,host,artwork_url,audio_url,external_url,category,duration,duration_seconds,short_description,description,published_at,is_featured,allow_download,play_count,show_id,status,visibility,archived_at,scheduled_for",
    )
    .eq("show_id", showId)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/schema cache|PGRST|show_id/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return ((data as PodcastEpisode[]) ?? []).filter(isPubliclyVisible);
};

export const getRelatedPodcastEpisodes = async (episodeId: string, limit = 4) => {
  const { data, error } = await from("podcast_episodes")
    .select("id,title,slug,artwork_url,published_at,duration,host")
    .neq("id", episodeId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export function podcastEpisodeSeo(episode: PodcastEpisode) {
  const title = episode.seo_title?.trim() || `${episode.title} — Podcast | Diplomacy Lens`;
  const description =
    episode.seo_description?.trim() ||
    episode.short_description?.trim() ||
    episode.description?.trim() ||
    `Listen to “${episode.title}” on Diplomacy Lens.`;
  const path = `/podcast/${episode.slug || episode.id}`;
  const url = absoluteUrl(path);
  const image = episode.og_image_url || episode.artwork_url || absoluteUrl("/images/hero-unsc.jpg");
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

export function podcastShowSeo(show: PodcastShow) {
  const title = show.seo_title?.trim() || `${show.title} — Podcast Show | Diplomacy Lens`;
  const description =
    show.seo_description?.trim() ||
    show.short_description?.trim() ||
    show.description?.trim() ||
    `Listen to the “${show.title}” podcast on Diplomacy Lens.`;
  const path = `/podcast/show/${show.slug || show.id}`;
  const url = absoluteUrl(path);
  const image = show.og_image_url || show.cover_image_url || absoluteUrl("/images/hero-unsc.jpg");
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

export function canManagePodcasts(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, MANAGE);
}

export function canViewPodcasts(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, VIEW);
}

export const getPublicPodcastPlaylists = async () => {
  const { data, error } = await from("podcast_playlists")
    .select("*")
    .eq("status", "published")
    .order("sort_order")
    .order("title")
    .limit(40);
  if (error) {
    if (/podcast_playlists|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return (data as PodcastPlaylist[]) ?? [];
};

export const getPublicPodcastPlaylistBySlug = async (slug: string) => {
  const { data, error } = await from("podcast_playlists")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    if (/podcast_playlists|schema cache|PGRST/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return (data as PodcastPlaylist) ?? null;
};

export const getPublicPodcastPlaylistItems = async (playlistId: string) => {
  const { data, error } = await from("podcast_playlist_items")
    .select(
      "sort_order, episode:podcast_episodes(id,title,slug,host,artwork_url,duration,duration_seconds,published_at,status,visibility,archived_at,short_description)",
    )
    .eq("playlist_id", playlistId)
    .order("sort_order");
  if (error) {
    if (/podcast_playlist_items|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return ((data as { sort_order: number; episode: PodcastEpisode | null }[]) ?? [])
    .map((row) => row.episode)
    .filter((ep): ep is PodcastEpisode => !!ep && isPubliclyVisible(ep));
};

export function podcastPlaylistSeo(playlist: PodcastPlaylist) {
  const title = `${playlist.title} — Podcast Playlist | Diplomacy Lens`;
  const description =
    playlist.description?.trim() || `Listen to the “${playlist.title}” playlist on Diplomacy Lens.`;
  const path = `/podcast/playlist/${playlist.slug || playlist.id}`;
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

export type PodcastSettings = {
  id: boolean;
  max_audio_bytes: number;
  allow_download_default: boolean;
  allow_embed_default: boolean;
  updated_at: string;
  updated_by: string | null;
};

const DEFAULT_PODCAST_SETTINGS: PodcastSettings = {
  id: true,
  max_audio_bytes: 209715200,
  allow_download_default: true,
  allow_embed_default: true,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const getPodcastSettings = async (): Promise<PodcastSettings> => {
  await requirePodcastPermission(VIEW);
  const { data, error } = await from("podcast_settings").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (/podcast_settings|schema cache|PGRST/i.test(error.message)) return DEFAULT_PODCAST_SETTINGS;
    throw toAppError(error);
  }
  return data
    ? { ...DEFAULT_PODCAST_SETTINGS, ...(data as PodcastSettings) }
    : DEFAULT_PODCAST_SETTINGS;
};

export const updatePodcastSettings = async ({
  data,
}: {
  data: Partial<Omit<PodcastSettings, "id" | "updated_at" | "updated_by">>;
}) => {
  const { user } = await requirePodcastPermission(MANAGE);
  const payload = { ...data, updated_at: new Date().toISOString(), updated_by: user.id };
  const { error } = await from("podcast_settings").update(payload).eq("id", true);
  if (error) {
    if (/podcast_settings|schema cache|PGRST/i.test(error.message)) {
      throw new Error("Apply the podcasts CMS migration before saving settings.");
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "podcast.settings_update",
    entity_type: "podcast_settings",
    entity_id: "true",
    summary: "Updated podcast settings",
    payload: data,
  });
  return { ok: true };
};
