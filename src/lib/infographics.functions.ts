import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toAppError } from "@/lib/db-errors";
import { uploadMediaAsset } from "@/lib/media.functions";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { absoluteUrl, siteUrl } from "@/lib/seo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => (supabase as any).from(table);

export type InfographicStatus = "draft" | "review" | "scheduled" | "published" | "archived";

export type Infographic = {
  id: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  description: string | null;
  long_description: string | null;
  alt_text: string | null;
  category: string | null;
  graphic_type: string | null;
  cover_image_url: string | null;
  source_url: string | null;
  asset_url: string | null;
  asset_path: string | null;
  asset_asset_id: string | null;
  file_format: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  author_name: string | null;
  source: string | null;
  data_source: string | null;
  methodology: string | null;
  data_date: string | null;
  credits: string | null;
  language: string | null;
  region: string | null;
  tags: string[] | null;
  status: string;
  visibility: string;
  allow_download: boolean;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string;
  scheduled_for: string | null;
  archived_at: string | null;
  view_count: number;
  download_count: number;
  share_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InfographicCollection = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  is_featured: boolean;
  featured_item_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InfographicListFilters = {
  search?: string;
  status?: InfographicStatus | "all";
  category?: string | null;
  graphic_type?: string | null;
  year?: number | null;
  author?: string | null;
  archived?: boolean | "only" | "exclude";
  page?: number;
  pageSize?: number;
};

export type InfographicInput = Partial<Infographic> & { title: string };

const VIEW: Permission[] = ["infographics:view", "infographics:manage", "videos:manage"];
const MANAGE: Permission[] = ["infographics:manage", "videos:manage"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `infographic-${Math.random().toString(36).slice(2, 8)}`;

const checkAuth = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
};

const requireInfographicPermission = async (permissions: Permission[]) => {
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
  entity_id?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown>;
}) => {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: entry.actor_id,
    action: entry.action,
    entity_type: "infographic",
    entity_id: entry.entity_id ?? null,
    summary: entry.summary ?? null,
    payload: (entry.payload ?? {}) as Json,
  });
  if (error && !/admin_audit_logs|schema cache|PGRST/i.test(error.message)) {
    console.error("Infographic audit log failed", error);
  }
};

async function ensureUniqueSlug(base: string, excludeId?: string | null) {
  const root = slugify(base);
  const { data: rows } = await from("infographics")
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

function isPubliclyVisible(row: Infographic) {
  if (row.archived_at) return false;
  if (row.visibility === "private") return false;
  if (row.status === "published") return true;
  if (row.status === "scheduled") {
    const due = row.scheduled_for || row.published_at;
    return !!due && new Date(due).getTime() <= Date.now();
  }
  return false;
}

export const INFOGRAPHIC_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];
export const INFOGRAPHIC_DOC_MIMES = ["application/pdf"];

export function validateInfographicFile(file: File, maxBytes = 52428800) {
  const name = file.name.toLowerCase();
  const extOk = /\.(png|jpe?g|webp|svg|pdf)$/i.test(name);
  const mimeOk =
    !file.type ||
    INFOGRAPHIC_IMAGE_MIMES.includes(file.type) ||
    INFOGRAPHIC_DOC_MIMES.includes(file.type);
  if (!mimeOk || !extOk) throw new Error("Only PNG, JPG, WebP, SVG, or PDF files are allowed.");
  if (file.size <= 0) throw new Error("The file is empty.");
  if (file.size > maxBytes)
    throw new Error(`File must be ${(maxBytes / 1024 / 1024).toFixed(0)} MB or smaller.`);
}

export async function readImageDimensions(
  file: File,
): Promise<{ width: number | null; height: number | null }> {
  if (
    typeof window === "undefined" ||
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml"
  ) {
    return { width: null, height: null };
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || null;
      const height = img.naturalHeight || null;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };
    img.src = url;
  });
}

export const getInfographicsDashboard = async () => {
  await requireInfographicPermission(VIEW);
  const { data, error } = await from("infographics")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) throw toAppError(error);
  const rows = (data as Infographic[]) ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return {
    kpis: {
      total: rows.length,
      published: rows.filter((r) => r.status === "published" && !r.archived_at).length,
      draft: rows.filter((r) => r.status === "draft").length,
      scheduled: rows.filter((r) => r.status === "scheduled" && !r.archived_at).length,
      featured: rows.filter((r) => r.is_featured && !r.archived_at).length,
      totalViews: rows.reduce((s, r) => s + (r.view_count ?? 0), 0),
      totalDownloads: rows.reduce((s, r) => s + (r.download_count ?? 0), 0),
      shares: rows.reduce((s, r) => s + (r.share_count ?? 0), 0),
      thisMonth: rows.filter((r) => r.created_at >= monthStart).length,
    },
    recent: rows.slice(0, 12),
  };
};

export const listInfographicsAdmin = async (filters: InfographicListFilters = {}) => {
  await requireInfographicPermission(VIEW);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  let query = from("infographics")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(
      `title.ilike.%${q}%,author_name.ilike.%${q}%,category.ilike.%${q}%,source.ilike.%${q}%`,
    );
  }
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.graphic_type) query = query.eq("graphic_type", filters.graphic_type);
  if (filters.author) query = query.ilike("author_name", `%${filters.author}%`);
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
  return { rows: (data as Infographic[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getInfographicAdmin = async (id: string) => {
  await requireInfographicPermission(VIEW);
  const { data, error } = await from("infographics").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error("Infographic not found.");
  return data as Infographic;
};

export const upsertInfographicFull = async ({ data }: { data: InfographicInput }) => {
  const { user } = await requireInfographicPermission(MANAGE);
  if (!data.title?.trim()) throw new Error("Title is required.");
  const slug = await ensureUniqueSlug(data.slug?.trim() || data.title, data.id ?? null);
  const status = data.status ?? "draft";
  const assetUrl = data.asset_url?.trim() || data.source_url?.trim() || null;
  const payload = {
    title: data.title.trim(),
    slug,
    subtitle: data.subtitle?.trim() || null,
    description: data.description?.trim() || null,
    long_description: data.long_description?.trim() || null,
    alt_text: data.alt_text?.trim() || null,
    category: data.category?.trim() || null,
    graphic_type: data.graphic_type?.trim() || "static",
    cover_image_url: data.cover_image_url?.trim() || assetUrl,
    source_url: data.source_url?.trim() || assetUrl,
    asset_url: assetUrl,
    asset_path: data.asset_path?.trim() || null,
    asset_asset_id: data.asset_asset_id || null,
    file_format: data.file_format?.trim() || null,
    file_size_bytes: data.file_size_bytes ?? null,
    width: data.width ?? null,
    height: data.height ?? null,
    author_name: data.author_name?.trim() || null,
    source: data.source?.trim() || null,
    data_source: data.data_source?.trim() || null,
    methodology: data.methodology?.trim() || null,
    data_date: data.data_date?.trim() || null,
    credits: data.credits?.trim() || null,
    language: data.language?.trim() || "en",
    region: data.region?.trim() || null,
    tags: data.tags ?? [],
    status,
    visibility: data.visibility ?? "public",
    allow_download: data.allow_download ?? true,
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
    ? from("infographics").update(payload).eq("id", data.id)
    : from("infographics").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.id
      ? status === "published"
        ? "infographic.published"
        : "infographic.edited"
      : "infographic.created",
    entity_id: row.id,
    summary: `${data.id ? "Updated" : "Created"} infographic “${row.title}”`,
  });
  return row as Infographic;
};

export const uploadInfographicAsset = async ({
  data,
}: {
  data: { file: File; infographic_id?: string | null; title?: string };
}) => {
  const { user } = await requireInfographicPermission(MANAGE);
  validateInfographicFile(data.file);
  const dims = await readImageDimensions(data.file);
  const uploaded = await uploadMediaAsset({
    data: {
      file: data.file,
      description: data.title ? `Infographic — ${data.title}` : "Infographic asset",
      tags: ["infographic"],
      width: dims.width,
      height: dims.height,
    },
  });
  const format = data.file.name.split(".").pop()?.toLowerCase() || null;
  let item: Infographic;
  if (data.infographic_id) {
    const { data: row, error } = await from("infographics")
      .update({
        asset_url: uploaded.url,
        asset_path: uploaded.path,
        asset_asset_id: uploaded.id,
        source_url: uploaded.url,
        cover_image_url: uploaded.thumbnail_url || uploaded.url,
        file_format: format,
        file_size_bytes: data.file.size,
        width: dims.width,
        height: dims.height,
        updated_by: user.id,
      })
      .eq("id", data.infographic_id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    item = row as Infographic;
    await writeAuditLog({
      actor_id: user.id,
      action: "infographic.uploaded",
      entity_id: item.id,
      summary: `Uploaded asset for “${item.title}”`,
      payload: { asset_id: uploaded.id, size: data.file.size },
    });
  } else {
    const title =
      data.title?.trim() ||
      data.file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim() ||
      "Untitled infographic";
    const slug = await ensureUniqueSlug(title);
    const { data: row, error } = await from("infographics")
      .insert({
        title,
        slug,
        asset_url: uploaded.url,
        asset_path: uploaded.path,
        asset_asset_id: uploaded.id,
        source_url: uploaded.url,
        cover_image_url: uploaded.thumbnail_url || uploaded.url,
        file_format: format,
        file_size_bytes: data.file.size,
        width: dims.width,
        height: dims.height,
        status: "draft",
        allow_download: true,
        published_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw toAppError(error);
    item = row as Infographic;
    await writeAuditLog({
      actor_id: user.id,
      action: "infographic.uploaded",
      entity_id: item.id,
      summary: `Uploaded and created “${item.title}”`,
    });
  }
  return { item, uploaded, dims };
};

export const duplicateInfographic = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireInfographicPermission(MANAGE);
  const source = await getInfographicAdmin(data.id);
  const slug = await ensureUniqueSlug(`${source.slug || source.title}-copy`);
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = source;
  const { data: row, error } = await from("infographics")
    .insert({
      ...rest,
      title: `${source.title} (Copy)`,
      slug,
      status: "draft",
      is_featured: false,
      view_count: 0,
      download_count: 0,
      share_count: 0,
      archived_at: null,
      published_at: new Date().toISOString(),
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return row as Infographic;
};

export const archiveInfographic = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireInfographicPermission(MANAGE);
  const { data: row, error } = await from("infographics")
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
    action: "infographic.archived",
    entity_id: row.id,
    summary: `Archived “${row.title}”`,
  });
  return row as Infographic;
};

export const restoreInfographic = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireInfographicPermission(MANAGE);
  const { data: row, error } = await from("infographics")
    .update({ status: "draft", archived_at: null, updated_by: user.id })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return row as Infographic;
};

export const deleteInfographicFull = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireInfographicPermission(MANAGE);
  const existing = await getInfographicAdmin(data.id);
  const { error } = await from("infographics").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "infographic.deleted",
    entity_id: data.id,
    summary: `Deleted “${existing.title}”`,
  });
  return { ok: true as const };
};

export const setInfographicPublishState = async ({
  data,
}: {
  data: {
    id: string;
    status: "published" | "draft" | "scheduled" | "review";
    scheduled_for?: string | null;
  };
}) => {
  const { user } = await requireInfographicPermission(MANAGE);
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
  const { data: row, error } = await from("infographics")
    .update(patch)
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: data.status === "published" ? "infographic.published" : "infographic.status",
    entity_id: row.id,
    summary: `Set “${row.title}” to ${data.status}`,
  });
  return row as Infographic;
};

export const listInfographicCollectionsAdmin = async () => {
  await requireInfographicPermission(VIEW);
  const { data, error } = await from("infographic_collections")
    .select("*")
    .order("sort_order")
    .order("title");
  if (error && !/infographic_collections|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return (data as InfographicCollection[]) ?? [];
};

export const upsertInfographicCollection = async ({
  data,
}: {
  data: {
    id?: string;
    title: string;
    description?: string | null;
    cover_image_url?: string | null;
    status?: string;
    is_featured?: boolean;
    featured_item_id?: string | null;
    infographic_ids?: string[];
  };
}) => {
  const { user } = await requireInfographicPermission(MANAGE);
  const root = slugify(data.title);
  const { data: existing } = await from("infographic_collections")
    .select("id,slug")
    .or(`slug.eq.${root},slug.like.${root}-%`)
    .limit(200);
  const taken = new Set(
    ((existing as { id: string; slug: string | null }[]) ?? [])
      .filter((r) => r.id !== data.id)
      .map((r) => r.slug)
      .filter(Boolean),
  );
  let slug = root;
  if (taken.has(slug)) {
    for (let n = 2; n <= 200; n += 1) {
      const candidate = `${root}-${n}`;
      if (!taken.has(candidate)) {
        slug = candidate;
        break;
      }
    }
  }
  const payload = {
    title: data.title.trim(),
    slug,
    description: data.description?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    status: data.status ?? "draft",
    is_featured: Boolean(data.is_featured),
    featured_item_id: data.featured_item_id || null,
    updated_by: user.id,
    ...(data.id ? {} : { created_by: user.id }),
  };
  const q = data.id
    ? from("infographic_collections").update(payload).eq("id", data.id)
    : from("infographic_collections").insert(payload);
  const { data: row, error } = await q.select("*").single();
  if (error) throw toAppError(error);
  if (data.infographic_ids) {
    await from("infographic_collection_items").delete().eq("collection_id", row.id);
    if (data.infographic_ids.length) {
      await from("infographic_collection_items").insert(
        data.infographic_ids.map((infographic_id, sort_order) => ({
          collection_id: row.id,
          infographic_id,
          sort_order,
        })),
      );
    }
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "infographic.collection_changed",
    entity_id: row.id,
    summary: `Updated collection “${row.title}”`,
  });
  return row as InfographicCollection;
};

export const getCollectionItems = async (collectionId: string) => {
  await requireInfographicPermission(VIEW);
  const { data, error } = await from("infographic_collection_items")
    .select("*, infographic:infographics(*)")
    .eq("collection_id", collectionId)
    .order("sort_order");
  if (error && !/infographic_collection_items|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return data ?? [];
};

export const reorderCollectionItems = async ({
  data,
}: {
  data: { collection_id: string; infographic_ids: string[] };
}) => {
  const { user } = await requireInfographicPermission(MANAGE);
  for (let i = 0; i < data.infographic_ids.length; i += 1) {
    await from("infographic_collection_items")
      .update({ sort_order: i })
      .eq("collection_id", data.collection_id)
      .eq("infographic_id", data.infographic_ids[i]);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "infographic.collection_reordered",
    entity_id: data.collection_id,
    summary: "Reordered collection items",
  });
  return getCollectionItems(data.collection_id);
};

export const getInfographicAnalyticsOverview = async (days = 30) => {
  await requireInfographicPermission(VIEW);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: items }, { data: events, error }] = await Promise.all([
    from("infographics")
      .select("id,title,slug,view_count,download_count,share_count,category")
      .order("view_count", { ascending: false })
      .limit(50),
    from("infographic_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);
  if (error && !/infographic_events|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  const eventRows =
    (events as { event_type: string; created_at: string; device: string | null }[]) ?? [];
  const byDay: Record<string, { views: number; downloads: number; shares: number }> = {};
  const devices: Record<string, number> = {};
  for (const ev of eventRows) {
    const day = ev.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { views: 0, downloads: 0, shares: 0 };
    if (ev.event_type === "infographic_opened") byDay[day].views += 1;
    if (ev.event_type === "infographic_downloaded") byDay[day].downloads += 1;
    if (ev.event_type === "infographic_shared") byDay[day].shares += 1;
    if (ev.device) devices[ev.device] = (devices[ev.device] ?? 0) + 1;
  }
  const rows = (items as Infographic[]) ?? [];
  return {
    days,
    series: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats })),
    topInfographics: rows.filter((r) => (r.view_count ?? 0) > 0).slice(0, 10),
    deviceBreakdown: devices,
    totals: {
      views: eventRows.filter((e) => e.event_type === "infographic_opened").length,
      downloads: eventRows.filter((e) => e.event_type === "infographic_downloaded").length,
      shares: eventRows.filter((e) => e.event_type === "infographic_shared").length,
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
  const key = "dl_infographic_session";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

export const trackInfographicEvent = async ({
  data,
}: {
  data: {
    infographic_id: string;
    event_type:
      | "infographic_opened"
      | "infographic_zoomed"
      | "infographic_fullscreen"
      | "infographic_downloaded"
      | "infographic_shared";
  };
}) => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { error } = await from("infographic_events").insert({
    infographic_id: data.infographic_id,
    event_type: data.event_type,
    session_key: getOrCreateSessionKey(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    user_agent: ua,
    device: detectDevice(ua),
  });
  if (error && !/infographic_events|schema cache|PGRST|row-level/i.test(error.message)) {
    console.error("Infographic event failed", error);
  }
};

export const getPublicInfographics = async (filters: InfographicListFilters = {}) => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  let query = from("infographics")
    .select(
      "id,title,slug,subtitle,description,cover_image_url,source_url,asset_url,category,graphic_type,published_at,is_featured,allow_download,alt_text,view_count,width,height",
      { count: "exact" },
    )
    .order("published_at", { ascending: false });
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,author_name.ilike.%${q}%`);
  }
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.graphic_type) query = query.eq("graphic_type", filters.graphic_type);
  if (filters.year) {
    query = query
      .gte("published_at", `${filters.year}-01-01T00:00:00.000Z`)
      .lt("published_at", `${filters.year + 1}-01-01T00:00:00.000Z`);
  }
  const fromIdx = (page - 1) * pageSize;
  const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
  if (error) {
    if (/schema cache|PGRST|column/i.test(error.message)) {
      const fallback = await from("infographics")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(pageSize);
      return {
        rows: (fallback.data as Infographic[]) ?? [],
        total: fallback.data?.length ?? 0,
        page,
        pageSize,
      };
    }
    throw toAppError(error);
  }
  return { rows: (data as Infographic[]) ?? [], total: count ?? 0, page, pageSize };
};

export const getPublicInfographicBySlug = async (slug: string) => {
  const { data, error } = await from("infographics").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    if (/schema cache|PGRST|slug/i.test(error.message)) return null;
    throw toAppError(error);
  }
  if (!data || !isPubliclyVisible(data as Infographic)) return null;
  return data as Infographic;
};

export const getPublicCollectionBySlug = async (slug: string) => {
  const { data, error } = await from("infographic_collections")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|infographic_collections/i.test(error.message)) return null;
    throw toAppError(error);
  }
  if (!data || data.status !== "published") return null;
  const items = await from("infographic_collection_items")
    .select("sort_order, infographic:infographics(*)")
    .eq("collection_id", data.id)
    .order("sort_order");
  return { collection: data as InfographicCollection, items: items.data ?? [] };
};

export const getRelatedInfographics = async (id: string, limit = 4) => {
  const { data, error } = await from("infographics")
    .select("id,title,slug,cover_image_url,published_at,category")
    .neq("id", id)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export function infographicSeo(item: Infographic) {
  const title = item.seo_title?.trim() || `${item.title} — Infographic | Diplomacy Lens`;
  const description =
    item.seo_description?.trim() ||
    item.description?.trim() ||
    item.alt_text?.trim() ||
    `View the Diplomacy Lens infographic “${item.title}”.`;
  const path = `/infographics/${item.slug || item.id}`;
  const url = absoluteUrl(path);
  const image =
    item.og_image_url ||
    item.cover_image_url ||
    item.asset_url ||
    absoluteUrl("/images/hero-unsc.jpg");
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

export function canManageInfographics(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, MANAGE);
}

export function canViewInfographics(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, VIEW);
}

export type InfographicSettings = {
  id: boolean;
  max_asset_bytes: number;
  allow_download_default: boolean;
  updated_at: string;
  updated_by: string | null;
};

const DEFAULT_INFOGRAPHIC_SETTINGS: InfographicSettings = {
  id: true,
  max_asset_bytes: 52428800,
  allow_download_default: true,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const getInfographicSettings = async (): Promise<InfographicSettings> => {
  await requireInfographicPermission(VIEW);
  const { data, error } = await from("infographic_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    if (/infographic_settings|schema cache|PGRST/i.test(error.message))
      return DEFAULT_INFOGRAPHIC_SETTINGS;
    throw toAppError(error);
  }
  return data
    ? { ...DEFAULT_INFOGRAPHIC_SETTINGS, ...(data as InfographicSettings) }
    : DEFAULT_INFOGRAPHIC_SETTINGS;
};

export const updateInfographicSettings = async ({
  data,
}: {
  data: Partial<Omit<InfographicSettings, "id" | "updated_at" | "updated_by">>;
}) => {
  const { user } = await requireInfographicPermission(MANAGE);
  const payload = { ...data, updated_at: new Date().toISOString(), updated_by: user.id };
  const { error } = await from("infographic_settings").update(payload).eq("id", true);
  if (error) {
    if (/infographic_settings|schema cache|PGRST/i.test(error.message)) {
      throw new Error("Apply the infographics CMS migration before saving settings.");
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "infographic.settings_update",
    entity_id: "true",
    summary: "Updated infographic settings",
    payload: data,
  });
  return { ok: true };
};
