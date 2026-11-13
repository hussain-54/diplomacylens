import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";
import { FOOTER_PAGES, getFooterLinksBySection, type FooterSectionId } from "@/lib/footer-pages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type FooterSettings = {
  id: boolean;
  copyright_text: string | null;
  newsletter_enabled: boolean;
  newsletter_heading: string | null;
  newsletter_blurb: string | null;
  social_links: Array<{ label: string; href: string }>;
};

export type FooterColumn = {
  id: string;
  title: string;
  position: number;
  enabled: boolean;
};

export type FooterLink = {
  id: string;
  column_id: string;
  label: string;
  href: string;
  position: number;
  enabled: boolean;
};

export async function getFooterSettings() {
  const { data, error } = await db()
    .from("footer_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return data as FooterSettings | null;
}

export async function updateFooterSettings(patch: Partial<FooterSettings>) {
  const { data, error } = await db()
    .from("footer_settings")
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return data as FooterSettings;
}

export async function listFooterColumns() {
  const { data, error } = await db().from("footer_columns").select("*").order("position");
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [] as FooterColumn[];
    throw toAppError(error);
  }
  return (data ?? []) as FooterColumn[];
}

export async function listFooterLinks(columnId?: string) {
  let query = db().from("footer_links").select("*").order("position");
  if (columnId) query = query.eq("column_id", columnId);
  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [] as FooterLink[];
    throw toAppError(error);
  }
  return (data ?? []) as FooterLink[];
}

export async function upsertFooterColumn(input: {
  id?: string;
  title: string;
  position?: number;
  enabled?: boolean;
}) {
  const payload = {
    title: input.title.trim(),
    position: input.position ?? 0,
    enabled: input.enabled ?? true,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await db()
      .from("footer_columns")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data as FooterColumn;
  }
  const { data, error } = await db().from("footer_columns").insert(payload).select("*").single();
  if (error) throw toAppError(error);
  return data as FooterColumn;
}

export async function upsertFooterLink(input: {
  id?: string;
  column_id: string;
  label: string;
  href: string;
  position?: number;
  enabled?: boolean;
}) {
  const payload = {
    column_id: input.column_id,
    label: input.label.trim(),
    href: input.href.trim(),
    position: input.position ?? 0,
    enabled: input.enabled ?? true,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await db()
      .from("footer_links")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data as FooterLink;
  }
  const { data, error } = await db().from("footer_links").insert(payload).select("*").single();
  if (error) throw toAppError(error);
  return data as FooterLink;
}

/** Seed footer columns/links from the existing static registry (idempotent-ish). */
export async function seedFooterFromRegistry() {
  const existing = await listFooterColumns();
  if (existing.length) return { seeded: false, columns: existing.length };

  const bySection = new Map<FooterSectionId, typeof FOOTER_PAGES>();
  for (const page of FOOTER_PAGES) {
    const list = bySection.get(page.section) ?? [];
    list.push(page);
    bySection.set(page.section, list);
  }

  let position = 0;
  for (const [section, pages] of bySection) {
    const col = await upsertFooterColumn({
      title: pages[0]?.sectionLabel ?? section,
      position: position++,
    });
    let linkPos = 0;
    for (const page of pages) {
      const href =
        page.slug.startsWith("http") || page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
      await upsertFooterLink({
        column_id: col.id,
        label: page.footerLabel ?? page.title,
        href: href === "/" ? "/" : href,
        position: linkPos++,
      });
    }
  }
  return { seeded: true, columns: bySection.size };
}

/**
 * Public footer payload: DB columns when present, otherwise static registry.
 * Never breaks existing footer URLs.
 */
export async function getPublicFooter() {
  const [settings, columns] = await Promise.all([getFooterSettings(), listFooterColumns()]);
  if (!columns.length) {
    return {
      source: "registry" as const,
      copyright: settings?.copyright_text ?? null,
      newsletter_enabled: settings?.newsletter_enabled ?? true,
      newsletter_heading: settings?.newsletter_heading ?? "Newsletter",
      newsletter_blurb: settings?.newsletter_blurb ?? null,
      social_links: settings?.social_links ?? [],
      groups: getFooterLinksBySection(),
    };
  }
  const links = await listFooterLinks();
  const groups = columns
    .filter((c) => c.enabled)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      label: c.title,
      links: links
        .filter((l) => l.column_id === c.id && l.enabled)
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ href: l.href, label: l.label })),
    }));
  return {
    source: "database" as const,
    copyright: settings?.copyright_text ?? null,
    newsletter_enabled: settings?.newsletter_enabled ?? true,
    newsletter_heading: settings?.newsletter_heading ?? "Newsletter",
    newsletter_blurb: settings?.newsletter_blurb ?? null,
    social_links: settings?.social_links ?? [],
    groups,
  };
}
