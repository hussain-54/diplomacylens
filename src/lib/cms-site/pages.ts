import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `page-${Math.random().toString(36).slice(2, 8)}`;

export type CmsPageStatus = "draft" | "scheduled" | "published" | "archived";

export type CmsPage = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  status: CmsPageStatus;
  template_key: string | null;
  seo_title: string | null;
  seo_description: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCmsPages(filters?: { status?: CmsPageStatus }) {
  let query = db().from("cms_pages").select("*").order("updated_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [] as CmsPage[];
    throw toAppError(error);
  }
  return (data ?? []) as CmsPage[];
}

export async function getCmsPage(id: string) {
  const { data, error } = await db().from("cms_pages").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  return data as CmsPage | null;
}

export async function listPageTemplates() {
  const { data, error } = await db().from("cms_page_templates").select("*").order("name");
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function upsertCmsPage(input: {
  id?: string;
  title: string;
  slug?: string;
  body?: string | null;
  status?: CmsPageStatus;
  template_key?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  scheduled_at?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const slug = slugify(input.slug?.trim() || input.title);
  const status = input.status ?? "draft";
  const payload = {
    title: input.title.trim(),
    slug,
    body: input.body ?? null,
    status,
    template_key: input.template_key ?? null,
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    scheduled_at: status === "scheduled" ? (input.scheduled_at ?? null) : null,
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  if (!payload.title) throw new Error("Title is required.");

  let page: CmsPage;
  if (input.id) {
    const existing = await getCmsPage(input.id);
    const publishedAt =
      status === "published"
        ? (existing?.published_at ?? new Date().toISOString())
        : status === "archived"
          ? (existing?.published_at ?? null)
          : null;
    const { data, error } = await db()
      .from("cms_pages")
      .update({ ...payload, published_at: publishedAt })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    page = data as CmsPage;
    if (existing) {
      await savePageRevision(page.id, {
        title: existing.title,
        slug: existing.slug,
        body: existing.body,
        status: existing.status,
        seo_title: existing.seo_title,
        seo_description: existing.seo_description,
        template_key: existing.template_key,
      });
    }
  } else {
    const { data, error } = await db()
      .from("cms_pages")
      .insert({
        ...payload,
        published_at: status === "published" ? new Date().toISOString() : null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();
    if (error) throw toAppError(error);
    page = data as CmsPage;
  }
  return page;
}

export async function getCmsPageBySlug(slug: string) {
  const { data, error } = await db()
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return data as CmsPage | null;
}

export async function listPageRevisions(pageId: string) {
  const { data, error } = await db()
    .from("cms_page_revisions")
    .select("*")
    .eq("page_id", pageId)
    .order("version", { ascending: false });
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function listRecentPageRevisions(limit = 50) {
  const { data, error } = await db()
    .from("cms_page_revisions")
    .select("id,page_id,version,created_at,cms_pages(id,title,slug)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export type CmsPageRevision = {
  id: string;
  page_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
};

async function savePageRevision(pageId: string, snapshot: Record<string, unknown>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: latest } = await db()
    .from("cms_page_revisions")
    .select("version")
    .eq("page_id", pageId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  await db()
    .from("cms_page_revisions")
    .insert({
      page_id: pageId,
      version,
      snapshot,
      created_by: user?.id ?? null,
    });
}

export async function restorePageRevision(pageId: string, revisionId: string) {
  const { data, error } = await db()
    .from("cms_page_revisions")
    .select("*")
    .eq("id", revisionId)
    .eq("page_id", pageId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error("Revision not found.");
  const snap = (data as CmsPageRevision).snapshot ?? {};
  return upsertCmsPage({
    id: pageId,
    title: String(snap.title ?? "Untitled"),
    slug: typeof snap.slug === "string" ? snap.slug : undefined,
    body: typeof snap.body === "string" ? snap.body : null,
    status: (snap.status as CmsPageStatus) ?? "draft",
    template_key: typeof snap.template_key === "string" ? snap.template_key : null,
    seo_title: typeof snap.seo_title === "string" ? snap.seo_title : null,
    seo_description: typeof snap.seo_description === "string" ? snap.seo_description : null,
  });
}
