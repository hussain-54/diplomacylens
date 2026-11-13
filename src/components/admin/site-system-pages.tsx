import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  MetricCard,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
import { listAuthors } from "@/lib/cms-site/authors";
import { getEditorialCalendarItems, upsertEditorialEvent } from "@/lib/cms-site/calendar";
import {
  getCmsPage,
  listCmsPages,
  listPageRevisions,
  listPageTemplates,
  listRecentPageRevisions,
  restorePageRevision,
  upsertCmsPage,
  type CmsPageStatus,
} from "@/lib/cms-site/pages";
import {
  deleteMenuItem,
  getMenuByKey,
  listMenuItems,
  listSiteMenus,
  reorderMenuItems,
  seedHeaderMenuFromNav,
  upsertMenuItem,
} from "@/lib/cms-site/menus";
import {
  getFooterSettings,
  listFooterColumns,
  listFooterLinks,
  seedFooterFromRegistry,
  updateFooterSettings,
  upsertFooterColumn,
  upsertFooterLink,
} from "@/lib/cms-site/footer";
import {
  createQaSignoff,
  getQaDashboard,
  listQaBugs,
  listQaCases,
  upsertQaBug,
  upsertQaCase,
} from "@/lib/cms-site/qa";
import {
  listAdminArticles,
  listBackupRecords,
  listIpWhitelist,
  listAuditLogs,
} from "@/lib/admin.functions";
import { listTaxonomyContentTypes, listTaxonomyLocations } from "@/lib/cms-site/taxonomy";

export function AuthorsListPage({
  kind = "all",
}: {
  kind?: "authors" | "contributors" | "guests" | "all" | "bylines" | "profiles";
}) {
  const listKind = kind === "bylines" || kind === "profiles" ? "all" : kind;
  const q = useQuery({
    queryKey: ["authors-list", listKind],
    queryFn: () => listAuthors(listKind),
  });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={
          kind === "bylines"
            ? "Byline Management"
            : kind === "profiles"
              ? "Author Profiles"
              : kind === "all"
                ? "Authors / Contributors"
                : kind[0].toUpperCase() + kind.slice(1)
        }
        description="Reuses Staff profiles and bylines — no duplicate author directory."
        actions={
          <Link to="/admin/staff/create" className={cmsButton}>
            + Create in Staff
          </Link>
        }
      />
      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "byline", header: "Byline" },
          { key: "roles", header: "Roles" },
          { key: "open", header: "" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={4}
            title="No authors found"
            description="Create staff with editorial roles under Users & Staff."
          />
        ) : null}
        {(q.data ?? []).map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell className="font-medium">{row.name}</DataTableCell>
            <DataTableCell>{row.byline || "—"}</DataTableCell>
            <DataTableCell className="text-xs capitalize">
              {row.roles.join(", ").replaceAll("_", " ")}
            </DataTableCell>
            <DataTableCell>
              <a href={row.href} className={cmsSecondaryButton}>
                Open profile
              </a>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}

export function AuthorAnalyticsPage() {
  const q = useQuery({
    queryKey: ["author-analytics"],
    queryFn: async () => {
      const [authors, articles] = await Promise.all([listAuthors("all"), listAdminArticles()]);
      return authors
        .map((author: Awaited<ReturnType<typeof listAuthors>>[number]) => {
          const mine = articles.filter(
            (a: { author_id?: string | null; status?: string }) => a.author_id === author.id,
          );
          return {
            author,
            total: mine.length,
            published: mine.filter((a: { status?: string }) => a.status === "published").length,
            drafts: mine.filter(
              (a: { status?: string }) => a.status === "draft" || a.status === "review",
            ).length,
          };
        })
        .sort((a: { total: number }, b: { total: number }) => b.total - a.total);
    },
  });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Author Analytics"
        description="Article counts from live articles by author_id — no invented traffic metrics."
      />
      <DataTable
        columns={[
          { key: "name", header: "Author" },
          { key: "total", header: "Articles" },
          { key: "published", header: "Published" },
          { key: "drafts", header: "Open" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={4}
            title="No author activity"
            description="Assign authors on articles to populate this desk."
          />
        ) : null}
        {(q.data ?? []).map((row) => (
          <DataTableRow key={row.author.id}>
            <DataTableCell className="font-medium">{row.author.name}</DataTableCell>
            <DataTableCell>{row.total}</DataTableCell>
            <DataTableCell>{row.published}</DataTableCell>
            <DataTableCell>{row.drafts}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}

export function EditorialCalendarPage({
  mode = "month",
  filterKind,
}: {
  mode?: "day" | "week" | "month";
  filterKind?: "event" | "deadline";
}) {
  const range = useMemo(() => {
    const start = new Date();
    const end = new Date();
    if (mode === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (mode === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [mode]);

  const q = useQuery({
    queryKey: ["editorial-calendar", mode, filterKind, range.start.toISOString()],
    queryFn: () => getEditorialCalendarItems(range.start, range.end),
  });

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [eventType, setEventType] = useState<"event" | "deadline" | "campaign">(
    filterKind ?? "deadline",
  );
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      upsertEditorialEvent({
        title,
        starts_at: new Date(startsAt).toISOString(),
        event_type: eventType,
      }),
    onSuccess: () => {
      toast.success("Event saved");
      void qc.invalidateQueries({ queryKey: ["editorial-calendar"] });
      setTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = (q.data ?? []).filter((item) => (filterKind ? item.kind === filterKind : true));

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={
          filterKind === "deadline"
            ? "Editorial Deadlines"
            : filterKind === "event"
              ? "Editorial Events"
              : `Editorial Calendar · ${mode}`
        }
        description="Scheduled articles, social posts, and editorial events/deadlines from the database."
      />
      {!filterKind ? (
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/editorial-calendar/day" className={cmsSecondaryButton}>
            Day
          </Link>
          <Link to="/admin/editorial-calendar/week" className={cmsSecondaryButton}>
            Week
          </Link>
          <Link to="/admin/editorial-calendar/month" className={cmsSecondaryButton}>
            Month
          </Link>
        </div>
      ) : null}
      <CmsPanel title="Add deadline / event">
        <div className="grid gap-3 p-1 sm:grid-cols-4">
          <Field label="Title">
            <input className={cmsInput} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="When">
            <input
              className={cmsInput}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label="Type">
            <select
              className={cmsInput}
              value={eventType}
              onChange={(e) => setEventType(e.target.value as typeof eventType)}
            >
              <option value="deadline">Deadline</option>
              <option value="event">Event</option>
              <option value="campaign">Campaign</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className={cmsButton}
              disabled={!title.trim() || !startsAt || save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </button>
          </div>
        </div>
      </CmsPanel>
      {!items.length ? (
        <CmsEmptyState
          title="Nothing scheduled in this range"
          description="Schedule articles or social posts, or add a deadline above."
        />
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">
                {item.kind} · {new Date(item.at).toLocaleString()}
                {item.meta ? ` · ${item.meta}` : ""}
              </div>
            </div>
            {item.href ? (
              <a href={item.href} className={cmsSecondaryButton}>
                Open
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CmsPageTemplatesPage() {
  const q = useQuery({ queryKey: ["cms-page-templates"], queryFn: listPageTemplates });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Page Templates"
        description="Templates seeded in cms_page_templates. Apply them when editing a page."
      />
      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "key", header: "Key" },
          { key: "desc", header: "Description" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={3}
            title="No templates"
            description="Apply the cms_page_templates migration."
          />
        ) : null}
        {(q.data ?? []).map(
          (row: {
            id: string;
            name: string;
            template_key: string;
            description?: string | null;
          }) => (
            <DataTableRow key={row.id}>
              <DataTableCell className="font-medium">{row.name}</DataTableCell>
              <DataTableCell>
                <code>{row.template_key}</code>
              </DataTableCell>
              <DataTableCell>{row.description || "—"}</DataTableCell>
            </DataTableRow>
          ),
        )}
      </DataTable>
    </div>
  );
}

export function CmsPageRevisionsIndexPage() {
  const q = useQuery({
    queryKey: ["cms-page-revisions-recent"],
    queryFn: () => listRecentPageRevisions(50),
  });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Page Revisions"
        description="Recent snapshots across CMS pages. Restore from the page editor."
      />
      <DataTable
        columns={[
          { key: "page", header: "Page" },
          { key: "version", header: "Version" },
          { key: "when", header: "Saved" },
          { key: "open", header: "" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={4}
            title="No revisions yet"
            description="Revisions are created when you save an existing page."
          />
        ) : null}
        {(q.data ?? []).map(
          (row: {
            id: string;
            page_id: string;
            version: number;
            created_at: string;
            cms_pages?:
              | { id: string; title: string; slug: string }
              | { id: string; title: string; slug: string }[]
              | null;
          }) => {
            const page = Array.isArray(row.cms_pages) ? row.cms_pages[0] : row.cms_pages;
            return (
              <DataTableRow key={row.id}>
                <DataTableCell className="font-medium">{page?.title ?? row.page_id}</DataTableCell>
                <DataTableCell>v{row.version}</DataTableCell>
                <DataTableCell>{new Date(row.created_at).toLocaleString()}</DataTableCell>
                <DataTableCell>
                  <Link
                    to="/admin/pages/$id"
                    params={{ id: row.page_id }}
                    className={cmsSecondaryButton}
                  >
                    Open editor
                  </Link>
                </DataTableCell>
              </DataTableRow>
            );
          },
        )}
      </DataTable>
    </div>
  );
}

export function CmsPagesListPage({ status }: { status?: CmsPageStatus }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cms-pages", status],
    queryFn: () => listCmsPages(status ? { status } : undefined),
  });
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: () => upsertCmsPage({ title, status: "draft" }),
    onSuccess: (page) => {
      toast.success("Page created");
      void qc.invalidateQueries({ queryKey: ["cms-pages"] });
      setTitle("");
      void navigate({ to: "/admin/pages/$id", params: { id: page.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Pages"
        description="Editable CMS pages. Public policy footer pages remain intact."
      />
      <CmsPanel title="Create page">
        <div className="flex flex-wrap gap-2 p-1">
          <input
            className={cmsInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
          />
          <button
            type="button"
            className={cmsButton}
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Create draft
          </button>
        </div>
      </CmsPanel>
      <DataTable
        columns={[
          { key: "title", header: "Title" },
          { key: "slug", header: "Slug" },
          { key: "status", header: "Status" },
          { key: "open", header: "" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={4}
            title="No CMS pages"
            description="Apply cms_pages migration, then create a draft."
          />
        ) : null}
        {(q.data ?? []).map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell className="font-medium">
              <Link to="/admin/pages/$id" params={{ id: row.id }} className="hover:underline">
                {row.title}
              </Link>
            </DataTableCell>
            <DataTableCell>/page/{row.slug}</DataTableCell>
            <DataTableCell className="capitalize">{row.status}</DataTableCell>
            <DataTableCell>
              <Link to="/admin/pages/$id" params={{ id: row.id }} className={cmsSecondaryButton}>
                Edit
              </Link>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}

export function CmsPageEditorPage({ pageId }: { pageId: string }) {
  const qc = useQueryClient();
  const pageQ = useQuery({ queryKey: ["cms-page", pageId], queryFn: () => getCmsPage(pageId) });
  const revQ = useQuery({
    queryKey: ["cms-page-revisions", pageId],
    queryFn: () => listPageRevisions(pageId),
  });
  const templatesQ = useQuery({ queryKey: ["cms-page-templates"], queryFn: listPageTemplates });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<CmsPageStatus>("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    const p = pageQ.data;
    if (!p) return;
    setTitle(p.title);
    setSlug(p.slug);
    setBody(p.body ?? "");
    setStatus(p.status);
    setSeoTitle(p.seo_title ?? "");
    setSeoDescription(p.seo_description ?? "");
    setTemplateKey(p.template_key ?? "");
    setScheduledAt(p.scheduled_at ? p.scheduled_at.slice(0, 16) : "");
  }, [pageQ.data]);

  const save = useMutation({
    mutationFn: (nextStatus?: CmsPageStatus) =>
      upsertCmsPage({
        id: pageId,
        title,
        slug,
        body,
        status: nextStatus ?? status,
        template_key: templateKey || null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      }),
    onSuccess: (page) => {
      toast.success(page.status === "published" ? "Published" : "Saved");
      setStatus(page.status);
      void qc.invalidateQueries({ queryKey: ["cms-page", pageId] });
      void qc.invalidateQueries({ queryKey: ["cms-page-revisions", pageId] });
      void qc.invalidateQueries({ queryKey: ["cms-pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: (revisionId: string) => restorePageRevision(pageId, revisionId),
    onSuccess: () => {
      toast.success("Revision restored");
      void qc.invalidateQueries({ queryKey: ["cms-page", pageId] });
      void qc.invalidateQueries({ queryKey: ["cms-page-revisions", pageId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (pageQ.isLoading) {
    return <CmsEmptyState title="Loading page…" description="" />;
  }
  if (!pageQ.data) {
    return (
      <CmsEmptyState
        title="Page not found"
        description="It may have been deleted or the migration is missing."
      />
    );
  }

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={title || "Edit page"}
        description={`Public URL: /page/${slug || "…"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/pages" className={cmsSecondaryButton}>
              All pages
            </Link>
            {status === "published" ? (
              <a
                href={`/page/${slug}`}
                target="_blank"
                rel="noreferrer"
                className={cmsSecondaryButton}
              >
                View
              </a>
            ) : null}
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={save.isPending}
              onClick={() => save.mutate("draft")}
            >
              Save draft
            </button>
            <button
              type="button"
              className={cmsButton}
              disabled={save.isPending || !title.trim()}
              onClick={() => save.mutate("published")}
            >
              Publish
            </button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <CmsPanel title="Content">
            <div className="grid gap-3 p-1">
              <Field label="Title">
                <input
                  className={cmsInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Slug">
                <input
                  className={cmsInput}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </Field>
              <Field label="Body">
                <textarea
                  className={`${cmsInput} min-h-[280px] font-mono text-sm`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
            </div>
          </CmsPanel>
          <CmsPanel title="SEO">
            <div className="grid gap-3 p-1">
              <Field label="SEO title">
                <input
                  className={cmsInput}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                />
              </Field>
              <Field label="SEO description">
                <textarea
                  className={`${cmsInput} min-h-[80px]`}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                />
              </Field>
            </div>
          </CmsPanel>
        </div>
        <div className="space-y-4">
          <CmsPanel title="Publishing">
            <div className="grid gap-3 p-1">
              <Field label="Status">
                <select
                  className={cmsInput}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CmsPageStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Schedule">
                <input
                  className={cmsInput}
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </Field>
              <Field label="Template">
                <select
                  className={cmsInput}
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                >
                  <option value="">Default</option>
                  {(templatesQ.data ?? []).map(
                    (t: { key?: string; name?: string; template_key?: string }) => (
                      <option
                        key={String(t.key ?? t.template_key)}
                        value={String(t.key ?? t.template_key)}
                      >
                        {t.name ?? t.key ?? t.template_key}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <button
                type="button"
                className={cmsButton}
                disabled={save.isPending}
                onClick={() => save.mutate(status)}
              >
                Save
              </button>
            </div>
          </CmsPanel>
          <CmsPanel title="Revisions">
            <ul className="space-y-2 p-2 text-sm">
              {!(revQ.data ?? []).length ? (
                <li className="text-muted-foreground">No revisions yet — saved on each update.</li>
              ) : null}
              {(revQ.data ?? []).map((rev: { id: string; version: number; created_at: string }) => (
                <li key={rev.id} className="flex items-center justify-between gap-2">
                  <span>
                    v{rev.version} · {new Date(rev.created_at).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className={cmsSecondaryButton}
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(rev.id)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </CmsPanel>
        </div>
      </div>
    </div>
  );
}

export function MenusBuilderPage({ menuKey = "main" }: { menuKey?: string }) {
  const qc = useQueryClient();
  const menusQ = useQuery({ queryKey: ["site-menus"], queryFn: listSiteMenus });
  const menuQ = useQuery({
    queryKey: ["site-menu", menuKey],
    queryFn: () => getMenuByKey(menuKey),
  });
  const itemsQ = useQuery({
    queryKey: ["site-menu-items", menuQ.data?.id],
    enabled: !!menuQ.data?.id,
    queryFn: () => listMenuItems(menuQ.data!.id),
  });
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const add = useMutation({
    mutationFn: () =>
      upsertMenuItem({
        menu_id: menuQ.data!.id,
        label,
        href,
        position: (itemsQ.data ?? []).length,
      }),
    onSuccess: () => {
      toast.success("Menu item added");
      void qc.invalidateQueries({ queryKey: ["site-menu-items"] });
      setLabel("");
      setHref("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["site-menu-items"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => reorderMenuItems(menuQ.data!.id, orderedIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["site-menu-items"] });
      void qc.invalidateQueries({ queryKey: ["public-nav"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const seedNav = useMutation({
    mutationFn: async () => {
      const { STATIC_NAV_SEED } = await import("@/lib/cms-site/static-nav");
      return seedHeaderMenuFromNav(STATIC_NAV_SEED, menuKey === "main" ? "main" : menuKey);
    },
    onSuccess: (r) => {
      toast.success(r.seeded ? "Menu seeded from public nav" : "Menu already has items");
      void qc.invalidateQueries({ queryKey: ["site-menu-items"] });
      void qc.invalidateQueries({ queryKey: ["public-nav"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (id: string, dir: -1 | 1) => {
    const items = itemsQ.data ?? [];
    const idx = items.findIndex((i) => i.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    const next = [...items];
    const tmp = next[idx]!;
    next[idx] = next[swap]!;
    next[swap] = tmp;
    reorder.mutate(next.map((i) => i.id));
  };

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Navigation / Menus"
        description="GUI menu builder. Seeded menu keys: main, header, footer, mobile, category, mega. Public header uses DB when items exist."
        actions={
          <button
            type="button"
            className={cmsSecondaryButton}
            disabled={seedNav.isPending}
            onClick={() => seedNav.mutate()}
          >
            Seed from public nav
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {(menusQ.data ?? []).map((m) => (
          <a
            key={m.id}
            href={`/admin/menus${m.menu_key === "main" ? "/builder" : `/${m.menu_key}`}`}
            className={cmsSecondaryButton}
          >
            {m.name}
          </a>
        ))}
      </div>
      {!menuQ.data ? (
        <CmsEmptyState
          title="Menu not found"
          description="Apply site_menus migration to seed default menus."
        />
      ) : (
        <>
          <CmsPanel title={`Edit · ${menuQ.data.name}`}>
            <div className="grid gap-3 p-1 sm:grid-cols-3">
              <Field label="Label">
                <input
                  className={cmsInput}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              <Field label="URL">
                <input
                  className={cmsInput}
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder="/latest"
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className={cmsButton}
                  disabled={!label.trim() || add.isPending}
                  onClick={() => add.mutate()}
                >
                  Add item
                </button>
              </div>
            </div>
          </CmsPanel>
          <ul className="space-y-2">
            {(itemsQ.data ?? []).map((item, index) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {item.label} <span className="text-muted-foreground">{item.href}</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cmsSecondaryButton}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(item.id, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className={cmsSecondaryButton}
                    disabled={index >= (itemsQ.data?.length ?? 0) - 1 || reorder.isPending}
                    onClick={() => move(item.id, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className={cmsSecondaryButton}
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function FooterBuilderPage({
  focus = "all",
}: {
  focus?: "all" | "columns" | "links" | "social" | "newsletter" | "copyright" | "preview";
}) {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["footer-settings"], queryFn: getFooterSettings });
  const columnsQ = useQuery({ queryKey: ["footer-columns"], queryFn: listFooterColumns });
  const linksQ = useQuery({ queryKey: ["footer-links"], queryFn: () => listFooterLinks() });
  const [copyright, setCopyright] = useState("");
  const [newsletterHeading, setNewsletterHeading] = useState("");
  const [newsletterBlurb, setNewsletterBlurb] = useState("");
  const [newsletterEnabled, setNewsletterEnabled] = useState(true);
  const [socialJson, setSocialJson] = useState("[]");
  const [colTitle, setColTitle] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [linkColumnId, setLinkColumnId] = useState("");

  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    setCopyright(s.copyright_text ?? "");
    setNewsletterHeading(s.newsletter_heading ?? "");
    setNewsletterBlurb(s.newsletter_blurb ?? "");
    setNewsletterEnabled(s.newsletter_enabled ?? true);
    setSocialJson(JSON.stringify(s.social_links ?? [], null, 2));
  }, [settingsQ.data]);

  useEffect(() => {
    if (!linkColumnId && columnsQ.data?.[0]?.id) setLinkColumnId(columnsQ.data[0].id);
  }, [columnsQ.data, linkColumnId]);

  const seed = useMutation({
    mutationFn: seedFooterFromRegistry,
    onSuccess: (r) => {
      toast.success(
        r.seeded ? "Footer seeded from existing registry" : "Footer already has columns",
      );
      void qc.invalidateQueries({ queryKey: ["footer-columns"] });
      void qc.invalidateQueries({ queryKey: ["footer-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveSettings = useMutation({
    mutationFn: async () => {
      let social_links: Array<{ label: string; href: string }> = [];
      try {
        social_links = JSON.parse(socialJson || "[]");
        if (!Array.isArray(social_links)) throw new Error("Social links must be a JSON array");
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Invalid social links JSON");
      }
      return updateFooterSettings({
        copyright_text: copyright || null,
        newsletter_enabled: newsletterEnabled,
        newsletter_heading: newsletterHeading || null,
        newsletter_blurb: newsletterBlurb || null,
        social_links,
      });
    },
    onSuccess: () => {
      toast.success("Footer settings saved");
      void qc.invalidateQueries({ queryKey: ["footer-settings"] });
      void qc.invalidateQueries({ queryKey: ["public-footer"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addColumn = useMutation({
    mutationFn: () =>
      upsertFooterColumn({ title: colTitle, position: (columnsQ.data ?? []).length }),
    onSuccess: () => {
      toast.success("Column added");
      setColTitle("");
      void qc.invalidateQueries({ queryKey: ["footer-columns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addLink = useMutation({
    mutationFn: () =>
      upsertFooterLink({
        column_id: linkColumnId,
        label: linkLabel,
        href: linkHref,
        position: (linksQ.data ?? []).filter((l) => l.column_id === linkColumnId).length,
      }),
    onSuccess: () => {
      toast.success("Link added");
      setLinkLabel("");
      setLinkHref("");
      void qc.invalidateQueries({ queryKey: ["footer-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const show = (section: typeof focus) => focus === "all" || focus === section;

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={focus === "all" ? "Footer Management" : `Footer · ${focus}`}
        description="Dynamic footer columns/links. Existing public footer registry remains the fallback until columns exist."
        actions={
          <button
            type="button"
            className={cmsSecondaryButton}
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
          >
            Seed from current footer
          </button>
        }
      />
      {show("copyright") ? (
        <CmsPanel title="Copyright">
          <div className="flex flex-wrap gap-2 p-1">
            <input
              className={cmsInput}
              value={copyright}
              onChange={(e) => setCopyright(e.target.value)}
              placeholder="© Diplomacy Lens…"
            />
            <button
              type="button"
              className={cmsButton}
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              Save
            </button>
          </div>
        </CmsPanel>
      ) : null}
      {show("newsletter") ? (
        <CmsPanel title="Newsletter Block">
          <div className="grid gap-3 p-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newsletterEnabled}
                onChange={(e) => setNewsletterEnabled(e.target.checked)}
              />
              Enabled on public footer
            </label>
            <Field label="Heading">
              <input
                className={cmsInput}
                value={newsletterHeading}
                onChange={(e) => setNewsletterHeading(e.target.value)}
              />
            </Field>
            <Field label="Blurb">
              <textarea
                className={`${cmsInput} min-h-[80px]`}
                value={newsletterBlurb}
                onChange={(e) => setNewsletterBlurb(e.target.value)}
              />
            </Field>
            <button
              type="button"
              className={cmsButton}
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              Save newsletter
            </button>
          </div>
        </CmsPanel>
      ) : null}
      {show("social") ? (
        <CmsPanel title="Social Links">
          <div className="grid gap-3 p-1">
            <Field label='JSON array of {"label","href"}'>
              <textarea
                className={`${cmsInput} min-h-[140px] font-mono text-xs`}
                value={socialJson}
                onChange={(e) => setSocialJson(e.target.value)}
              />
            </Field>
            <button
              type="button"
              className={cmsButton}
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              Save social links
            </button>
          </div>
        </CmsPanel>
      ) : null}
      {show("columns") || show("links") || show("all") ? (
        <CmsPanel title="Add column">
          <div className="flex flex-wrap gap-2 p-1">
            <input
              className={cmsInput}
              value={colTitle}
              onChange={(e) => setColTitle(e.target.value)}
              placeholder="Column title"
            />
            <button
              type="button"
              className={cmsButton}
              disabled={!colTitle.trim() || addColumn.isPending}
              onClick={() => addColumn.mutate()}
            >
              Add column
            </button>
          </div>
        </CmsPanel>
      ) : null}
      {show("links") || show("all") ? (
        <CmsPanel title="Add link">
          <div className="grid gap-3 p-1 sm:grid-cols-4">
            <Field label="Column">
              <select
                className={cmsInput}
                value={linkColumnId}
                onChange={(e) => setLinkColumnId(e.target.value)}
              >
                {(columnsQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Label">
              <input
                className={cmsInput}
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
              />
            </Field>
            <Field label="URL">
              <input
                className={cmsInput}
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                placeholder="/about"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className={cmsButton}
                disabled={
                  !linkColumnId || !linkLabel.trim() || !linkHref.trim() || addLink.isPending
                }
                onClick={() => addLink.mutate()}
              >
                Add link
              </button>
            </div>
          </div>
        </CmsPanel>
      ) : null}
      {show("columns") || show("links") || show("all") || show("preview") ? (
        <>
          {!columnsQ.data?.length ? (
            <CmsEmptyState
              title="No footer columns"
              description="Seed from the existing footer registry or add columns after migration."
            />
          ) : null}
          {(columnsQ.data ?? []).map((col) => (
            <CmsPanel key={col.id} title={col.title}>
              <ul className="space-y-1 p-2 text-sm">
                {(linksQ.data ?? [])
                  .filter((l) => l.column_id === col.id)
                  .map((l) => (
                    <li key={l.id}>
                      {l.label} <span className="text-muted-foreground">{l.href}</span>
                    </li>
                  ))}
              </ul>
            </CmsPanel>
          ))}
        </>
      ) : null}
      {show("preview") ? (
        <CmsPanel title="Preview note">
          <p className="p-3 text-sm text-muted-foreground">
            Open the public site footer to verify. DB columns take over once seeded; otherwise the
            static registry is used.
          </p>
          <div className="px-3 pb-3">
            <a href="/" className={cmsSecondaryButton} target="_blank" rel="noreferrer">
              Open homepage
            </a>
          </div>
        </CmsPanel>
      ) : null}
    </div>
  );
}

export function SystemHonestDeskPage({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="space-y-4">
      <CmsPageHeader title={title} description={description} />
      <CmsPanel title="Status">
        <ul className="list-disc space-y-2 p-4 pl-8 text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </CmsPanel>
      <CmsEmptyState
        title="No fabricated metrics"
        description="This leaf only shows real configuration status. Connect providers before expecting live data."
      />
    </div>
  );
}

export function SecurityDeskPage() {
  const ipQ = useQuery({ queryKey: ["ip-whitelist"], queryFn: listIpWhitelist });
  const eventsQ = useQuery({ queryKey: ["security-events"], queryFn: listAuditLogs });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Security"
        description="Live data from existing Settings security controls — IP whitelist and audit/security events."
        actions={
          <Link to="/admin/settings" className={cmsSecondaryButton}>
            Open Settings
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="IP rules" value={ipQ.data?.length ?? 0} />
        <MetricCard label="Recent security events" value={eventsQ.data?.length ?? 0} />
      </div>
      <CmsPanel title="IP / Access Rules">
        <ul className="space-y-1 p-3 text-sm">
          {(ipQ.data ?? []).map((row: { id: string; cidr: string; label?: string | null }) => (
            <li key={row.id}>
              <code>{row.cidr}</code> {row.label ? `· ${row.label}` : ""}
            </li>
          ))}
          {!ipQ.data?.length ? (
            <li className="text-muted-foreground">No IP rules configured.</li>
          ) : null}
        </ul>
      </CmsPanel>
      <CmsPanel title="Security Events">
        <ul className="max-h-80 space-y-1 overflow-y-auto p-3 text-sm">
          {(eventsQ.data ?? []).map(
            (row: {
              id: string;
              action?: string;
              summary?: string | null;
              created_at?: string;
            }) => (
              <li key={row.id}>
                <span className="font-medium">{row.summary || row.action}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
                </span>
              </li>
            ),
          )}
          {!eventsQ.data?.length ? (
            <li className="text-muted-foreground">No events loaded.</li>
          ) : null}
        </ul>
      </CmsPanel>
    </div>
  );
}

export function BackupDeskPage({ title = "Backup / DR", note }: { title?: string; note?: string }) {
  const q = useQuery({ queryKey: ["backup-records"], queryFn: listBackupRecords });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={title}
        description="Shows real admin_backup_records only. Never reports fake Backup Successful."
        actions={
          <Link
            to="/admin/settings"
            search={{ section: "security" }}
            className={cmsSecondaryButton}
          >
            Open Settings → Security
          </Link>
        }
      />
      {note ? (
        <CmsPanel title="Leaf status">
          <p className="p-4 text-sm text-muted-foreground">{note}</p>
        </CmsPanel>
      ) : null}
      {!q.data?.length ? (
        <CmsEmptyState
          title="No backup records"
          description="Provider/backups must be configured. Records appear when checkpoints are written to admin_backup_records."
        />
      ) : null}
      <ul className="space-y-2">
        {(q.data ?? []).map(
          (row: {
            id: string;
            label?: string;
            created_at?: string;
            notes?: string | null;
            status?: string;
          }) => (
            <li key={row.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="font-medium">{row.label || "Backup checkpoint"}</div>
              <div className="text-xs text-muted-foreground">
                {row.status ? `${row.status} · ` : ""}
                {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
                {row.notes ? ` · ${row.notes}` : ""}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function QaDeskPage({
  title = "QA / UAT",
  note,
  focus = "all",
}: {
  title?: string;
  note?: string;
  focus?: "all" | "cases" | "bugs" | "signoff";
}) {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["qa-dashboard"], queryFn: getQaDashboard });
  const casesQ = useQuery({ queryKey: ["qa-cases"], queryFn: () => listQaCases() });
  const bugsQ = useQuery({ queryKey: ["qa-bugs"], queryFn: listQaBugs });
  const [caseTitle, setCaseTitle] = useState("");
  const [bugTitle, setBugTitle] = useState("");
  const addCase = useMutation({
    mutationFn: () => upsertQaCase({ title: caseTitle }),
    onSuccess: () => {
      toast.success("Test case saved");
      void qc.invalidateQueries({ queryKey: ["qa-cases"] });
      void qc.invalidateQueries({ queryKey: ["qa-dashboard"] });
      setCaseTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addBug = useMutation({
    mutationFn: () => upsertQaBug({ title: bugTitle }),
    onSuccess: () => {
      toast.success("Bug saved");
      void qc.invalidateQueries({ queryKey: ["qa-bugs"] });
      void qc.invalidateQueries({ queryKey: ["qa-dashboard"] });
      setBugTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const signoff = useMutation({
    mutationFn: () =>
      createQaSignoff(`Release ${new Date().toISOString().slice(0, 10)}`, "Pending UAT", false),
    onSuccess: () => toast.success("Sign-off draft created"),
    onError: (e: Error) => toast.error(e.message),
  });

  const showCases = focus === "all" || focus === "cases";
  const showBugs = focus === "all" || focus === "bugs";
  const showSignoff = focus === "all" || focus === "signoff";

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={title}
        description="Real QA cases and bugs. Empty until qa_* migration is applied."
      />
      {note ? (
        <CmsPanel title="Leaf status">
          <p className="p-4 text-sm text-muted-foreground">{note}</p>
        </CmsPanel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Suites" value={dash.data?.suites ?? 0} />
        <MetricCard label="Cases" value={dash.data?.cases ?? 0} />
        <MetricCard label="Passed" value={dash.data?.passed ?? 0} />
        <MetricCard label="Failed" value={dash.data?.failed ?? 0} />
        <MetricCard label="Open bugs" value={dash.data?.openBugs ?? 0} />
      </div>
      {showCases ? (
        <CmsPanel title="Add test case">
          <div className="flex flex-wrap gap-2 p-1">
            <input
              className={cmsInput}
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              placeholder="Case title"
            />
            <button
              type="button"
              className={cmsButton}
              disabled={!caseTitle.trim() || addCase.isPending}
              onClick={() => addCase.mutate()}
            >
              Add case
            </button>
            {showSignoff ? (
              <button
                type="button"
                className={cmsSecondaryButton}
                onClick={() => signoff.mutate()}
                disabled={signoff.isPending}
              >
                Draft release sign-off
              </button>
            ) : null}
          </div>
        </CmsPanel>
      ) : null}
      {showBugs ? (
        <CmsPanel title="Add bug">
          <div className="flex flex-wrap gap-2 p-1">
            <input
              className={cmsInput}
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
              placeholder="Bug title"
            />
            <button
              type="button"
              className={cmsButton}
              disabled={!bugTitle.trim() || addBug.isPending}
              onClick={() => addBug.mutate()}
            >
              Add bug
            </button>
          </div>
        </CmsPanel>
      ) : null}
      {!showCases && showSignoff ? (
        <CmsPanel title="Release sign-off">
          <div className="p-3">
            <button
              type="button"
              className={cmsSecondaryButton}
              onClick={() => signoff.mutate()}
              disabled={signoff.isPending}
            >
              Draft release sign-off
            </button>
          </div>
        </CmsPanel>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {showCases ? (
          <CmsPanel title="Cases">
            <ul className="space-y-1 p-3 text-sm">
              {(casesQ.data ?? []).map((c: { id: string; title: string; status: string }) => (
                <li key={c.id}>
                  {c.title} <span className="text-muted-foreground">· {c.status}</span>
                </li>
              ))}
              {!casesQ.data?.length ? (
                <li className="text-muted-foreground">No cases yet.</li>
              ) : null}
            </ul>
          </CmsPanel>
        ) : null}
        {showBugs ? (
          <CmsPanel title="Bugs">
            <ul className="space-y-1 p-3 text-sm">
              {(bugsQ.data ?? []).map((b: { id: string; title: string; status: string }) => (
                <li key={b.id}>
                  {b.title} <span className="text-muted-foreground">· {b.status}</span>
                </li>
              ))}
              {!bugsQ.data?.length ? <li className="text-muted-foreground">No bugs yet.</li> : null}
            </ul>
          </CmsPanel>
        ) : null}
      </div>
    </div>
  );
}

export function TaxonomyLocationsPage() {
  const q = useQuery({ queryKey: ["taxonomy-locations"], queryFn: listTaxonomyLocations });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Locations"
        description="Distinct article regions — derived from existing article.region values."
      />
      <DataTable
        columns={[
          { key: "name", header: "Location" },
          { key: "count", header: "Articles" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={2}
            title="No locations yet"
            description="Set region on articles to populate this list."
          />
        ) : null}
        {(q.data ?? []).map((row) => (
          <DataTableRow key={row.name}>
            <DataTableCell className="font-medium">{row.name}</DataTableCell>
            <DataTableCell>{row.articleCount}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}

export function TaxonomyContentTypesPage() {
  const q = useQuery({ queryKey: ["taxonomy-content-types"], queryFn: listTaxonomyContentTypes });
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Content Types"
        description="Live counts by content table — not a separate taxonomy store."
      />
      <DataTable
        columns={[
          { key: "label", header: "Type" },
          { key: "count", header: "Count" },
        ]}
      >
        {(q.data ?? []).map((row) => (
          <DataTableRow key={row.key}>
            <DataTableCell className="font-medium">{row.label}</DataTableCell>
            <DataTableCell>{row.count}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}

export function TaxonomySettingsPage() {
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Taxonomy Settings"
        description="Categories, tags, and topics remain the source of truth. Manage them in their dedicated modules."
      />
      <div className="flex flex-wrap gap-2">
        <Link to="/admin/categories" className={cmsSecondaryButton}>
          Categories
        </Link>
        <Link to="/admin/tags" className={cmsSecondaryButton}>
          Tags
        </Link>
        <Link to="/admin/topics" className={cmsSecondaryButton}>
          Topics
        </Link>
      </div>
      <CmsEmptyState
        title="No parallel taxonomy settings"
        description="Avoid duplicating category/tag configuration. Use the links above."
      />
    </div>
  );
}
