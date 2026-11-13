import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toAppError } from "@/lib/db-errors";
import { uploadMediaAsset } from "@/lib/media.functions";
import { hasAnyPermission, hasPermission, type Permission } from "@/lib/permissions";
import { absoluteUrl, siteUrl } from "@/lib/seo";

export type EpaperStatus =
  "draft" | "processing" | "ready" | "scheduled" | "published" | "archived" | "failed";

export type EpaperEditionRow = Database["public"]["Tables"]["epaper_editions"]["Row"];
export type EpaperEventType =
  | "epaper_opened"
  | "epaper_page_viewed"
  | "epaper_downloaded"
  | "epaper_shared"
  | "epaper_printed"
  | "epaper_completed"
  | "flipbook_opened";

export type EpaperListFilters = {
  search?: string;
  status?: EpaperStatus | "all";
  year?: number | null;
  month?: number | null;
  language?: string | null;
  region?: string | null;
  category?: string | null;
  edition_type?: string | null;
  publisher?: string | null;
  archived?: boolean | "only" | "exclude";
  page?: number;
  pageSize?: number;
};

export type EpaperEditionInput = {
  id?: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  published_at?: string | null;
  volume_number?: string | null;
  issue_number?: string | null;
  edition_number?: string | null;
  edition_type?: string | null;
  language?: string | null;
  region?: string | null;
  category?: string | null;
  status?: EpaperStatus;
  visibility?: "public" | "private" | "unlisted";
  scheduled_for?: string | null;
  is_featured?: boolean;
  allow_download?: boolean;
  allow_print?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
  cover_image_url?: string | null;
  publisher?: string | null;
  editor_name?: string | null;
  copyright?: string | null;
  credits?: string | null;
  pdf_url?: string | null;
  pdf_path?: string | null;
  pdf_asset_id?: string | null;
  page_count?: number | null;
  file_size_bytes?: number | null;
  processing_status?: string | null;
  sort_order?: number | null;
};

const EPAPER_VIEW: Permission[] = ["epaper:view", "epaper:manage", "videos:manage"];
const EPAPER_MANAGE: Permission[] = ["epaper:manage", "videos:manage"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `edition-${Math.random().toString(36).slice(2, 8)}`;

const checkAuth = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
};

const requireEpaperPermission = async (permissions: Permission[]) => {
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
    entity_type: "epaper_edition",
    entity_id: entry.entity_id ?? null,
    summary: entry.summary ?? null,
    payload: (entry.payload ?? {}) as Json,
  });
  if (error && !/admin_audit_logs|schema cache|PGRST/i.test(error.message)) {
    console.error("ePaper audit log failed", error);
  }
};

export function estimatePdfPageCount(buffer: ArrayBuffer): number | null {
  try {
    const text = new TextDecoder("latin1").decode(buffer);
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
    if (!counts.length) return null;
    const max = Math.max(...counts.filter((n) => Number.isFinite(n) && n > 0 && n < 5000));
    return Number.isFinite(max) && max > 0 ? max : null;
  } catch {
    return null;
  }
}

export function validatePdfFile(file: File, maxBytes = 104857600) {
  const name = file.name.toLowerCase();
  const mimeOk = !file.type || file.type === "application/pdf" || file.type === "application/x-pdf";
  const extOk = name.endsWith(".pdf");
  if (!mimeOk || !extOk) throw new Error("Only PDF files are allowed.");
  if (file.size <= 0) throw new Error("The PDF file is empty.");
  if (file.size > maxBytes) {
    throw new Error(`PDF must be ${(maxBytes / 1024 / 1024).toFixed(0)} MB or smaller.`);
  }
}

async function ensureUniqueSlug(base: string, excludeId?: string | null) {
  const root = slugify(base);
  const { data: rows, error } = await supabase
    .from("epaper_editions")
    .select("id,slug")
    .or(`slug.eq.${root},slug.like.${root}-%`)
    .limit(200);
  if (error) return root;
  const taken = new Set(
    (rows ?? [])
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

function isPubliclyVisible(
  row: Pick<
    EpaperEditionRow,
    "status" | "visibility" | "archived_at" | "published_at" | "scheduled_for"
  >,
) {
  if (row.archived_at) return false;
  if (row.visibility === "private") return false;
  if (row.status === "published") return true;
  if (row.status === "scheduled") {
    const due = row.scheduled_for || row.published_at;
    return !!due && new Date(due).getTime() <= Date.now();
  }
  return false;
}

function mapEditionInput(data: EpaperEditionInput, userId: string, isCreate: boolean) {
  const status = data.status ?? "draft";
  const publishedAt =
    data.published_at?.trim() ||
    (status === "published" || status === "scheduled"
      ? new Date().toISOString()
      : new Date().toISOString());

  return {
    title: data.title.trim(),
    description: data.description?.trim() || null,
    published_at: publishedAt,
    volume_number: data.volume_number?.trim() || null,
    issue_number: data.issue_number?.trim() || null,
    edition_number: data.edition_number?.trim() || null,
    edition_type: data.edition_type?.trim() || "daily",
    language: data.language?.trim() || "en",
    region: data.region?.trim() || null,
    category: data.category?.trim() || null,
    status,
    visibility: data.visibility ?? "public",
    scheduled_for: status === "scheduled" ? data.scheduled_for || null : null,
    is_featured: Boolean(data.is_featured) && status === "published",
    allow_download: data.allow_download ?? true,
    allow_print: data.allow_print ?? true,
    seo_title: data.seo_title?.trim() || null,
    seo_description: data.seo_description?.trim() || null,
    og_image_url: data.og_image_url?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    publisher: data.publisher?.trim() || null,
    editor_name: data.editor_name?.trim() || null,
    copyright: data.copyright?.trim() || null,
    credits: data.credits?.trim() || null,
    pdf_url: data.pdf_url?.trim() || null,
    pdf_path: data.pdf_path?.trim() || null,
    pdf_asset_id: data.pdf_asset_id || null,
    page_count: data.page_count ?? null,
    file_size_bytes: data.file_size_bytes ?? null,
    processing_status: data.processing_status ?? (data.pdf_url ? "ready" : "pending"),
    sort_order: data.sort_order ?? 0,
    read_url: null as string | null,
    updated_by: userId,
    ...(isCreate ? { created_by: userId } : {}),
  };
}

export const getEpaperSettings = async () => {
  await requireEpaperPermission(EPAPER_VIEW);
  const { data, error } = await supabase
    .from("epaper_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error && !/epaper_settings|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
  return (
    data ?? {
      id: true,
      max_pdf_bytes: 104857600,
      allow_download_default: true,
      allow_print_default: true,
      default_viewer_mode: "embed",
      updated_at: new Date().toISOString(),
      updated_by: null,
    }
  );
};

export const updateEpaperSettings = async ({
  data,
}: {
  data: Partial<{
    max_pdf_bytes: number;
    allow_download_default: boolean;
    allow_print_default: boolean;
    default_viewer_mode: string;
  }>;
}) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const { error } = await supabase.from("epaper_settings").upsert({
    id: true,
    ...data,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "epaper.settings_changed",
    summary: "Updated ePaper settings",
    payload: data,
  });
  return getEpaperSettings();
};

export const getEpaperDashboard = async () => {
  await requireEpaperPermission(EPAPER_VIEW);
  const { data, error } = await supabase
    .from("epaper_editions")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) throw toAppError(error);
  const rows = data ?? [];

  const total = rows.length;
  const published = rows.filter((r) => r.status === "published" && !r.archived_at).length;
  const draft = rows.filter((r) => r.status === "draft").length;
  const scheduled = rows.filter((r) => r.status === "scheduled" && !r.archived_at).length;
  const archived = rows.filter((r) => r.status === "archived" || r.archived_at).length;
  const totalDownloads = rows.reduce((sum, r) => sum + (r.download_count ?? 0), 0);
  const totalViews = rows.reduce((sum, r) => sum + (r.view_count ?? 0), 0);
  const totalReaders = rows.reduce((sum, r) => sum + (r.reader_count ?? 0), 0);
  const latest = rows.find((r) => r.status === "published" && !r.archived_at) ?? rows[0] ?? null;
  const recent = rows.slice(0, 12);

  const statusCounts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.archived_at ? "archived" : row.status;
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  return {
    kpis: {
      total,
      published,
      draft,
      scheduled,
      archived,
      totalDownloads,
      totalViews,
      totalReaders,
      latestTitle: latest?.title ?? null,
      latestId: latest?.id ?? null,
      latestSlug: latest?.slug ?? null,
    },
    statusCounts,
    recent,
  };
};

export const listEpaperEditionsAdmin = async (filters: EpaperListFilters = {}) => {
  await requireEpaperPermission(EPAPER_VIEW);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("epaper_editions")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false })
    .range(from, to);

  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(
      `title.ilike.%${q}%,issue_number.ilike.%${q}%,volume_number.ilike.%${q}%,slug.ilike.%${q}%,publisher.ilike.%${q}%`,
    );
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.edition_type) query = query.eq("edition_type", filters.edition_type);
  if (filters.publisher) query = query.ilike("publisher", `%${filters.publisher}%`);
  if (filters.year) {
    const start = `${filters.year}-01-01T00:00:00.000Z`;
    const end = `${filters.year + 1}-01-01T00:00:00.000Z`;
    query = query.gte("published_at", start).lt("published_at", end);
  }
  if (filters.month && filters.year) {
    const m = String(filters.month).padStart(2, "0");
    const start = `${filters.year}-${m}-01T00:00:00.000Z`;
    const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
    const nextYear = filters.month === 12 ? filters.year + 1 : filters.year;
    const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;
    query = query.gte("published_at", start).lt("published_at", end);
  }
  if (filters.archived === "only") {
    query = query.not("archived_at", "is", null);
  } else if (filters.archived === "exclude" || filters.archived === false) {
    query = query.is("archived_at", null);
  }

  const { data, error, count } = await query;
  if (error) throw toAppError(error);
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
};

export const getEpaperEditionAdmin = async (id: string) => {
  await requireEpaperPermission(EPAPER_VIEW);
  const { data, error } = await supabase
    .from("epaper_editions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error("Edition not found.");
  return data;
};

export const upsertEpaperEditionFull = async ({ data }: { data: EpaperEditionInput }) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  if (!data.title?.trim()) throw new Error("Edition title is required.");

  const slug = await ensureUniqueSlug(data.slug?.trim() || data.title, data.id ?? null);
  const payload = {
    ...mapEditionInput(data, user.id, !data.id),
    slug,
    read_url: `/epaper/${slug}`,
  };

  if (data.id) {
    const { data: row, error } = await supabase
      .from("epaper_editions")
      .update(payload)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    await writeAuditLog({
      actor_id: user.id,
      action: data.status === "published" ? "epaper.published" : "epaper.edited",
      entity_id: row.id,
      summary: `Updated edition “${row.title}”`,
      payload: { status: row.status },
    });
    return row;
  }

  const { data: row, error } = await supabase
    .from("epaper_editions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "epaper.created",
    entity_id: row.id,
    summary: `Created edition “${row.title}”`,
  });
  return row;
};

export const duplicateEpaperEdition = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const source = await getEpaperEditionAdmin(data.id);
  const slug = await ensureUniqueSlug(`${source.slug || source.title}-copy`);
  const { data: row, error } = await supabase
    .from("epaper_editions")
    .insert({
      title: `${source.title} (Copy)`,
      slug,
      description: source.description,
      published_at: new Date().toISOString(),
      volume_number: source.volume_number,
      issue_number: source.issue_number,
      edition_number: source.edition_number,
      edition_type: source.edition_type,
      language: source.language,
      region: source.region,
      category: source.category,
      status: "draft",
      visibility: source.visibility,
      allow_download: source.allow_download,
      allow_print: source.allow_print,
      seo_title: source.seo_title,
      seo_description: source.seo_description,
      og_image_url: source.og_image_url,
      cover_image_url: source.cover_image_url,
      publisher: source.publisher,
      editor_name: source.editor_name,
      copyright: source.copyright,
      credits: source.credits,
      pdf_url: source.pdf_url,
      pdf_path: source.pdf_path,
      pdf_asset_id: source.pdf_asset_id,
      page_count: source.page_count,
      file_size_bytes: source.file_size_bytes,
      processing_status: source.processing_status,
      is_featured: false,
      read_url: `/epaper/${slug}`,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "epaper.duplicated",
    entity_id: row.id,
    summary: `Duplicated edition from “${source.title}”`,
    payload: { source_id: source.id },
  });
  return row;
};

export const archiveEpaperEdition = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const { data: row, error } = await supabase
    .from("epaper_editions")
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
    action: "epaper.archived",
    entity_id: row.id,
    summary: `Archived edition “${row.title}”`,
  });
  return row;
};

export const restoreEpaperEdition = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const { data: row, error } = await supabase
    .from("epaper_editions")
    .update({
      status: "draft",
      archived_at: null,
      updated_by: user.id,
    })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "epaper.restored",
    entity_id: row.id,
    summary: `Restored edition “${row.title}”`,
  });
  return row;
};

export const deleteEpaperEditionFull = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const existing = await getEpaperEditionAdmin(data.id);
  const { error } = await supabase.from("epaper_editions").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "epaper.deleted",
    entity_id: data.id,
    summary: `Deleted edition “${existing.title}”`,
  });
  return { ok: true as const };
};

export const setEpaperPublishState = async ({
  data,
}: {
  data: { id: string; status: "published" | "draft" | "scheduled"; scheduled_for?: string | null };
}) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const patch: Database["public"]["Tables"]["epaper_editions"]["Update"] = {
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
  const { data: row, error } = await supabase
    .from("epaper_editions")
    .update(patch)
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action:
      data.status === "published"
        ? "epaper.published"
        : data.status === "scheduled"
          ? "epaper.scheduled"
          : "epaper.unpublished",
    entity_id: row.id,
    summary: `Set “${row.title}” to ${data.status}`,
  });
  return row;
};

export const uploadEpaperPdf = async ({
  data,
}: {
  data: {
    file: File;
    edition_id?: string | null;
    title?: string;
    published_at?: string | null;
    cover_image_url?: string | null;
  };
}) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const settings = await getEpaperSettings().catch(() => ({ max_pdf_bytes: 104857600 }));
  validatePdfFile(data.file, settings.max_pdf_bytes ?? 104857600);

  const buffer = await data.file.arrayBuffer();
  const pageCount = estimatePdfPageCount(buffer);

  const uploaded = await uploadMediaAsset({
    data: {
      file: data.file,
      description: data.title ? `ePaper PDF — ${data.title}` : "ePaper PDF",
      tags: ["epaper", "pdf"],
    },
  });

  let edition: EpaperEditionRow;
  if (data.edition_id) {
    const existing = await getEpaperEditionAdmin(data.edition_id);
    if (existing.pdf_url) {
      const { data: versions } = await supabase
        .from("epaper_pdf_versions")
        .select("version_number")
        .eq("edition_id", existing.id)
        .order("version_number", { ascending: false })
        .limit(1);
      const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;
      await supabase.from("epaper_pdf_versions").insert({
        edition_id: existing.id,
        version_number: nextVersion,
        pdf_url: existing.pdf_url,
        pdf_path: existing.pdf_path,
        pdf_asset_id: existing.pdf_asset_id,
        file_size_bytes: existing.file_size_bytes,
        page_count: existing.page_count,
        uploaded_by: user.id,
        status: "replaced",
      });
    }

    const { data: row, error } = await supabase
      .from("epaper_editions")
      .update({
        pdf_url: uploaded.url,
        pdf_path: uploaded.path,
        pdf_asset_id: uploaded.id,
        file_size_bytes: data.file.size,
        page_count: pageCount,
        processing_status: "ready",
        processing_error: null,
        status:
          existing.status === "processing" || existing.status === "failed"
            ? "ready"
            : existing.status,
        updated_by: user.id,
        ...(data.cover_image_url ? { cover_image_url: data.cover_image_url } : {}),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    edition = row;
    await writeAuditLog({
      actor_id: user.id,
      action: "epaper.pdf_replaced",
      entity_id: edition.id,
      summary: `Replaced PDF for “${edition.title}”`,
      payload: { asset_id: uploaded.id, page_count: pageCount, size: data.file.size },
    });
  } else {
    const title =
      data.title?.trim() ||
      data.file.name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim() ||
      "Untitled edition";
    const slug = await ensureUniqueSlug(title);
    const { data: row, error } = await supabase
      .from("epaper_editions")
      .insert({
        title,
        slug,
        published_at: data.published_at || new Date().toISOString(),
        status: "ready",
        processing_status: "ready",
        pdf_url: uploaded.url,
        pdf_path: uploaded.path,
        pdf_asset_id: uploaded.id,
        file_size_bytes: data.file.size,
        page_count: pageCount,
        cover_image_url: data.cover_image_url || null,
        allow_download: true,
        allow_print: true,
        read_url: `/epaper/${slug}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw toAppError(error);
    edition = row;
    await writeAuditLog({
      actor_id: user.id,
      action: "epaper.pdf_uploaded",
      entity_id: edition.id,
      summary: `Uploaded PDF for “${edition.title}”`,
      payload: { asset_id: uploaded.id, page_count: pageCount, size: data.file.size },
    });
  }

  const { data: latestVersions } = await supabase
    .from("epaper_pdf_versions")
    .select("version_number")
    .eq("edition_id", edition.id)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextActiveVersion = (latestVersions?.[0]?.version_number ?? 0) + 1;

  await supabase.from("epaper_pdf_versions").insert({
    edition_id: edition.id,
    version_number: nextActiveVersion,
    pdf_url: uploaded.url,
    pdf_path: uploaded.path,
    pdf_asset_id: uploaded.id,
    file_size_bytes: data.file.size,
    page_count: pageCount,
    uploaded_by: user.id,
    status: "active",
  });

  return { edition, uploaded, pageCount };
};

export const listEpaperPdfVersions = async (editionId: string) => {
  await requireEpaperPermission(EPAPER_VIEW);
  const { data, error } = await supabase
    .from("epaper_pdf_versions")
    .select("*")
    .eq("edition_id", editionId)
    .order("version_number", { ascending: false });
  if (error && !/epaper_pdf_versions|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return data ?? [];
};

export const restoreEpaperPdfVersion = async ({
  data,
}: {
  data: { edition_id: string; version_id: string };
}) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const { data: version, error } = await supabase
    .from("epaper_pdf_versions")
    .select("*")
    .eq("id", data.version_id)
    .eq("edition_id", data.edition_id)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!version) throw new Error("Version not found.");

  const current = await getEpaperEditionAdmin(data.edition_id);
  if (current.pdf_url) {
    const { data: versions } = await supabase
      .from("epaper_pdf_versions")
      .select("version_number")
      .eq("edition_id", current.id)
      .order("version_number", { ascending: false })
      .limit(1);
    await supabase.from("epaper_pdf_versions").insert({
      edition_id: current.id,
      version_number: (versions?.[0]?.version_number ?? 0) + 1,
      pdf_url: current.pdf_url,
      pdf_path: current.pdf_path,
      pdf_asset_id: current.pdf_asset_id,
      file_size_bytes: current.file_size_bytes,
      page_count: current.page_count,
      uploaded_by: user.id,
      status: "replaced",
    });
  }

  const { data: row, error: updateError } = await supabase
    .from("epaper_editions")
    .update({
      pdf_url: version.pdf_url,
      pdf_path: version.pdf_path,
      pdf_asset_id: version.pdf_asset_id,
      file_size_bytes: version.file_size_bytes,
      page_count: version.page_count,
      processing_status: "ready",
      processing_error: null,
      updated_by: user.id,
    })
    .eq("id", data.edition_id)
    .select("*")
    .single();
  if (updateError) throw toAppError(updateError);

  await supabase.from("epaper_pdf_versions").update({ status: "restored" }).eq("id", version.id);
  await writeAuditLog({
    actor_id: user.id,
    action: "epaper.pdf_restored",
    entity_id: row.id,
    summary: `Restored PDF version ${version.version_number} for “${row.title}”`,
  });
  return row;
};

export const reprocessEpaperEdition = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireEpaperPermission(EPAPER_MANAGE);
  const edition = await getEpaperEditionAdmin(data.id);
  if (!edition.pdf_url) throw new Error("No PDF attached to this edition.");

  await supabase
    .from("epaper_editions")
    .update({ processing_status: "processing", processing_error: null, updated_by: user.id })
    .eq("id", edition.id);

  try {
    const res = await fetch(edition.pdf_url);
    if (!res.ok) throw new Error(`Could not fetch PDF (${res.status}).`);
    const buffer = await res.arrayBuffer();
    const pageCount = estimatePdfPageCount(buffer);
    const { data: row, error } = await supabase
      .from("epaper_editions")
      .update({
        page_count: pageCount ?? edition.page_count,
        file_size_bytes: buffer.byteLength || edition.file_size_bytes,
        processing_status: "ready",
        processing_error: null,
        status:
          edition.status === "failed" || edition.status === "processing" ? "ready" : edition.status,
        updated_by: user.id,
      })
      .eq("id", edition.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    await writeAuditLog({
      actor_id: user.id,
      action: "epaper.reprocessed",
      entity_id: row.id,
      summary: `Reprocessed flipbook assets for “${row.title}”`,
      payload: { page_count: pageCount },
    });
    return row;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    await supabase
      .from("epaper_editions")
      .update({
        processing_status: "failed",
        processing_error: message,
        status: "failed",
        updated_by: user.id,
      })
      .eq("id", edition.id);
    throw err instanceof Error ? err : new Error(message);
  }
};

export const getEpaperAnalyticsOverview = async (days = 30) => {
  await requireEpaperPermission(EPAPER_VIEW);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: editions, error: edErr }, { data: events, error: evErr }] = await Promise.all([
    supabase
      .from("epaper_editions")
      .select("id,title,slug,view_count,download_count,reader_count,published_at,status")
      .order("view_count", { ascending: false })
      .limit(50),
    supabase
      .from("epaper_events")
      .select("id,edition_id,event_type,page_number,device,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);
  if (edErr) throw toAppError(edErr);
  if (evErr && !/epaper_events|schema cache|PGRST/i.test(evErr.message)) throw toAppError(evErr);

  const eventRows = events ?? [];
  const byDay: Record<string, { views: number; downloads: number; readers: number }> = {};
  const deviceBreakdown: Record<string, number> = {};
  const pageViews: Record<number, number> = {};

  for (const ev of eventRows) {
    const day = ev.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { views: 0, downloads: 0, readers: 0 };
    if (ev.event_type === "epaper_opened" || ev.event_type === "flipbook_opened")
      byDay[day].views += 1;
    if (ev.event_type === "epaper_downloaded") byDay[day].downloads += 1;
    if (ev.device) deviceBreakdown[ev.device] = (deviceBreakdown[ev.device] ?? 0) + 1;
    if (ev.event_type === "epaper_page_viewed" && ev.page_number) {
      pageViews[ev.page_number] = (pageViews[ev.page_number] ?? 0) + 1;
    }
  }

  const topEditions = (editions ?? [])
    .filter((e) => (e.view_count ?? 0) > 0 || (e.download_count ?? 0) > 0)
    .slice(0, 10);

  const topPages = Object.entries(pageViews)
    .map(([page, count]) => ({ page: Number(page), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    days,
    series: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats })),
    topEditions,
    topPages,
    deviceBreakdown,
    totals: {
      views: eventRows.filter(
        (e) => e.event_type === "epaper_opened" || e.event_type === "flipbook_opened",
      ).length,
      downloads: eventRows.filter((e) => e.event_type === "epaper_downloaded").length,
      shares: eventRows.filter((e) => e.event_type === "epaper_shared").length,
      prints: eventRows.filter((e) => e.event_type === "epaper_printed").length,
      pageViews: eventRows.filter((e) => e.event_type === "epaper_page_viewed").length,
    },
  };
};

export const getEditionAnalytics = async (editionId: string, days = 30) => {
  await requireEpaperPermission(EPAPER_VIEW);
  const edition = await getEpaperEditionAdmin(editionId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await supabase
    .from("epaper_events")
    .select("*")
    .eq("edition_id", editionId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error && !/epaper_events|schema cache|PGRST/i.test(error.message)) throw toAppError(error);
  const eventRows = events ?? [];

  const byDay: Record<string, { views: number; downloads: number }> = {};
  const pageViews: Record<number, number> = {};
  for (const ev of eventRows) {
    const day = ev.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { views: 0, downloads: 0 };
    if (ev.event_type === "epaper_opened" || ev.event_type === "flipbook_opened")
      byDay[day].views += 1;
    if (ev.event_type === "epaper_downloaded") byDay[day].downloads += 1;
    if (ev.event_type === "epaper_page_viewed" && ev.page_number) {
      pageViews[ev.page_number] = (pageViews[ev.page_number] ?? 0) + 1;
    }
  }

  const pageViewEvents = eventRows.filter((e) => e.event_type === "epaper_page_viewed");
  const avgPagesViewed =
    pageViewEvents.length === 0
      ? 0
      : Math.round(
          (pageViewEvents.reduce((s, e) => s + (e.page_number ?? 0), 0) / pageViewEvents.length) *
            10,
        ) / 10;

  return {
    edition,
    series: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats })),
    topPages: Object.entries(pageViews)
      .map(([page, count]) => ({ page: Number(page), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    kpis: {
      views: edition.view_count ?? 0,
      readers: edition.reader_count ?? 0,
      downloads: edition.download_count ?? 0,
      shares: eventRows.filter((e) => e.event_type === "epaper_shared").length,
      avgPagesViewed,
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
  const key = "dl_epaper_session";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

export const trackEpaperEvent = async ({
  data,
}: {
  data: {
    edition_id: string;
    event_type: EpaperEventType;
    page_number?: number | null;
  };
}) => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { error } = await supabase.from("epaper_events").insert({
    edition_id: data.edition_id,
    event_type: data.event_type,
    page_number: data.page_number ?? null,
    session_key: getOrCreateSessionKey(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    user_agent: ua,
    device: detectDevice(ua),
  });
  if (error && !/epaper_events|schema cache|PGRST|row-level/i.test(error.message)) {
    console.error("ePaper event failed", error);
  }
};

/** Public: published editions only (RLS-enforced). */
export const getPublicEpaperEditions = async (filters: EpaperListFilters = {}) => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("epaper_editions")
    .select(
      "id,title,slug,description,cover_image_url,pdf_url,read_url,issue_number,volume_number,page_count,published_at,is_featured,allow_download,language,region,category,view_count,download_count",
      { count: "exact" },
    )
    .order("published_at", { ascending: false })
    .range(from, to);

  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${q}%,issue_number.ilike.%${q}%,volume_number.ilike.%${q}%`);
  }
  if (filters.year) {
    const start = `${filters.year}-01-01T00:00:00.000Z`;
    const end = `${filters.year + 1}-01-01T00:00:00.000Z`;
    query = query.gte("published_at", start).lt("published_at", end);
  }
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error, count } = await query;
  if (error) {
    if (/schema cache|PGRST|column/i.test(error.message)) {
      const fallback = await supabase
        .from("epaper_editions")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(pageSize);
      if (fallback.error) throw toAppError(fallback.error);
      return { rows: fallback.data ?? [], total: fallback.data?.length ?? 0, page, pageSize };
    }
    throw toAppError(error);
  }
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
};

export const getPublicEpaperBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from("epaper_editions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|column|slug/i.test(error.message)) {
      return null;
    }
    throw toAppError(error);
  }
  if (!data || !isPubliclyVisible(data)) return null;
  return data;
};

export const getRelatedPublicEditions = async (editionId: string, limit = 4) => {
  const { data, error } = await supabase
    .from("epaper_editions")
    .select("id,title,slug,cover_image_url,published_at,issue_number,page_count")
    .neq("id", editionId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export function epaperSeo(edition: EpaperEditionRow) {
  const title = edition.seo_title?.trim() || `${edition.title} — ePaper | Diplomacy Lens`;
  const description =
    edition.seo_description?.trim() ||
    edition.description?.trim() ||
    `Read the Diplomacy Lens ePaper edition “${edition.title}”.`;
  const path = `/epaper/${edition.slug || edition.id}`;
  const url = absoluteUrl(path);
  const image =
    edition.og_image_url || edition.cover_image_url || absoluteUrl("/images/hero-unsc.jpg");
  return {
    title,
    description,
    canonical: url,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    site: siteUrl(),
  };
}

export function canManageEpaper(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, EPAPER_MANAGE);
}

export function canViewEpaper(roles: readonly string[] | undefined) {
  return hasAnyPermission(roles, EPAPER_VIEW) || hasPermission(roles, "epaper:view");
}
