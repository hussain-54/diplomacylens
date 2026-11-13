import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { collectUrlsFromBody } from "@/lib/dam";
import { recordArticleMediaUsages } from "@/lib/media.functions";
import { toAppError } from "@/lib/db-errors";
import {
  hasAnyPermission,
  hasPermission,
  isAppRole,
  type AppRole,
  type Permission,
} from "@/lib/permissions";
import { computeAllArticleScores } from "@/lib/article-scores";

type BadgeType = Database["public"]["Enums"]["badge_type"];
type ArticleStatus = Database["public"]["Enums"]["article_status"];
export type ArticleSeoInput = {
  seo_title?: string | null;
  meta_description?: string | null;
  focus_keyword?: string | null;
  canonical_url?: string | null;
  robots_index: boolean;
  robots_follow: boolean;
  schema_type: "NewsArticle" | "Article" | "Review" | "Report";
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  twitter_card: "summary" | "summary_large_image";
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image_url?: string | null;
  rss_inclusion: boolean;
  hreflang: Record<string, string>;
};

const slugify = (s: string) => {
  const cleaned = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return cleaned || "post-" + Math.random().toString(36).slice(2, 8);
};

const isAlreadySlug = (value: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;

const isSlugConflictError = (message: string | null | undefined) =>
  !!message && /duplicate key value|articles_slug_key|unique constraint/i.test(message);

/**
 * Resolve a unique article slug by suffixing "-2", "-3", … when the base
 * slug is already taken by another article.
 */
const ensureUniqueArticleSlug = async (base: string, excludeId: string | null) => {
  const root = base;
  const { data: rows, error } = await supabase
    .from("articles")
    .select("id,slug")
    .or(`slug.eq.${root},slug.like.${root}-%`)
    .limit(200);
  // If the pre-check fails, fall back to the base slug; the DB unique
  // constraint plus the conflict retry in upsertArticle remain the backstop.
  if (error) return root;
  const taken = new Set((rows ?? []).filter((row) => row.id !== excludeId).map((row) => row.slug));
  if (!taken.has(root)) return root;
  for (let n = 2; n <= 200; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
};

const checkAuth = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
};

const requireNewsroomRole = async () => {
  const user = await checkAuth();
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) throw toAppError(error);
  const roleList = (roles ?? []).map((r) => r.role);
  if (!roleList.length) {
    throw new Error("No newsroom role assigned. Contact a super admin.");
  }
  return { user, roles: roleList };
};

const requirePermission = async (permission: Permission) => {
  const newsroom = await requireNewsroomRole();
  if (!hasPermission(newsroom.roles, permission)) {
    throw new Error(`Forbidden — missing ${permission} permission.`);
  }
  return newsroom;
};

const requireAnyPermission = async (permissions: Permission[]) => {
  const newsroom = await requireNewsroomRole();
  if (!hasAnyPermission(newsroom.roles, permissions)) {
    throw new Error(`Forbidden — missing one of: ${permissions.join(", ")}.`);
  }
  return newsroom;
};

const requireEditorRole = async () => {
  return requirePermission("newsroom:manage");
};

export const getMe = async () => {
  const user = await checkAuth();
  const userId = user.id;
  const [profileRes, rolesRes, accessRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("editor_section_access").select("section_id").eq("profile_id", userId),
  ]);
  if (profileRes.error) throw toAppError(profileRes.error);
  if (rolesRes.error) throw toAppError(rolesRes.error);
  if (accessRes.error) throw toAppError(accessRes.error);
  const roles = (rolesRes.data ?? []).map((r) => r.role);
  const sectionAccess = (accessRes.data ?? []).map((a) => a.section_id);
  return {
    userId,
    profile: profileRes.data,
    roles,
    sectionAccess,
    canPublish:
      roles.some((role) => ["super_admin", "editor_in_chief", "managing_editor"].includes(role)) ||
      (hasPermission(roles, "articles:publish") && sectionAccess.length > 0),
  };
};

export const listAdminArticles = async () => {
  await requirePermission("articles:view");
  const enrich = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((row) => {
      const tagRows =
        (row.article_tags as Array<{
          tag_id?: string;
          tags?:
            | { id: string; name?: string; slug?: string }
            | { id: string; name?: string; slug?: string }[]
            | null;
        }> | null) ?? [];
      const tags = tagRows
        .map((entry) => {
          const tag = Array.isArray(entry.tags) ? entry.tags[0] : entry.tags;
          if (!tag?.id) return null;
          return { id: tag.id, name: tag.name ?? "Tag", slug: tag.slug ?? tag.id };
        })
        .filter((tag): tag is { id: string; name: string; slug: string } => Boolean(tag));
      const { article_tags: _tags, ...rest } = row as T & { article_tags?: unknown };
      return {
        ...rest,
        language: (row.language as string | undefined) ?? "en",
        schema_type: (row.schema_type as string | undefined) ?? "NewsArticle",
        seo_title: (row.seo_title as string | null | undefined) ?? null,
        meta_description: (row.meta_description as string | null | undefined) ?? null,
        focus_keyword: (row.focus_keyword as string | null | undefined) ?? null,
        robots_index: (row.robots_index as boolean | undefined) ?? true,
        is_featured: Boolean(row.is_featured),
        google_news: Boolean(row.google_news),
        google_discover: Boolean(row.google_discover),
        hero_image_url: (row.hero_image_url as string | null | undefined) ?? null,
        deck: (row.deck as string | null | undefined) ?? null,
        tag_ids: tags.map((tag) => tag.id),
        tags,
      };
    });

  const selectFull =
    "id,slug,title,deck,body,status,badge_type,hero_image_url,published_at,scheduled_at,updated_at,created_at,section_id,author_id,region,is_featured,google_news,google_discover,language,schema_type,seo_title,meta_description,focus_keyword,robots_index,seo_score,content_score,eeat_score,priority,deleted_at,delete_reason,archive_reason, article_tags(tag_id, tags(id,name,slug)), sections(name,slug), author:profiles!articles_author_id_fkey(id,name)";
  let query = supabase
    .from("articles")
    .select(selectFull)
    .order("updated_at", { ascending: false })
    .limit(200);

  // Soft-deleted excluded unless caller needs trash (use listTrashedArticles)
  query = query.is("deleted_at", null);

  const { data, error } = await query;

  if (!error) {
    return enrich(data ?? []).map((row) => {
      const scores = computeAllArticleScores({
        title: row.title as string,
        slug: row.slug as string,
        deck: row.deck as string | null,
        body: row.body as string | null,
        seo_title: row.seo_title as string | null,
        meta_description: row.meta_description as string | null,
        focus_keyword: row.focus_keyword as string | null,
        hero_image_url: row.hero_image_url as string | null,
        author_id: row.author_id as string | null,
        schema_type: row.schema_type as string | null,
        robots_index: row.robots_index as boolean,
        google_news: row.google_news as boolean,
      });
      return {
        ...row,
        seo_score: (row.seo_score as number) || scores.seo_score,
        content_score: (row.content_score as number) || scores.content_score,
        eeat_score: (row.eeat_score as number) || scores.eeat_score,
        word_count: scores.word_count,
        reading_minutes: scores.reading_minutes,
      };
    });
  }

  if (
    !/language|schema_type|seo_title|article_tags|is_featured|google_news|google_discover|hero_image_url|deck|seo_score|content_score|eeat_score|deleted_at|priority|schema cache|PGRST/i.test(
      error.message,
    )
  ) {
    throw toAppError(error);
  }

  const legacy = await supabase
    .from("articles")
    .select(
      "id,slug,title,status,badge_type,published_at,scheduled_at,updated_at,created_at,section_id,author_id,region, sections(name,slug), author:profiles!articles_author_id_fkey(id,name)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (legacy.error) throw toAppError(legacy.error);
  return enrich(
    (legacy.data ?? []).map((row) => ({
      ...row,
      is_featured: false,
      google_news: false,
      google_discover: false,
      language: "en",
      schema_type: "NewsArticle",
      region: row.region ?? null,
      seo_title: null,
      meta_description: null,
      focus_keyword: null,
      robots_index: true,
      hero_image_url: null,
      deck: null,
      body: null,
      article_tags: [],
      seo_score: 0,
      content_score: 0,
      eeat_score: 0,
      priority: "medium",
    })),
  ).map((row) => {
    const scores = computeAllArticleScores({
      title: row.title as string,
      slug: row.slug as string,
      deck: row.deck as string | null,
      body: row.body as string | null,
    });
    return {
      ...row,
      word_count: scores.word_count,
      reading_minutes: scores.reading_minutes,
      seo_score: scores.seo_score,
      content_score: scores.content_score,
      eeat_score: scores.eeat_score,
    };
  });
};

export const listTrashedArticles = async () => {
  await requirePermission("articles:delete");
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id,slug,title,status,hero_image_url,deleted_at,delete_reason,deleted_by,updated_at,section_id,author_id, sections(name,slug), author:profiles!articles_author_id_fkey(id,name), deleter:profiles!articles_deleted_by_fkey(id,name)",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(200);
  if (error) {
    if (/deleted_at|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

/** Lifetime view totals keyed by article id (Phase 5 filters) */
export const getArticleViewTotals = async () => {
  await requirePermission("articles:view");
  const { data, error } = await supabase.from("article_daily_metrics").select("article_id,views");
  if (error) {
    if (/article_daily_metrics|schema cache|PGRST/i.test(error.message))
      return {} as Record<string, number>;
    throw toAppError(error);
  }
  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.article_id] = (totals[row.article_id] ?? 0) + (row.views ?? 0);
  }
  return totals;
};

/** Comment counts keyed by article id (Phase 6 table) */
export const getArticleCommentCounts = async () => {
  await requirePermission("articles:view");
  const { data, error } = await supabase.from("comments").select("article_id");
  if (error) {
    if (/comments|schema cache|PGRST/i.test(error.message)) return {} as Record<string, number>;
    throw toAppError(error);
  }
  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.article_id] = (totals[row.article_id] ?? 0) + 1;
  }
  return totals;
};

/** CSV import → draft articles (Phase 6). Columns: title, slug, deck, section */
export const importArticlesCsv = async ({
  data,
}: {
  data: {
    rows: Array<{
      title: string;
      slug?: string;
      deck?: string;
      section?: string;
    }>;
  };
}) => {
  await requirePermission("articles:create");
  const rows = data.rows.filter((row) => row.title?.trim()).slice(0, 50);
  if (!rows.length) throw new Error("No importable rows found. Include a title column.");

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("id,name,slug");
  if (sectionsError) throw toAppError(sectionsError);

  const findSection = (value?: string) => {
    if (!value?.trim()) return sections?.[0]?.id ?? null;
    const needle = value.trim().toLowerCase();
    return (
      sections?.find(
        (section) => section.slug.toLowerCase() === needle || section.name.toLowerCase() === needle,
      )?.id ?? null
    );
  };

  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const section_id = findSection(row.section);
    if (!section_id) {
      errors.push(`Skipped “${row.title}”: no matching category.`);
      continue;
    }
    try {
      await upsertArticle({
        data: {
          title: row.title.trim(),
          slug: row.slug?.trim() || undefined,
          deck: row.deck?.trim() || undefined,
          section_id,
          status: "draft",
        },
      });
      created += 1;
    } catch (error) {
      errors.push(`“${row.title}”: ${error instanceof Error ? error.message : "failed to import"}`);
    }
  }

  return { created, errors };
};

export type ArticlesLibraryTab =
  | "all"
  | "published"
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "archived"
  | "trash"
  | "breaking"
  | "featured"
  | "google_news"
  | "discover";

/** Exact tab counts for All Articles library (Phase 4) */
export const getArticlesLibraryCounts = async () => {
  await requirePermission("articles:view");

  const countActive = async (column: string, value: string | boolean) => {
    let query = supabase.from("articles").select("id", { count: "exact", head: true });
    query = query.eq(column, value).is("deleted_at", null);
    const { count, error } = await query;
    if (error) {
      // Fallback without deleted_at filter if column missing
      if (/deleted_at|schema cache|PGRST/i.test(error.message)) {
        const retry = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq(column, value);
        if (retry.error) throw retry.error;
        return retry.count ?? 0;
      }
      throw error;
    }
    return count ?? 0;
  };

  try {
    const [
      all,
      published,
      draft,
      review,
      approved,
      scheduled,
      archived,
      trash,
      breaking,
      featured,
      googleNews,
      discover,
    ] = await Promise.all([
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .then((r) => {
          if (r.error && /deleted_at/i.test(r.error.message)) {
            return supabase
              .from("articles")
              .select("id", { count: "exact", head: true })
              .then((x) => {
                if (x.error) throw x.error;
                return x.count ?? 0;
              });
          }
          if (r.error) throw r.error;
          return r.count ?? 0;
        }),
      countActive("status", "published"),
      countActive("status", "draft"),
      countActive("status", "review"),
      countActive("status", "approved"),
      countActive("status", "scheduled"),
      countActive("status", "archived"),
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null)
        .then((r) => {
          if (r.error && /deleted_at/i.test(r.error.message)) return 0;
          if (r.error) throw r.error;
          return r.count ?? 0;
        }),
      countActive("badge_type", "breaking"),
      countActive("is_featured", true),
      countActive("google_news", true),
      countActive("google_discover", true),
    ]);

    return {
      all,
      published,
      draft,
      review,
      approved,
      scheduled,
      archived,
      trash,
      breaking,
      featured,
      google_news: googleNews,
      discover,
    } satisfies Record<ArticlesLibraryTab, number>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !/is_featured|google_news|google_discover|approved|deleted_at|schema cache|PGRST/i.test(
        message,
      )
    ) {
      throw toAppError(error);
    }

    const countEq = async (column: string, value: string | boolean) => {
      const { count, error: err } = await supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq(column, value);
      if (err) throw err;
      return count ?? 0;
    };

    const [all, published, draft, review, scheduled, archived, breaking] = await Promise.all([
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .then((r) => {
          if (r.error) throw toAppError(r.error);
          return r.count ?? 0;
        }),
      countEq("status", "published"),
      countEq("status", "draft"),
      countEq("status", "review"),
      countEq("status", "scheduled"),
      countEq("status", "archived"),
      countEq("badge_type", "breaking"),
    ]);

    return {
      all,
      published,
      draft,
      review,
      approved: 0,
      scheduled,
      archived,
      trash: 0,
      breaking,
      featured: 0,
      google_news: 0,
      discover: 0,
    } satisfies Record<ArticlesLibraryTab, number>;
  }
};

export const listDashboardArticles = async () => {
  await requirePermission("dashboard:view");
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id,slug,title,status,badge_type,published_at,scheduled_at,updated_at,section_id,author_id,seo_title,meta_description,focus_keyword,robots_index,canonical_url, sections(name,slug), author:profiles!articles_author_id_fkey(name)",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    // Fallback when SEO columns are not yet migrated.
    if (
      /seo_title|meta_description|focus_keyword|robots_index|canonical_url|schema cache|PGRST/i.test(
        error.message,
      )
    ) {
      const legacy = await supabase
        .from("articles")
        .select(
          "id,slug,title,status,badge_type,published_at,scheduled_at,updated_at,section_id,author_id, sections(name,slug), author:profiles!articles_author_id_fkey(name)",
        )
        .order("updated_at", { ascending: false })
        .limit(100);
      if (legacy.error) throw toAppError(legacy.error);
      return (legacy.data ?? []).map((row) => ({
        ...row,
        seo_title: null,
        meta_description: null,
        focus_keyword: null,
        robots_index: true,
        canonical_url: null,
      }));
    }
    throw toAppError(error);
  }
  return data ?? [];
};

export const getDashboardSettingsSnapshot = async () => {
  await requirePermission("dashboard:view");
  const { data, error } = await supabase
    .from("newsroom_settings")
    .select("publication_name,integrations,seo_defaults,notification_prefs,comments_enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    if (/integrations|seo_defaults|notification_prefs|schema cache|PGRST/i.test(error.message)) {
      const legacy = await supabase
        .from("newsroom_settings")
        .select("publication_name,comments_enabled")
        .eq("id", true)
        .maybeSingle();
      if (legacy.error) throw toAppError(legacy.error);
      return {
        publication_name: legacy.data?.publication_name ?? "Diplomacy Lens",
        comments_enabled: legacy.data?.comments_enabled ?? true,
        integrations: {},
        seo_defaults: {},
        notification_prefs: {},
      };
    }
    throw toAppError(error);
  }
  return data;
};

export const getDashboardMetrics = async () => {
  await requirePermission("dashboard:view");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const monthAgo = new Date();
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 29);
  const monthDate = monthAgo.toISOString().slice(0, 10);

  const [
    totalRes,
    publishedTotalRes,
    publishedTodayRes,
    reviewRes,
    draftRes,
    scheduledRes,
    archivedRes,
    commentsPendingRes,
    commentsFlaggedRes,
    authorsRes,
    monthlyViewsRes,
  ] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", startOfToday.toISOString()),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "review"),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled"),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "archived"),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "flagged"),
    supabase
      .from("articles")
      .select("author_id")
      .not("author_id", "is", null)
      .neq("status", "archived")
      .limit(2000),
    supabase.from("article_daily_metrics").select("views").gte("metric_date", monthDate),
  ]);

  for (const result of [
    totalRes,
    publishedTotalRes,
    publishedTodayRes,
    reviewRes,
    draftRes,
    scheduledRes,
    archivedRes,
  ]) {
    if (result.error) throw toAppError(result.error);
  }

  const activeAuthors = new Set(
    (authorsRes.error ? [] : (authorsRes.data ?? [])).map((row) => row.author_id).filter(Boolean),
  ).size;

  const monthlyViews = monthlyViewsRes.error
    ? 0
    : (monthlyViewsRes.data ?? []).reduce((sum, row) => sum + (row.views ?? 0), 0);

  return {
    totalArticles: totalRes.count ?? 0,
    publishedTotal: publishedTotalRes.count ?? 0,
    publishedToday: publishedTodayRes.count ?? 0,
    pendingReview: reviewRes.count ?? 0,
    drafts: draftRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
    archived: archivedRes.count ?? 0,
    activeAuthors,
    monthlyViews,
    pendingComments: commentsPendingRes.error ? 0 : (commentsPendingRes.count ?? 0),
    flaggedComments: commentsFlaggedRes.error ? 0 : (commentsFlaggedRes.count ?? 0),
  };
};

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** Articles module dashboard snapshot (Phase 3) — uses articles:view */
export const getArticlesDashboardSnapshot = async () => {
  await requirePermission("articles:view");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(startOfToday);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const todayKey = startOfToday.toISOString().slice(0, 10);
  const yesterdayKey = startOfYesterday.toISOString().slice(0, 10);

  const [
    publishedTotalRes,
    publishedTodayRes,
    publishedYesterdayRes,
    publishedWeekRes,
    publishedPrevWeekRes,
    draftRes,
    reviewRes,
    approvedRes,
    scheduledRes,
    articlesRes,
    viewsTodayRes,
    viewsYesterdayRes,
    metricsWeekRes,
    publishWindowRes,
  ] = await Promise.all([
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("published_at", startOfToday.toISOString()),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("published_at", startOfYesterday.toISOString())
      .lt("published_at", startOfToday.toISOString()),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("published_at", weekAgo.toISOString()),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("published_at", twoWeeksAgo.toISOString())
      .lt("published_at", weekAgo.toISOString()),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "review")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select(
        "id,slug,title,status,badge_type,published_at,updated_at,scheduled_at,seo_title,meta_description,focus_keyword,robots_index,author:profiles!articles_author_id_fkey(name),sections(name),article_tags(tags(name))",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("article_daily_metrics").select("views").eq("metric_date", todayKey),
    supabase.from("article_daily_metrics").select("views").eq("metric_date", yesterdayKey),
    supabase
      .from("article_daily_metrics")
      .select("article_id,views,metric_date,articles(id,title,slug)")
      .gte("metric_date", weekAgo.toISOString().slice(0, 10)),
    supabase
      .from("articles")
      .select("published_at")
      .not("published_at", "is", null)
      .is("deleted_at", null)
      .gte("published_at", twoWeeksAgo.toISOString()),
  ]);

  for (const result of [
    publishedTotalRes,
    publishedTodayRes,
    draftRes,
    reviewRes,
    approvedRes,
    scheduledRes,
  ]) {
    if (result.error) throw toAppError(result.error);
  }
  if (articlesRes.error) throw toAppError(articlesRes.error);

  const articles = articlesRes.data ?? [];
  const viewsToday = viewsTodayRes.error
    ? 0
    : (viewsTodayRes.data ?? []).reduce((sum, row) => sum + (row.views ?? 0), 0);
  const viewsYesterday = viewsYesterdayRes.error
    ? 0
    : (viewsYesterdayRes.data ?? []).reduce((sum, row) => sum + (row.views ?? 0), 0);

  const seoScores = articles.map((article) => {
    let score = 0;
    if (article.seo_title?.trim()) score += 25;
    if (article.meta_description?.trim()) score += 25;
    if (article.focus_keyword?.trim()) score += 25;
    if (article.robots_index !== false) score += 25;
    return score;
  });
  const seoHealth = seoScores.length
    ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length)
    : 0;
  const seoStrong = seoScores.filter((s) => s >= 75).length;
  const seoWeak = seoScores.filter((s) => s < 50).length;
  const missingMeta = articles.filter(
    (a) => !a.seo_title?.trim() || !a.meta_description?.trim(),
  ).length;

  const storyViews = new Map<string, { title: string; slug: string; views: number }>();
  const tagUsage = new Map<string, number>();
  for (const article of articles) {
    const tags = (article.article_tags ?? []) as Array<{
      tags?: { name?: string | null } | { name?: string | null }[] | null;
    }>;
    for (const entry of tags) {
      const tag = Array.isArray(entry.tags) ? entry.tags[0] : entry.tags;
      const name = tag?.name?.trim();
      if (!name) continue;
      tagUsage.set(name, (tagUsage.get(name) ?? 0) + 1);
    }
  }
  for (const row of metricsWeekRes.error ? [] : (metricsWeekRes.data ?? [])) {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles;
    const current = storyViews.get(row.article_id) ?? {
      title: article?.title ?? "Unknown",
      slug: article?.slug ?? "",
      views: 0,
    };
    current.views += row.views ?? 0;
    storyViews.set(row.article_id, current);
  }
  const topPerforming = [...storyViews.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  const publishActivity = new Map<string, number>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() - offset);
    publishActivity.set(date.toISOString().slice(0, 10), 0);
  }
  for (const row of publishWindowRes.error ? [] : (publishWindowRes.data ?? [])) {
    if (!row.published_at) continue;
    const key = row.published_at.slice(0, 10);
    if (publishActivity.has(key)) {
      publishActivity.set(key, (publishActivity.get(key) ?? 0) + 1);
    }
  }

  const publishedToday = publishedTodayRes.count ?? 0;
  const publishedYesterday = publishedYesterdayRes.error ? 0 : (publishedYesterdayRes.count ?? 0);
  const drafts = draftRes.count ?? 0;
  const pendingReview = reviewRes.count ?? 0;
  const approved = approvedRes.count ?? 0;
  const scheduled = scheduledRes.count ?? 0;
  const publishedWeek = publishedWeekRes.error ? 0 : (publishedWeekRes.count ?? 0);
  const publishedPrevWeek = publishedPrevWeekRes.error ? 0 : (publishedPrevWeekRes.count ?? 0);

  return {
    kpis: {
      published: publishedTotalRes.count ?? 0,
      publishedChange: pctChange(publishedWeek, publishedPrevWeek),
      drafts,
      draftsChange: null as number | null,
      pendingReview,
      pendingReviewChange: null as number | null,
      approved,
      scheduled,
      scheduledChange: null as number | null,
      viewsToday,
      viewsTodayChange: pctChange(viewsToday, viewsYesterday),
      seoHealth,
      seoHealthChange: null as number | null,
      publishedToday,
      publishedYesterday,
    },
    contentHealth: {
      seoHealth,
      seoStrong,
      seoWeak,
      missingMeta,
      totalSampled: articles.length,
      backlog: drafts + pendingReview + approved + scheduled,
    },
    topPerforming,
    recentlyUpdated: articles.slice(0, 8).map((article) => ({
      id: article.id,
      title: article.title,
      status: article.status,
      updated_at: article.updated_at,
      author: Array.isArray(article.author) ? article.author[0]?.name : article.author?.name,
      section: Array.isArray(article.sections) ? article.sections[0]?.name : article.sections?.name,
    })),
    editorialQueue: articles
      .filter((a) => a.status === "review")
      .slice(0, 8)
      .map((article) => ({
        id: article.id,
        title: article.title,
        updated_at: article.updated_at,
        author: Array.isArray(article.author) ? article.author[0]?.name : article.author?.name,
        badge_type: article.badge_type,
      })),
    latestDrafts: articles
      .filter((a) => a.status === "draft")
      .slice(0, 6)
      .map((article) => ({
        id: article.id,
        title: article.title,
        updated_at: article.updated_at,
        section: Array.isArray(article.sections)
          ? article.sections[0]?.name
          : article.sections?.name,
      })),
    approvedQueue: articles
      .filter((a) => a.status === "approved")
      .slice(0, 6)
      .map((article) => ({
        id: article.id,
        title: article.title,
        updated_at: article.updated_at,
        scheduled_at: article.scheduled_at,
      })),
    trendingTags: [...tagUsage.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    publishingActivity: [...publishActivity.entries()].map(([date, count]) => ({
      date,
      count,
    })),
  };
};

export const getDashboardPerformance = async () => {
  await requirePermission("dashboard:view");
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  const date = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("article_daily_metrics")
    .select("article_id,metric_date,views,articles(id,title)")
    .gte("metric_date", date)
    .order("metric_date");

  if (error) {
    if (/article_daily_metrics|schema cache|PGRST/i.test(error.message)) {
      return {
        dailyRows: emptyDailyRows(),
        topStories: [] as Array<{ title: string; views: number }>,
      };
    }
    throw toAppError(error);
  }

  const daily = new Map<string, number>();
  for (const [key] of emptyDailyRows()) daily.set(key, 0);
  const storyTotals = new Map<string, { title: string; views: number }>();

  for (const metric of data ?? []) {
    daily.set(metric.metric_date, (daily.get(metric.metric_date) ?? 0) + metric.views);
    const article = Array.isArray(metric.articles) ? metric.articles[0] : metric.articles;
    const current = storyTotals.get(metric.article_id) ?? {
      title: article?.title ?? "Unknown article",
      views: 0,
    };
    current.views += metric.views;
    storyTotals.set(metric.article_id, current);
  }

  return {
    dailyRows: [...daily.entries()] as Array<[string, number]>,
    topStories: [...storyTotals.values()].sort((a, b) => b.views - a.views).slice(0, 8),
  };
};

function emptyDailyRows(): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    rows.push([date.toISOString().slice(0, 10), 0]);
  }
  return rows;
}

export const getAdminArticle = async ({ data }: { data: { id: string } }) => {
  await requirePermission("articles:view");
  const { data: a, error } = await supabase
    .from("articles")
    .select("*, author:profiles!articles_author_id_fkey(id,name,avatar_url), sections(name,slug)")
    .eq("id", data.id)
    .maybeSingle();
  if (error) throw toAppError(error);
  return a;
};

export const updateArticleSeo = async ({
  data,
}: {
  data: ArticleSeoInput & { article_id: string; hero_image_url?: string | null };
}) => {
  const { article_id, hero_image_url, ...seo } = data;
  // Social scrapers need an absolute image. If the editor left OG/Twitter
  // image blank, fall back to the featured hero so share cards never go blank.
  const hero =
    (hero_image_url || "").trim() ||
    (await (async () => {
      const { data: row } = await supabase
        .from("articles")
        .select("hero_image_url")
        .eq("id", article_id)
        .maybeSingle();
      return row?.hero_image_url ?? "";
    })());
  const ogImage = (seo.og_image_url || "").trim() || hero || null;
  const twitterImage = (seo.twitter_image_url || "").trim() || ogImage;

  const { data: article, error } = await supabase.rpc("admin_update_article_seo", {
    p_article_id: article_id,
    p_seo_title: seo.seo_title || null,
    p_meta_description: seo.meta_description || null,
    p_focus_keyword: seo.focus_keyword || null,
    p_canonical_url: seo.canonical_url || null,
    p_robots_index: seo.robots_index,
    p_robots_follow: seo.robots_follow,
    p_schema_type: seo.schema_type,
    p_og_title: seo.og_title || null,
    p_og_description: seo.og_description || null,
    p_og_image_url: ogImage,
    p_twitter_card: seo.twitter_card,
    p_twitter_title: seo.twitter_title || null,
    p_twitter_description: seo.twitter_description || null,
    p_twitter_image_url: twitterImage,
    p_rss_inclusion: seo.rss_inclusion,
    p_hreflang: seo.hreflang,
  });
  if (error) {
    if (/admin_update_article_seo|schema cache|PGRST202/i.test(error.message)) {
      throw new Error(
        "SEO database module is not installed. Apply supabase/migrations/20260718060000_complete_seo_module.sql, then reload.",
      );
    }
    throw toAppError(error);
  }
  return article;
};

// TAGS
export const listTags = async () => {
  await requirePermission("articles:view");
  const { data, error } = await supabase.from("tags").select("*").order("name");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const getArticleTags = async ({ data }: { data: { article_id: string } }) => {
  await requirePermission("articles:view");
  const { data: rows, error } = await supabase
    .from("article_tags")
    .select("tag_id, tags(id,name,slug)")
    .eq("article_id", data.article_id);
  if (error) throw toAppError(error);
  return (rows ?? [])
    .map((row) => (Array.isArray(row.tags) ? row.tags[0] : row.tags))
    .filter((t): t is { id: string; name: string; slug: string } => !!t);
};

export const setArticleTags = async ({
  data,
}: {
  data: { article_id: string; tag_names: string[] };
}) => {
  await requirePermission("articles:create");
  const names = [...new Set(data.tag_names.map((n) => n.trim()).filter(Boolean))].slice(0, 20);

  const tagIds: string[] = [];
  for (const name of names) {
    const slug = slugify(name);
    const { data: existing, error: findError } = await supabase
      .from("tags")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (findError) throw toAppError(findError);
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const { data: created, error: createError } = await supabase
        .from("tags")
        .insert({ name, slug })
        .select("id")
        .single();
      if (createError) throw toAppError(createError);
      tagIds.push(created.id);
    }
  }

  const { error: clearError } = await supabase
    .from("article_tags")
    .delete()
    .eq("article_id", data.article_id);
  if (clearError) throw toAppError(clearError);

  if (tagIds.length) {
    const { error: insertError } = await supabase
      .from("article_tags")
      .insert(tagIds.map((tag_id) => ({ article_id: data.article_id, tag_id })));
    if (insertError) throw toAppError(insertError);
  }
  return { ok: true };
};

/** Replace article_images rows from cms_extras.media.gallery (+ featured hero). */
async function syncArticleImagesFromExtras({
  articleId,
  heroUrl,
  cmsExtras,
}: {
  articleId: string;
  heroUrl: string | null;
  cmsExtras: Record<string, unknown> | null;
}) {
  const media =
    cmsExtras &&
    typeof cmsExtras === "object" &&
    cmsExtras.media &&
    typeof cmsExtras.media === "object"
      ? (cmsExtras.media as {
          gallery?: Array<{
            url?: string;
            alt?: string;
            caption?: string;
            display_order?: number;
            is_featured?: boolean;
          }>;
          alt_text?: string;
          caption?: string;
        })
      : null;

  const gallery = [...(media?.gallery ?? [])].filter((item) => item.url?.trim());
  if (heroUrl?.trim() && !gallery.some((item) => item.url === heroUrl)) {
    gallery.unshift({
      url: heroUrl,
      alt: media?.alt_text ?? "",
      caption: media?.caption ?? "",
      is_featured: true,
      display_order: 0,
    });
  }

  const rows = gallery.map((item, index) => ({
    article_id: articleId,
    image_url: item.url!.trim(),
    alt_text: item.alt?.trim() || media?.alt_text?.trim() || null,
    caption: item.caption?.trim() || null,
    display_order: item.display_order ?? index,
    is_featured: Boolean(item.is_featured) || item.url === heroUrl,
    updated_at: new Date().toISOString(),
  }));

  // Ensure exactly one featured when hero is set.
  if (heroUrl && rows.length && !rows.some((r) => r.is_featured)) {
    const idx = rows.findIndex((r) => r.image_url === heroUrl);
    if (idx >= 0) rows[idx].is_featured = true;
    else rows[0].is_featured = true;
  }

  const { error: delError } = await supabase
    .from("article_images")
    .delete()
    .eq("article_id", articleId);
  if (delError && /article_images|schema cache|PGRST|relation/i.test(delError.message)) {
    return; // Table not migrated yet — cms_extras.gallery remains the source of truth.
  }
  if (delError) {
    console.warn("article_images clear failed", delError);
    return;
  }
  if (!rows.length) return;
  const { error: insError } = await supabase.from("article_images").insert(rows);
  if (insError && !/article_images|schema cache|PGRST|relation/i.test(insError.message)) {
    console.warn("article_images sync failed", insError);
  }
}

export const upsertArticle = async ({
  data,
}: {
  data: {
    id?: string;
    title: string;
    deck?: string;
    body?: string;
    section_id: string;
    region?: string;
    badge_type?: string;
    hero_image_url?: string;
    status: ArticleStatus;
    slug?: string;
    scheduled_at?: string | null;
    google_news?: boolean;
    google_discover?: boolean;
    is_featured?: boolean;
    language?: string;
    cms_extras?: Record<string, unknown>;
    expiry_at?: string | null;
    story_id?: string | null;
  };
}) => {
  const { user, roles } = await requireNewsroomRole();
  const required = data.id
    ? (["articles:edit_own", "articles:edit_all", "articles:review"] as const)
    : (["articles:create"] as const);
  if (!hasAnyPermission(roles, required)) {
    throw new Error("You do not have permission to save articles.");
  }
  if (!data.title?.trim()) throw new Error("Title is required.");
  if (!data.section_id) throw new Error("Select a section.");

  const { data: accessRows, error: accessError } = await supabase
    .from("editor_section_access")
    .select("section_id")
    .eq("profile_id", user.id)
    .eq("section_id", data.section_id)
    .maybeSingle();
  if (accessError) throw toAppError(accessError);

  const wantsPublish = data.status === "published";
  const wantsRestrictedStatus = ["scheduled", "published", "archived"].includes(data.status);
  const isEditorialLeader = roles.some((role) =>
    ["super_admin", "editor_in_chief", "managing_editor"].includes(role),
  );
  const mayPublish =
    isEditorialLeader || (hasPermission(roles, "articles:publish") && !!accessRows);
  if (wantsRestrictedStatus && !mayPublish) {
    throw new Error(
      "Publishing, scheduling, or archiving requires publishing permission for this category.",
    );
  }
  if (
    data.status === "scheduled" &&
    (!data.scheduled_at || new Date(data.scheduled_at).getTime() <= Date.now())
  ) {
    throw new Error("Choose a future publication date and time.");
  }

  const requestedSlug = (() => {
    const raw = data.slug?.trim() || "";
    if (raw && isAlreadySlug(raw.toLowerCase())) return raw.toLowerCase();
    return slugify(raw || data.title);
  })();
  let slug = await ensureUniqueArticleSlug(requestedSlug, data.id ?? null);
  const badge = (data.badge_type ?? "none") as BadgeType;

  // Prefer SECURITY DEFINER RPC so table GRANT quirks cannot block editors.
  const callUpsertRpc = (slugValue: string) =>
    supabase.rpc("admin_upsert_article", {
      p_id: data.id ?? null,
      p_title: data.title.trim(),
      p_deck: data.deck || null,
      p_body: data.body || null,
      p_section_id: data.section_id,
      p_region: data.region || null,
      p_badge_type: badge,
      p_hero_image_url: data.hero_image_url || null,
      p_status: data.status,
      p_slug: slugValue,
      p_scheduled_at: data.scheduled_at ?? null,
    });

  let { data: viaRpc, error: rpcError } = await callUpsertRpc(slug);
  if (rpcError && isSlugConflictError(rpcError.message)) {
    // Rare race: another article grabbed the slug between check and write.
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    ({ data: viaRpc, error: rpcError } = await callUpsertRpc(slug));
  }

  const trackUsage = (article: {
    id: string;
    title: string;
    slug?: string | null;
    hero_image_url?: string | null;
    body?: string | null;
  }) => {
    void recordArticleMediaUsages({
      data: {
        article_id: article.id,
        title: article.title,
        slug: article.slug,
        urls: [
          { field: "hero_image_url", url: article.hero_image_url },
          ...collectUrlsFromBody(article.body).map((url) => ({ field: "body", url })),
        ],
      },
    });
  };

  // Persist scores + placement fields the RPC signature does not accept.
  // Tolerates older databases that miss some of these columns.
  const applyPlacementExtras = async (articleId: string, existingAuthorId?: string | null) => {
    const authorId = existingAuthorId || user.id;
    const { data: publisherProfile } = await supabase
      .from("profiles")
      .select("name, byline_name")
      .eq("id", authorId)
      .maybeSingle();
    const publisherName =
      publisherProfile?.byline_name?.trim() || publisherProfile?.name?.trim() || "Admin";

    const scores = computeAllArticleScores({
      title: data.title,
      slug,
      deck: data.deck,
      body: data.body,
      hero_image_url: data.hero_image_url,
      author_id: authorId,
      google_news: data.google_news,
    });
    const placement: Record<string, unknown> = {
      seo_score: scores.seo_score,
      content_score: scores.content_score,
      eeat_score: scores.eeat_score,
      publisher_name: publisherName,
      updated_by: user.id,
    };
    if (!data.id) {
      placement.created_by = user.id;
      placement.author_id = user.id;
    } else if (!existingAuthorId) {
      // Older articles with no publisher — assign the editor saving now.
      placement.author_id = user.id;
    }
    if (typeof data.google_news === "boolean") placement.google_news = data.google_news;
    if (typeof data.google_discover === "boolean") placement.google_discover = data.google_discover;
    if (typeof data.is_featured === "boolean") placement.is_featured = data.is_featured;
    if (data.language) placement.language = data.language;
    if (data.cms_extras) placement.cms_extras = data.cms_extras;
    if (data.expiry_at !== undefined) placement.expiry_at = data.expiry_at;
    if (data.story_id !== undefined) placement.story_id = data.story_id;
    const { error: placementError } = await supabase
      .from("articles")
      .update(placement as Database["public"]["Tables"]["articles"]["Update"])
      .eq("id", articleId);
    if (
      placementError &&
      !/schema cache|PGRST|column|publisher_name|created_by|updated_by|story_id/i.test(
        placementError.message,
      )
    ) {
      throw toAppError(placementError);
    }

    await syncArticleImagesFromExtras({
      articleId,
      heroUrl: data.hero_image_url || null,
      cmsExtras: data.cms_extras ?? null,
    });
  };

  if (!rpcError && viaRpc) {
    trackUsage(viaRpc);
    await applyPlacementExtras(viaRpc.id, viaRpc.author_id ?? null);
    return viaRpc;
  }

  // Fallback direct write if RPC not deployed yet
  if (rpcError && !/could not find the function|schema cache|PGRST202/i.test(rpcError.message)) {
    throw toAppError(rpcError);
  }

  if (data.id) {
    const { data: existing, error: existingError } = await supabase
      .from("articles")
      .select("id, published_at, status, author_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw toAppError(existingError);
    if (!existing) throw new Error("Article not found or you cannot edit it.");

    const published_at =
      wantsPublish || data.status === "archived"
        ? (existing.published_at ?? (wantsPublish ? new Date().toISOString() : null))
        : null;

    const payload = {
      title: data.title.trim(),
      deck: data.deck || null,
      body: data.body || null,
      section_id: data.section_id,
      region: data.region || null,
      badge_type: badge,
      hero_image_url: data.hero_image_url || null,
      status: data.status,
      slug,
      scheduled_at: data.status === "scheduled" ? (data.scheduled_at ?? null) : null,
      published_at,
    };

    const { data: r, error } = await supabase
      .from("articles")
      .update(payload)
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw toAppError(error);
    if (!r) {
      throw new Error("The article could not be updated with your current permissions.");
    }
    trackUsage(r);
    await applyPlacementExtras(r.id, existing.author_id);
    return r;
  }

  const payload = {
    title: data.title.trim(),
    deck: data.deck || null,
    body: data.body || null,
    section_id: data.section_id,
    region: data.region || null,
    badge_type: badge,
    hero_image_url: data.hero_image_url || null,
    status: data.status,
    slug,
    scheduled_at: data.status === "scheduled" ? (data.scheduled_at ?? null) : null,
    author_id: user.id,
    published_at: wantsPublish ? new Date().toISOString() : null,
  };

  const { data: r, error } = await supabase.from("articles").insert(payload).select().maybeSingle();
  if (error) throw toAppError(error);
  if (!r) {
    throw new Error("The article could not be created with your current permissions.");
  }
  trackUsage(r);
  await applyPlacementExtras(r.id, user.id);
  return r;
};

export const deleteArticle = async ({
  data,
}: {
  data: { id: string; reason?: string; permanent?: boolean };
}) => {
  await requirePermission("articles:delete");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (data.permanent) {
    const { error } = await supabase.from("articles").delete().eq("id", data.id);
    if (error) throw toAppError(error);
    return { ok: true, permanent: true };
  }

  const { error } = await supabase
    .from("articles")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      delete_reason: data.reason?.trim() || "Deleted by editor",
    })
    .eq("id", data.id);
  if (error) {
    if (/deleted_at|schema cache|PGRST/i.test(error.message)) {
      const hard = await supabase.from("articles").delete().eq("id", data.id);
      if (hard.error) throw toAppError(hard.error);
      return { ok: true, permanent: true };
    }
    throw toAppError(error);
  }
  return { ok: true, permanent: false };
};

export const restoreArticle = async ({ data }: { data: { id: string } }) => {
  await requirePermission("articles:delete");
  const { error } = await supabase
    .from("articles")
    .update({ deleted_at: null, deleted_by: null, delete_reason: null })
    .eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const purgeArticle = async ({ data }: { data: { id: string } }) => {
  return deleteArticle({ data: { id: data.id, permanent: true } });
};

export const emptyTrash = async () => {
  await requirePermission("articles:delete");
  const { error } = await supabase.from("articles").delete().not("deleted_at", "is", null);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const duplicateArticle = async ({ data }: { data: { id: string } }) => {
  await requirePermission("articles:create");
  const source = await getAdminArticle({ data });
  if (!source) throw new Error("Article not found.");
  // Copy the Storage object so the duplicate owns its own featured image.
  // Sharing the same URL meant deleting/replacing one article's image broke the other.
  const heroCopy = source.hero_image_url
    ? await copyPublicStorageObject(source.hero_image_url)
    : null;
  return upsertArticle({
    data: {
      title: `${source.title} (Copy)`,
      deck: source.deck ?? undefined,
      body: source.body ?? undefined,
      section_id: source.section_id ?? "",
      region: source.region ?? undefined,
      badge_type: source.badge_type,
      hero_image_url: heroCopy ?? undefined,
      status: "draft",
    },
  });
};

/**
 * Persist the featured image immediately so a refresh cannot wipe an unsaved
 * upload (especially on published articles, which do not autosave).
 *
 * Social images follow the hero when they were empty or still pointed at the
 * previous hero — so replacing the featured image updates share previews
 * without clobbering an intentional custom OG override.
 */
export const patchArticleFeaturedImage = async ({
  data,
}: {
  data: {
    id: string;
    hero_image_url: string;
    syncSocial?: boolean;
  };
}) => {
  await requirePermission("articles:edit_own");
  if (!data.id) throw new Error("Article id is required.");
  const url = data.hero_image_url.trim();
  if (!url) throw new Error("Featured image URL is required.");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Featured image must be an absolute URL.");
  }

  const { data: existing, error: readError } = await supabase
    .from("articles")
    .select("id, hero_image_url, og_image_url, twitter_image_url, title, slug")
    .eq("id", data.id)
    .maybeSingle();
  if (readError) throw toAppError(readError);
  if (!existing) throw new Error("Article not found or you cannot edit it.");

  const previousHero = existing.hero_image_url?.trim() || null;
  const { data: row, error } = await supabase
    .from("articles")
    .update({ hero_image_url: url })
    .eq("id", data.id)
    .select("id, hero_image_url, og_image_url, twitter_image_url, title, slug")
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!row) throw new Error("Article not found or you cannot edit it.");

  let nextOg = existing.og_image_url?.trim() || "";
  let nextTw = existing.twitter_image_url?.trim() || "";
  if (data.syncSocial !== false) {
    const og = nextOg;
    const tw = nextTw;
    const ogFollowsHero = !og || og === previousHero;
    // Twitter follows hero when empty/previous-hero, or when it mirrored OG
    // and OG itself is also following the hero (don't orphan a custom pair).
    const twFollowsHero = !tw || tw === previousHero || (ogFollowsHero && tw === og);
    const socialPatch: Database["public"]["Tables"]["articles"]["Update"] = {};
    if (ogFollowsHero) {
      socialPatch.og_image_url = url;
      nextOg = url;
    }
    if (twFollowsHero) {
      socialPatch.twitter_image_url = url;
      nextTw = url;
    }
    if (Object.keys(socialPatch).length) {
      await supabase.from("articles").update(socialPatch).eq("id", data.id);
    }
  }

  void recordArticleMediaUsages({
    data: {
      article_id: row.id,
      title: row.title,
      slug: row.slug,
      urls: [{ field: "hero_image_url", url }],
    },
  });

  return {
    ok: true,
    hero_image_url: url,
    og_image_url: nextOg || url,
    twitter_image_url: nextTw || nextOg || url,
  };
};

/**
 * Duplicate a public Storage object to a new unique path so two articles
 * never share the same file reference.
 */
async function copyPublicStorageObject(publicUrl: string): Promise<string | null> {
  try {
    const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const bucket = match[1];
    const objectPath = decodeURIComponent(match[2]);
    const ext = objectPath.includes(".") ? objectPath.slice(objectPath.lastIndexOf(".")) : ".jpg";
    const destPath = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error } = await supabase.storage.from(bucket).copy(objectPath, destPath);
    if (error) {
      // Fallback: download + re-upload when copy is unsupported.
      const downloaded = await supabase.storage.from(bucket).download(objectPath);
      if (downloaded.error || !downloaded.data) return null;
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const contentType = downloaded.data.type || "image/jpeg";
      const uploaded = await supabase.storage.from(bucket).upload(destPath, bytes, {
        contentType,
        upsert: false,
      });
      if (uploaded.error) return null;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(destPath);
    return pub?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export const bulkManageArticles = async ({
  data,
}: {
  data: {
    ids: string[];
    action: "publish" | "archive" | "delete" | "reassign_category";
    section_id?: string | null;
  };
}) => {
  if (!data.ids.length) throw new Error("Select at least one article.");
  const permission =
    data.action === "delete"
      ? "articles:delete"
      : data.action === "reassign_category"
        ? "articles:edit_all"
        : "articles:publish";
  await requirePermission(permission);

  if (data.action === "delete") {
    // Soft-delete to Trash so bulk delete matches the single-article flow
    // (the RPC hard-deletes, which bypasses the recoverable Trash queue).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: rows, error } = await supabase
      .from("articles")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id ?? null,
        delete_reason: "Bulk delete",
      })
      .in("id", data.ids)
      .select("id");
    if (error) {
      if (/deleted_at|schema cache|PGRST/i.test(error.message)) {
        // Legacy schema without soft-delete: fall back to the hard-delete RPC.
        const { data: affected, error: rpcError } = await supabase.rpc(
          "admin_bulk_manage_articles",
          { p_ids: data.ids, p_action: "delete", p_section_id: null },
        );
        if (rpcError) throw toAppError(rpcError);
        return { affected: affected ?? 0 };
      }
      throw toAppError(error);
    }
    return { affected: rows?.length ?? 0 };
  }

  const { data: affected, error } = await supabase.rpc("admin_bulk_manage_articles", {
    p_ids: data.ids,
    p_action: data.action,
    p_section_id: data.section_id ?? null,
  });
  if (error) throw toAppError(error);
  return { affected: affected ?? 0 };
};

export const getArticleRevisions = async ({ data }: { data: { article_id: string } }) => {
  await requirePermission("articles:view");
  const { data: revisions, error } = await supabase
    .from("article_revisions")
    .select("*, changer:profiles!article_revisions_changed_by_fkey(name)")
    .eq("article_id", data.article_id)
    .order("version", { ascending: false })
    .limit(50);
  if (error) throw toAppError(error);
  return revisions ?? [];
};

/** Unwrap format-1 (flat) and format-2 (`{ article, tag_ids }`) revision snapshots. */
export function unwrapRevisionSnapshot(
  raw: unknown,
): Partial<Database["public"]["Tables"]["articles"]["Row"]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  if (obj.article && typeof obj.article === "object" && !Array.isArray(obj.article)) {
    return obj.article as Partial<Database["public"]["Tables"]["articles"]["Row"]>;
  }
  return obj as Partial<Database["public"]["Tables"]["articles"]["Row"]>;
}

export type ArticleNoteType = "editorial" | "fact_check";

export type ArticleApprovalAction =
  "submit_review" | "approve" | "reject" | "request_changes" | "publish" | "schedule" | "archive";

export const listArticleNotes = async ({
  data,
}: {
  data: { article_id: string; note_type?: ArticleNoteType };
}) => {
  await requirePermission("articles:view");
  let query = supabase
    .from("article_notes")
    .select("*, author:profiles!article_notes_author_id_fkey(name)")
    .eq("article_id", data.article_id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (data.note_type) query = query.eq("note_type", data.note_type);
  const { data: rows, error } = await query;
  if (error) throw toAppError(error);
  return rows ?? [];
};

export const addArticleNote = async ({
  data,
}: {
  data: { article_id: string; note_type: ArticleNoteType; body: string };
}) => {
  const body = data.body.trim();
  if (!body) throw new Error("Note cannot be empty.");
  if (data.note_type === "editorial") {
    await requireAnyPermission(["articles:edit_own", "articles:edit_all", "articles:review"]);
  } else {
    await requireAnyPermission(["articles:review", "articles:edit_all"]);
  }
  const { data: row, error } = await supabase
    .from("article_notes")
    .insert({
      article_id: data.article_id,
      note_type: data.note_type,
      body,
    })
    .select("*, author:profiles!article_notes_author_id_fkey(name)")
    .single();
  if (error) throw toAppError(error);
  return row;
};

export const listArticleApprovals = async ({ data }: { data: { article_id: string } }) => {
  await requirePermission("articles:view");
  const { data: rows, error } = await supabase
    .from("article_approvals")
    .select("*, actor:profiles!article_approvals_actor_id_fkey(name)")
    .eq("article_id", data.article_id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw toAppError(error);
  return rows ?? [];
};

export const recordArticleApproval = async ({
  data,
}: {
  data: {
    article_id: string;
    action: ArticleApprovalAction;
    from_status?: ArticleStatus | null;
    to_status?: ArticleStatus | null;
    note?: string | null;
  };
}) => {
  await requireAnyPermission([
    "articles:review",
    "articles:publish",
    "articles:edit_all",
    "articles:edit_own",
  ]);
  const { data: row, error } = await supabase
    .from("article_approvals")
    .insert({
      article_id: data.article_id,
      action: data.action,
      from_status: data.from_status ?? null,
      to_status: data.to_status ?? null,
      note: data.note?.trim() || null,
    })
    .select("*, actor:profiles!article_approvals_actor_id_fkey(name)")
    .single();
  if (error) throw toAppError(error);
  return row;
};

export const applyArticleWorkflowAction = async ({
  data,
}: {
  data: {
    article_id: string;
    action: ArticleApprovalAction;
    note?: string;
    scheduled_at?: string | null;
  };
}) => {
  const article = await getAdminArticle({ data: { id: data.article_id } });
  if (!article) throw new Error("Article not found.");
  const from = article.status as ArticleStatus;

  let to: ArticleStatus = from;
  switch (data.action) {
    case "submit_review":
      if (from !== "draft") throw new Error("Only drafts can be submitted for review.");
      to = "review";
      break;
    case "approve":
      if (from !== "review") throw new Error("Only articles in review can be approved.");
      to = "approved";
      break;
    case "reject":
    case "request_changes":
      if (from !== "review" && from !== "approved") {
        throw new Error("Only articles in review or approved can be sent back.");
      }
      to = "draft";
      break;
    case "publish":
      to = "published";
      break;
    case "schedule":
      to = "scheduled";
      break;
    case "archive":
      to = "archived";
      break;
    default:
      throw new Error("Unknown workflow action.");
  }

  if (data.action === "publish" || data.action === "schedule" || data.action === "archive") {
    await requirePermission("articles:publish");
  } else if (data.action === "submit_review") {
    await requireAnyPermission(["articles:edit_own", "articles:edit_all", "articles:create"]);
  } else {
    await requireAnyPermission(["articles:review", "articles:publish", "articles:edit_all"]);
  }

  const updated =
    to !== from
      ? await upsertArticle({
          data: {
            id: data.article_id,
            title: article.title,
            deck: article.deck ?? undefined,
            body: article.body ?? undefined,
            section_id: article.section_id!,
            region: article.region ?? undefined,
            badge_type: article.badge_type,
            hero_image_url: article.hero_image_url ?? undefined,
            status: to,
            slug: article.slug,
            scheduled_at:
              to === "scheduled"
                ? (data.scheduled_at ?? article.scheduled_at)
                : to === "published"
                  ? null
                  : article.scheduled_at,
          },
        })
      : article;

  await recordArticleApproval({
    data: {
      article_id: data.article_id,
      action: data.action,
      from_status: from,
      to_status: to,
      note: data.note,
    },
  });

  return updated;
};

export const getArticlesQueueSnapshot = async ({
  data,
}: {
  data: { queue: "review" | "approved" | "published" | "scheduled" | "archived" | "trash" | "all" };
}) => {
  await requirePermission("articles:view");
  const counts = await getArticlesLibraryCounts();
  const articles = data.queue === "trash" ? await listTrashedArticles() : await listAdminArticles();
  const filtered =
    data.queue === "all" || data.queue === "trash"
      ? articles
      : articles.filter((a) => (a as { status?: string }).status === data.queue);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (data.queue === "review") {
    const dueToday = filtered.filter(
      (a) => new Date((a as { updated_at: string }).updated_at) < startOfToday,
    ).length;
    return {
      kpis: [
        { label: "Pending Review", value: counts.review, detail: "In editorial queue" },
        { label: "Due Today", value: dueToday, detail: "Waiting longer than today" },
        { label: "Assigned to Me", value: "—", detail: "Assignment not configured" },
        { label: "Approved Today", value: "—", detail: "Connect approvals feed" },
      ],
      items: filtered,
      counts,
    };
  }
  if (data.queue === "approved") {
    return {
      kpis: [
        { label: "Approved Articles", value: counts.approved, detail: "Ready for publish" },
        {
          label: "Ready to Publish",
          value: counts.approved,
          detail: "No schedule set",
        },
        { label: "Scheduled", value: counts.scheduled, detail: "From pipeline" },
        { label: "Est. Total Views", value: "—", detail: "Connect analytics" },
      ],
      items: filtered,
      counts,
    };
  }
  if (data.queue === "published") {
    return {
      kpis: [
        { label: "Published Articles", value: counts.published },
        { label: "Total Views", value: "—", detail: "Connect analytics" },
        { label: "Avg. Engagement", value: "—", detail: "Connect analytics" },
        { label: "Total Shares", value: "—", detail: "Connect analytics" },
      ],
      items: filtered,
      counts,
    };
  }
  if (data.queue === "scheduled") {
    const dueToday = filtered.filter((a) => {
      const at = (a as { scheduled_at?: string | null }).scheduled_at;
      if (!at) return false;
      const d = new Date(at);
      return d >= startOfToday && d < new Date(startOfToday.getTime() + 86400000);
    }).length;
    const next = [...filtered]
      .filter((a) => (a as { scheduled_at?: string | null }).scheduled_at)
      .sort(
        (a, b) =>
          new Date((a as { scheduled_at: string }).scheduled_at).getTime() -
          new Date((b as { scheduled_at: string }).scheduled_at).getTime(),
      )[0] as { title?: string; scheduled_at?: string } | undefined;
    return {
      kpis: [
        { label: "Scheduled Articles", value: counts.scheduled },
        { label: "Due Today", value: dueToday },
        {
          label: "Due This Week",
          value: filtered.filter((a) => {
            const at = (a as { scheduled_at?: string | null }).scheduled_at;
            return at && new Date(at) < new Date(startOfToday.getTime() + 7 * 86400000);
          }).length,
        },
        {
          label: "Next Article",
          value: next?.scheduled_at
            ? new Date(next.scheduled_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—",
          detail: next?.title?.slice(0, 40) || "None queued",
        },
      ],
      items: filtered,
      upcoming: filtered
        .filter((a) => (a as { scheduled_at?: string | null }).scheduled_at)
        .sort(
          (a, b) =>
            new Date((a as { scheduled_at: string }).scheduled_at).getTime() -
            new Date((b as { scheduled_at: string }).scheduled_at).getTime(),
        )
        .slice(0, 5),
      counts,
    };
  }
  if (data.queue === "archived") {
    const thisMonth = filtered.filter(
      (a) =>
        new Date((a as { updated_at: string }).updated_at) >=
        new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1),
    ).length;
    return {
      kpis: [
        { label: "Total Archived", value: counts.archived },
        { label: "This Month", value: thisMonth },
        {
          label: "This Year",
          value: filtered.filter(
            (a) =>
              new Date((a as { updated_at: string }).updated_at).getFullYear() ===
              startOfToday.getFullYear(),
          ).length,
        },
        {
          label: "Last Archived",
          value: filtered[0]
            ? new Date((filtered[0] as { updated_at: string }).updated_at).toLocaleDateString()
            : "—",
        },
      ],
      items: filtered,
      counts,
    };
  }
  if (data.queue === "trash") {
    const autoDeleteDays = 30;
    const willDelete = filtered.filter((a) => {
      const del = (a as { deleted_at?: string | null }).deleted_at;
      if (!del) return false;
      const age = (Date.now() - new Date(del).getTime()) / 86400000;
      return age >= autoDeleteDays - 2;
    }).length;
    return {
      kpis: [
        { label: "Total in Trash", value: counts.trash },
        {
          label: "Will be deleted soon",
          value: willDelete,
          detail: `Older than ${autoDeleteDays - 2} days`,
        },
        { label: "Auto-delete after", value: `${autoDeleteDays} Days` },
        { label: "Recovered this month", value: "—", detail: "Not tracked yet" },
      ],
      items: filtered,
      counts,
      autoDeleteDays,
    };
  }

  return {
    kpis: [
      { label: "Total Articles", value: counts.all },
      { label: "Published", value: counts.published },
      { label: "Drafts", value: counts.draft },
      { label: "Pending Review", value: counts.review },
      { label: "Scheduled", value: counts.scheduled },
      { label: "Archived", value: counts.archived },
    ],
    items: filtered,
    counts,
    weekAgo: weekAgo.toISOString(),
  };
};

export const restoreArticleRevision = async ({
  data,
}: {
  data: { article_id: string; revision_id: string };
}) => {
  const { data: restoredId, error: rpcError } = await supabase.rpc(
    "admin_restore_article_revision",
    { p_revision_id: data.revision_id },
  );
  if (!rpcError && restoredId) {
    return getAdminArticle({ data: { id: data.article_id } });
  }
  if (rpcError && !/admin_restore_article_revision|schema cache|PGRST202/i.test(rpcError.message)) {
    throw toAppError(rpcError);
  }

  const { data: revision, error } = await supabase
    .from("article_revisions")
    .select("snapshot")
    .eq("id", data.revision_id)
    .eq("article_id", data.article_id)
    .single();
  if (error) throw toAppError(error);

  const snapshot = unwrapRevisionSnapshot(
    revision.snapshot,
  ) as Database["public"]["Tables"]["articles"]["Row"];
  if (!snapshot?.title || !snapshot.section_id) {
    throw new Error("This revision cannot be restored.");
  }
  const article = await upsertArticle({
    data: {
      id: data.article_id,
      title: snapshot.title,
      deck: snapshot.deck ?? undefined,
      body: snapshot.body ?? undefined,
      section_id: snapshot.section_id,
      region: snapshot.region ?? undefined,
      badge_type: snapshot.badge_type,
      hero_image_url: snapshot.hero_image_url ?? undefined,
      status: snapshot.status,
      slug: snapshot.slug,
      scheduled_at: snapshot.scheduled_at,
    },
  });
  await updateArticleSeo({
    data: {
      article_id: data.article_id,
      seo_title: snapshot.seo_title,
      meta_description: snapshot.meta_description,
      focus_keyword: snapshot.focus_keyword,
      canonical_url: snapshot.canonical_url,
      robots_index: snapshot.robots_index,
      robots_follow: snapshot.robots_follow,
      schema_type: (["NewsArticle", "Article", "Review", "Report"].includes(snapshot.schema_type)
        ? snapshot.schema_type
        : "NewsArticle") as ArticleSeoInput["schema_type"],
      og_title: snapshot.og_title,
      og_description: snapshot.og_description,
      og_image_url: snapshot.og_image_url,
      twitter_card: snapshot.twitter_card === "summary" ? "summary" : "summary_large_image",
      twitter_title: snapshot.twitter_title,
      twitter_description: snapshot.twitter_description,
      twitter_image_url: snapshot.twitter_image_url,
      rss_inclusion: snapshot.rss_inclusion,
      hreflang:
        snapshot.hreflang &&
        !Array.isArray(snapshot.hreflang) &&
        typeof snapshot.hreflang === "object"
          ? Object.fromEntries(
              Object.entries(snapshot.hreflang).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : {},
    },
  });

  if (
    revision.snapshot &&
    typeof revision.snapshot === "object" &&
    !Array.isArray(revision.snapshot) &&
    Array.isArray((revision.snapshot as { tag_ids?: unknown }).tag_ids)
  ) {
    const tagIds = (revision.snapshot as { tag_ids: string[] }).tag_ids;
    if (tagIds.length) {
      const { data: tags } = await supabase.from("tags").select("id,name").in("id", tagIds);
      if (tags?.length) {
        await setArticleTags({
          data: { article_id: data.article_id, tag_names: tags.map((tag) => tag.name) },
        });
      }
    }
  }

  return article;
};

export const publishDueArticles = async () => {
  await requirePermission("articles:publish");
  const { data, error } = await supabase.rpc("publish_due_articles");
  if (error) {
    if (/publish_due_articles|schema cache|PGRST202/i.test(error.message)) {
      throw new Error(
        "Scheduled publish is not installed. Apply supabase/migrations/20260718120000_newsroom_foundation_hardening.sql.",
      );
    }
    throw toAppError(error);
  }
  return { published: data ?? 0 };
};

// AMBASSADORS
export const listAmbassadors = async () => {
  await requireEditorRole();
  const { data, error } = await supabase.from("ambassadors").select("*").order("name");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const upsertAmbassador = async ({
  data,
}: {
  data: {
    id?: string;
    name: string;
    country: string;
    position?: string;
    flag_emoji?: string;
    avatar_url?: string;
    quote?: string;
    tags?: string[];
    status?: "active" | "recalled" | "vacant";
    featured?: boolean;
  };
}) => {
  await requireEditorRole();
  const { id, ...payload } = data;
  if (id) {
    const { error } = await supabase.from("ambassadors").update(payload).eq("id", id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from("ambassadors").insert(payload);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const deleteAmbassador = async ({ data }: { data: { id: string } }) => {
  await requireEditorRole();
  const { error } = await supabase.from("ambassadors").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

// EMBASSIES
export const listEmbassies = async () => {
  await requireEditorRole();
  const { data, error } = await supabase.from("embassies").select("*").order("country");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const upsertEmbassy = async ({
  data,
}: {
  data: {
    id?: string;
    country: string;
    headline?: string;
    status: "open" | "limited" | "closed" | "alert";
    ambassador_id?: string | null;
  };
}) => {
  await requireEditorRole();
  const { id, ...payload } = data;
  if (id) {
    const { error } = await supabase.from("embassies").update(payload).eq("id", id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from("embassies").insert(payload);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const deleteEmbassy = async ({ data }: { data: { id: string } }) => {
  await requireEditorRole();
  const { error } = await supabase.from("embassies").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

// WAR MONITOR
export const listWar = async () => {
  await requireEditorRole();
  const { data, error } = await supabase
    .from("war_monitor_items")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw toAppError(error);
  return data ?? [];
};

export const upsertWar = async ({
  data,
}: {
  data: {
    id?: string;
    conflict_name: string;
    countries?: string[];
    headline?: string;
    status: "active" | "ceasefire" | "tension";
  };
}) => {
  await requireEditorRole();
  const { id, ...payload } = data;
  if (id) {
    const { error } = await supabase.from("war_monitor_items").update(payload).eq("id", id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from("war_monitor_items").insert(payload);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const deleteWar = async ({ data }: { data: { id: string } }) => {
  await requireEditorRole();
  const { error } = await supabase.from("war_monitor_items").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

// TICKER
export const listTicker = async () => {
  await requireEditorRole();
  const { data, error } = await supabase.from("ticker_items").select("*").order("sort_order");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const upsertTicker = async ({
  data,
}: {
  data: { id?: string; text: string; tag?: string; active: boolean; sort_order: number };
}) => {
  await requireEditorRole();
  const { id, ...payload } = data;
  if (id) {
    const { error } = await supabase.from("ticker_items").update(payload).eq("id", id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from("ticker_items").insert(payload);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const deleteTicker = async ({ data }: { data: { id: string } }) => {
  await requireEditorRole();
  const { error } = await supabase.from("ticker_items").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

// VIDEOS
export const listVideos = async () => {
  await requirePermission("videos:manage");
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("published_at", { ascending: false });
  if (error) throw toAppError(error);
  return data ?? [];
};

export const upsertVideo = async ({
  data,
}: {
  data: {
    id?: string;
    title: string;
    category?: string;
    duration?: string;
    thumbnail_url?: string;
    video_url?: string;
  };
}) => {
  await requirePermission("videos:manage");
  const { id, ...payload } = data;
  if (id) {
    const { error } = await supabase.from("videos").update(payload).eq("id", id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from("videos").insert(payload);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const deleteVideo = async ({ data }: { data: { id: string } }) => {
  await requirePermission("videos:manage");
  const { error } = await supabase.from("videos").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

type MediaModuleTable = "epaper_editions" | "podcast_episodes" | "infographics";

async function listMediaModule(table: MediaModuleTable) {
  await requirePermission("videos:manage");
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("published_at", { ascending: false });
  if (error) throw toAppError(error);
  return data ?? [];
}

async function upsertMediaModule(table: MediaModuleTable, data: Record<string, unknown>) {
  await requirePermission("videos:manage");
  const { id, ...payload } = data;
  // Dynamic table + loose admin form payloads — cast to satisfy generated Supabase types.
  if (typeof id === "string" && id) {
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq("id", id);
    if (error) throw toAppError(error);
  } else {
    const { error } = await supabase.from(table).insert(payload as never);
    if (error) throw toAppError(error);
  }
  return { ok: true };
}

async function deleteMediaModule(table: MediaModuleTable, id: string) {
  await requirePermission("videos:manage");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw toAppError(error);
  return { ok: true };
}

export const listEpaperEditions = () => listMediaModule("epaper_editions");
export const upsertEpaperEdition = ({ data }: { data: Record<string, unknown> }) =>
  upsertMediaModule("epaper_editions", data);
export const deleteEpaperEdition = ({ data }: { data: { id: string } }) =>
  deleteMediaModule("epaper_editions", data.id);

export const listPodcastEpisodes = () => listMediaModule("podcast_episodes");
export const upsertPodcastEpisode = ({ data }: { data: Record<string, unknown> }) =>
  upsertMediaModule("podcast_episodes", data);
export const deletePodcastEpisode = ({ data }: { data: { id: string } }) =>
  deleteMediaModule("podcast_episodes", data.id);

export const listInfographics = () => listMediaModule("infographics");
export const upsertInfographic = ({ data }: { data: Record<string, unknown> }) =>
  upsertMediaModule("infographics", data);
export const deleteInfographic = ({ data }: { data: { id: string } }) =>
  deleteMediaModule("infographics", data.id);

const requireSuperAdmin = async () => {
  return (await requirePermission("staff:manage")).user;
};

// ACCESS MANAGEMENT (super admin only)
export type StaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  byline_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  social_links: Record<string, string>;
  status: "active" | "suspended" | "invited";
  created_at: string;
  mfa_enabled: boolean;
  auth_banned: boolean;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: AppRole[];
  section_ids: string[];
};

export type StaffSocialLinks = {
  twitter?: string;
  linkedin?: string;
  website?: string;
  bluesky?: string;
};

const parseStaffList = (raw: unknown): StaffMember[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    const social =
      row.social_links && typeof row.social_links === "object" && !Array.isArray(row.social_links)
        ? (row.social_links as Record<string, string>)
        : {};
    const roles = Array.isArray(row.roles)
      ? row.roles.filter((role): role is AppRole => typeof role === "string" && isAppRole(role))
      : [];
    const sectionIds = Array.isArray(row.section_ids)
      ? row.section_ids.filter((id): id is string => typeof id === "string")
      : [];
    const status = row.status === "suspended" || row.status === "invited" ? row.status : "active";
    return {
      id: String(row.id),
      name: (row.name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      byline_name: (row.byline_name as string | null) ?? null,
      bio: (row.bio as string | null) ?? null,
      avatar_url: (row.avatar_url as string | null) ?? null,
      social_links: social,
      status,
      created_at: String(row.created_at ?? ""),
      mfa_enabled: Boolean(row.mfa_enabled),
      auth_banned: Boolean(row.auth_banned),
      last_sign_in_at: (row.last_sign_in_at as string | null) ?? null,
      email_confirmed_at: (row.email_confirmed_at as string | null) ?? null,
      roles,
      section_ids: sectionIds,
    };
  });
};

export const listEditors = async () => {
  await requireSuperAdmin();
  const { data, error } = await supabase.rpc("admin_list_staff");
  if (!error && data != null) {
    const staff = parseStaffList(data);
    return {
      staff,
      // Backward-compatible shape for any residual callers.
      profiles: staff,
      roles: staff.flatMap((member) => member.roles.map((role) => ({ user_id: member.id, role }))),
      access: staff.flatMap((member) =>
        member.section_ids.map((section_id) => ({
          profile_id: member.id,
          section_id,
        })),
      ),
    };
  }

  if (error && !/admin_list_staff|schema cache|PGRST202/i.test(error.message)) {
    throw toAppError(error);
  }

  // Fallback before the staff migration is applied.
  const [profilesRes, rolesRes, accessRes] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("user_roles").select("*"),
    supabase.from("editor_section_access").select("*"),
  ]);
  if (profilesRes.error) throw toAppError(profilesRes.error);
  if (rolesRes.error) throw toAppError(rolesRes.error);
  if (accessRes.error) throw toAppError(accessRes.error);
  const roles = rolesRes.data ?? [];
  const access = accessRes.data ?? [];
  const staff: StaffMember[] = (profilesRes.data ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email ?? null,
    byline_name: profile.byline_name ?? null,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    social_links:
      profile.social_links &&
      typeof profile.social_links === "object" &&
      !Array.isArray(profile.social_links)
        ? (profile.social_links as Record<string, string>)
        : {},
    status:
      profile.status === "suspended" || profile.status === "invited" ? profile.status : "active",
    created_at: profile.created_at,
    mfa_enabled: false,
    auth_banned: false,
    last_sign_in_at: null,
    email_confirmed_at: null,
    roles: roles.filter((r) => r.user_id === profile.id).map((r) => r.role),
    section_ids: access.filter((a) => a.profile_id === profile.id).map((a) => a.section_id),
  }));
  return { staff, profiles: staff, roles, access };
};

const staffApi = async (payload: Record<string, unknown>) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required.");
  const response = await fetch("/api/staff", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
  if (!response.ok) {
    throw new Error(body.error || "Staff administration request failed.");
  }
  return body;
};

export const inviteStaffMember = async ({
  data,
}: {
  data: {
    email: string;
    name: string;
    byline_name?: string;
    role: AppRole;
    section_ids: string[];
  };
}) => {
  await requireSuperAdmin();
  return staffApi({ action: "invite", ...data });
};

export const setStaffSuspended = async ({
  data,
}: {
  data: { user_id: string; suspended: boolean };
}) => {
  await requireSuperAdmin();
  return staffApi({
    action: data.suspended ? "suspend" : "unsuspend",
    user_id: data.user_id,
  });
};

export const sendStaffPasswordReset = async ({ data }: { data: { email: string } }) => {
  await requireSuperAdmin();
  return staffApi({ action: "reset_password", email: data.email });
};

export const refreshStaffMfaStatus = async ({ data }: { data: { user_id: string } }) => {
  await requireSuperAdmin();
  return staffApi({ action: "mfa_status", user_id: data.user_id }) as Promise<{
    ok: boolean;
    mfa_enabled?: boolean;
  }>;
};

export const toggleSectionAccess = async ({
  data,
}: {
  data: { profile_id: string; section_id: string; grant: boolean };
}) => {
  await requireSuperAdmin();
  if (data.grant) {
    const { error } = await supabase
      .from("editor_section_access")
      .insert({ profile_id: data.profile_id, section_id: data.section_id });
    if (error && error.code !== "23505" && !error.message.includes("duplicate"))
      throw toAppError(error);
  } else {
    const { error } = await supabase
      .from("editor_section_access")
      .delete()
      .eq("profile_id", data.profile_id)
      .eq("section_id", data.section_id);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

export const setUserRole = async ({
  data,
}: {
  data: { user_id: string; role: AppRole; grant: boolean };
}) => {
  await requireSuperAdmin();
  if (data.grant) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error && error.code !== "23505" && !error.message.includes("duplicate"))
      throw toAppError(error);
  } else {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw toAppError(error);
  }
  return { ok: true };
};

// CATEGORIES / TAXONOMY — see category.functions.ts for full CMS module
export {
  archiveCategory,
  bulkArchiveCategories,
  deleteCategory,
  duplicateCategory,
  exportCategories,
  getCategoriesDashboard,
  getCategoriesLibraryCounts,
  getCategoryAnalytics,
  getCategoryDetail,
  getCategoryModuleSettings,
  importCategories,
  listCategories,
  listCategoriesTable,
  listCategoryActivity,
  listCategoryArticles,
  reorderCategories,
  rowToWizardPayload,
  updateCategoryModuleSettings,
  upsertCategory,
} from "@/lib/category.functions";

// TAGS CMS — see tag.functions.ts (legacy listTags / setArticleTags remain above)
export {
  deleteTag,
  exportTags,
  getTagAnalytics,
  getTagArticles,
  getTagDetail,
  getTagsDashboard,
  getTagsLibraryCounts,
  getTagsModuleAnalytics,
  getTagsSidebarWidgets,
  importTags,
  listSeoTagsQueue,
  listTagActivity,
  listTagsAdmin,
  listTagsTable,
  listTrendingTags,
  optimizeTagSeo,
  rowToTagWizardPayload,
  upsertTag,
} from "@/lib/tag.functions";

// STAFF
export const updateStaffProfile = async ({
  data,
}: {
  data: {
    id: string;
    name: string;
    byline_name?: string | null;
    bio?: string | null;
    email?: string | null;
    social_links?: StaffSocialLinks;
  };
}) => {
  await requireSuperAdmin();
  const social = data.social_links ?? {};
  const cleanedSocial = Object.fromEntries(
    Object.entries(social)
      .map(([key, value]) => [key, value?.trim() || ""])
      .filter(([, value]) => value),
  );
  const { error } = await supabase
    .from("profiles")
    .update({
      name: data.name.trim() || null,
      byline_name: data.byline_name?.trim() || null,
      bio: data.bio?.trim() || null,
      email: data.email?.trim().toLowerCase() || null,
      social_links: cleanedSocial,
    })
    .eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

// MEDIA LIBRARY / DAM — implemented in media.functions.ts
export {
  type MediaAssetRow,
  listMediaFolders,
  upsertMediaFolder,
  deleteMediaFolder,
  listMediaAssets,
  listMediaAssetsPage,
  getMediaAssetCounts,
  listMediaUploaders,
  listMediaCategoryOptions,
  updateMediaAsset,
  moveMediaAssets,
  bulkUpdateMediaTags,
  bulkSetMediaCategory,
  trashMediaAssets,
  restoreMediaAssets,
  deleteMediaAsset,
  permanentlyDeleteMediaAssets,
  replaceMediaAssetFile,
  listMediaAssetUsages,
  syncMediaAssetUsages,
  uploadHeroImage,
  uploadMediaAsset,
  uploadMediaAssetsBulk,
  getMediaSettings,
  updateMediaSettings,
  getMediaStorageStats,
  listMediaGalleries,
  getGalleryCounts,
  getMediaGallery,
  upsertMediaGallery,
  deleteMediaGallery,
  duplicateMediaGallery,
  addMediaToGallery,
  removeMediaFromGallery,
  reorderGalleryMedia,
  getPublicGalleryBySlug,
} from "@/lib/media.functions";

export { recordArticleMediaUsages };

// COMMENTS
export const listComments = async () => {
  await requirePermission("comments:moderate");
  const { data, error } = await supabase
    .from("comments")
    .select("*, articles(id,title,slug)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw toAppError(error);
  return data ?? [];
};

export const moderateComment = async ({
  data,
}: {
  data: {
    id: string;
    status: Database["public"]["Enums"]["comment_status"];
    moderation_note?: string | null;
  };
}) => {
  const { user } = await requirePermission("comments:moderate");
  const payload: Database["public"]["Tables"]["comments"]["Update"] = {
    status: data.status,
    moderated_by: user.id,
    moderated_at: new Date().toISOString(),
  };
  if (data.moderation_note !== undefined) {
    payload.moderation_note = data.moderation_note?.trim() || null;
  }
  const { error } = await supabase.from("comments").update(payload).eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const bulkModerateComments = async ({
  data,
}: {
  data: {
    ids: string[];
    status: Database["public"]["Enums"]["comment_status"];
    moderation_note?: string | null;
  };
}) => {
  const { user } = await requirePermission("comments:moderate");
  if (!data.ids.length) throw new Error("Select at least one comment.");
  const payload: Database["public"]["Tables"]["comments"]["Update"] = {
    status: data.status,
    moderated_by: user.id,
    moderated_at: new Date().toISOString(),
  };
  if (data.moderation_note !== undefined) {
    payload.moderation_note = data.moderation_note?.trim() || null;
  }
  const { error } = await supabase.from("comments").update(payload).in("id", data.ids);
  if (error) throw toAppError(error);
  return { ok: true, count: data.ids.length };
};

export const bulkDeleteComments = async ({ data }: { data: { ids: string[] } }) => {
  await requirePermission("comments:moderate");
  if (!data.ids.length) throw new Error("Select at least one comment.");
  const { error } = await supabase.from("comments").delete().in("id", data.ids);
  if (error) throw toAppError(error);
  return { ok: true, count: data.ids.length };
};

export const listCommentReports = async () => {
  await requirePermission("comments:moderate");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("comment_reports")
    .select(
      "id,comment_id,reporter_name,reporter_email,reason,status,created_at,resolved_at,resolution_note,comments(id,author_name,author_email,body,status,article_id,articles(id,title))",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (/comment_reports|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const resolveCommentReport = async ({
  data,
}: {
  data: {
    id: string;
    status: "resolved" | "dismissed";
    resolution_note?: string | null;
    comment_status?: Database["public"]["Enums"]["comment_status"];
  };
}) => {
  const { user } = await requirePermission("comments:moderate");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: report, error: loadError } = await (supabase as any)
    .from("comment_reports")
    .select("id,comment_id")
    .eq("id", data.id)
    .maybeSingle();
  if (loadError) throw toAppError(loadError);
  if (!report) throw new Error("Report not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("comment_reports")
    .update({
      status: data.status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: data.resolution_note?.trim() || null,
    })
    .eq("id", data.id);
  if (error) throw toAppError(error);

  if (data.comment_status) {
    await moderateComment({
      data: {
        id: report.comment_id,
        status: data.comment_status,
        moderation_note: data.resolution_note ?? `Report ${data.status}`,
      },
    });
  }
  return { ok: true };
};

export type CommentSettingsRow = {
  id: boolean;
  min_length: number;
  max_length: number;
  max_links: number;
  require_approval: boolean;
  auto_flag_profanity: boolean;
  auto_spam_phrases: boolean;
  banned_words: string[];
  updated_at: string;
  updated_by: string | null;
};

const DEFAULT_COMMENT_SETTINGS: CommentSettingsRow = {
  id: true,
  min_length: 2,
  max_length: 4000,
  max_links: 3,
  require_approval: true,
  auto_flag_profanity: true,
  auto_spam_phrases: true,
  banned_words: [],
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const getCommentSettings = async (): Promise<CommentSettingsRow> => {
  await requirePermission("comments:moderate");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("comment_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    if (/comment_settings|schema cache|PGRST/i.test(error.message)) return DEFAULT_COMMENT_SETTINGS;
    throw toAppError(error);
  }
  if (!data) return DEFAULT_COMMENT_SETTINGS;
  return {
    ...DEFAULT_COMMENT_SETTINGS,
    ...data,
    banned_words: Array.isArray(data.banned_words) ? data.banned_words : [],
  };
};

export const updateCommentSettings = async ({
  data,
}: {
  data: Partial<Omit<CommentSettingsRow, "id" | "updated_at" | "updated_by">>;
}) => {
  const { user } = await requirePermission("comments:moderate");
  const payload = {
    ...data,
    banned_words: (data.banned_words ?? [])
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 200),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("comment_settings").update(payload).eq("id", true);
  if (error) {
    if (/comment_settings|schema cache|PGRST/i.test(error.message)) {
      throw new Error("Apply the comment settings migration before saving rules.");
    }
    throw toAppError(error);
  }
  return { ok: true };
};

export const deleteComment = async ({ data }: { data: { id: string } }) => {
  await requirePermission("comments:moderate");
  const { error } = await supabase.from("comments").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const listCommentBlocks = async () => {
  await requirePermission("comments:moderate");
  const { data, error } = await supabase
    .from("comment_blocks")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (/comment_blocks|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const blockCommenter = async ({
  data,
}: {
  data: { email: string; reason?: string | null; comment_id?: string };
}) => {
  const { user } = await requirePermission("comments:moderate");
  const email = data.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("A valid email is required to block a commenter.");

  const { error } = await supabase.from("comment_blocks").upsert(
    {
      email,
      reason: data.reason?.trim() || "Blocked by moderator",
      blocked_by: user.id,
    },
    { onConflict: "email" },
  );
  if (error) {
    if (/comment_blocks|schema cache|PGRST/i.test(error.message)) {
      throw new Error(
        "Comment blocklist is not installed. Apply supabase/migrations/20260718100000_comment_moderation_enum.sql then 20260718100001_comment_moderation.sql.",
      );
    }
    throw toAppError(error);
  }

  if (data.comment_id) {
    await supabase
      .from("comments")
      .update({
        status: "spam",
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        moderation_note: data.reason?.trim() || "Commenter blocked",
      })
      .eq("id", data.comment_id);
  }

  return { ok: true };
};

export const unblockCommenter = async ({ data }: { data: { email: string } }) => {
  await requirePermission("comments:moderate");
  const email = data.email.trim().toLowerCase();
  const { error } = await supabase.from("comment_blocks").delete().eq("email", email);
  if (error) throw toAppError(error);
  return { ok: true };
};

// ANALYTICS
export const getAnalyticsOverview = async () => {
  await requirePermission("analytics:view");
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  const date = since.toISOString().slice(0, 10);
  const [metricsRes, articlesRes, commentsRes] = await Promise.all([
    supabase
      .from("article_daily_metrics")
      .select("article_id,metric_date,views,articles(id,title,slug,sections(name))")
      .gte("metric_date", date)
      .order("metric_date"),
    supabase
      .from("articles")
      .select("id,status,created_at,published_at,section_id,sections(name)")
      .gte("created_at", since.toISOString()),
    supabase.from("comments").select("id,status,created_at").gte("created_at", since.toISOString()),
  ]);
  if (metricsRes.error) throw toAppError(metricsRes.error);
  if (articlesRes.error) throw toAppError(articlesRes.error);
  if (commentsRes.error) throw toAppError(commentsRes.error);
  return {
    metrics: metricsRes.data ?? [],
    articles: articlesRes.data ?? [],
    comments: commentsRes.data ?? [],
  };
};

// SETTINGS
export const getNewsroomSettings = async () => {
  await requirePermission("settings:manage");
  const { data, error } = await supabase
    .from("newsroom_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw toAppError(error);
  return data;
};

const writeAuditLog = async (entry: {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  summary?: string | null;
  payload?: Database["public"]["Tables"]["admin_audit_logs"]["Insert"]["payload"];
}) => {
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
};

export const updateNewsroomSettings = async ({
  data,
}: {
  data: Database["public"]["Tables"]["newsroom_settings"]["Update"];
}) => {
  const { user } = await requirePermission("settings:manage");
  const { id: _id, updated_at: _updatedAt, updated_by: _updatedBy, ...payload } = data;
  const { error } = await supabase.from("newsroom_settings").update(payload).eq("id", true);
  if (error) {
    if (/seo_defaults|integrations|notification_prefs|schema cache|PGRST/i.test(error.message)) {
      const legacy: Database["public"]["Tables"]["newsroom_settings"]["Update"] = {
        publication_name: payload.publication_name,
        short_name: payload.short_name,
        tagline: payload.tagline,
        contact_email: payload.contact_email,
        timezone: payload.timezone,
        default_article_status: payload.default_article_status,
        comments_enabled: payload.comments_enabled,
      };
      const { error: legacyError } = await supabase
        .from("newsroom_settings")
        .update(legacy)
        .eq("id", true);
      if (legacyError) throw toAppError(legacyError);
      throw new Error(
        "Core settings saved, but SEO/integrations columns are missing. Apply supabase/migrations/20260718110000_newsroom_settings_module.sql.",
      );
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "settings.update",
    entity_type: "newsroom_settings",
    entity_id: "singleton",
    summary: "Newsroom settings updated",
    payload: { keys: Object.keys(payload) },
  });
  return { ok: true };
};

export const listAuditLogs = async () => {
  await requirePermission("settings:manage");
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("*, profiles(name, email)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/admin_audit_logs|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const listIpWhitelist = async () => {
  await requirePermission("settings:manage");
  const { data, error } = await supabase
    .from("admin_ip_whitelist")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (/admin_ip_whitelist|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const addIpWhitelistEntry = async ({
  data,
}: {
  data: { cidr: string; label?: string | null };
}) => {
  const { user } = await requirePermission("settings:manage");
  const cidr = data.cidr.trim();
  if (!cidr) throw new Error("Enter an IP address or CIDR range.");
  const { error } = await supabase.from("admin_ip_whitelist").insert({
    cidr,
    label: data.label?.trim() || null,
    created_by: user.id,
  });
  if (error) {
    if (/admin_ip_whitelist|schema cache|PGRST/i.test(error.message)) {
      throw new Error(
        "IP whitelist is not installed. Apply supabase/migrations/20260718110000_newsroom_settings_module.sql.",
      );
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "security.ip_whitelist.add",
    entity_type: "admin_ip_whitelist",
    summary: `Added IP rule ${cidr}`,
    payload: { cidr, label: data.label ?? null },
  });
  return { ok: true };
};

export const removeIpWhitelistEntry = async ({ data }: { data: { id: string } }) => {
  const { user } = await requirePermission("settings:manage");
  const { error } = await supabase.from("admin_ip_whitelist").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeAuditLog({
    actor_id: user.id,
    action: "security.ip_whitelist.remove",
    entity_type: "admin_ip_whitelist",
    entity_id: data.id,
    summary: "Removed IP whitelist entry",
  });
  return { ok: true };
};

export const listBackupRecords = async () => {
  await requirePermission("settings:manage");
  const { data, error } = await supabase
    .from("admin_backup_records")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (/admin_backup_records|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const recordBackupCheckpoint = async ({
  data,
}: {
  data: { label?: string; notes?: string | null; status?: "recorded" | "verified" | "failed" };
}) => {
  const { user } = await requirePermission("settings:manage");
  const { error } = await supabase.from("admin_backup_records").insert({
    label: data.label?.trim() || "Manual checkpoint",
    notes: data.notes?.trim() || null,
    status: data.status ?? "recorded",
    created_by: user.id,
  });
  if (error) {
    if (/admin_backup_records|schema cache|PGRST/i.test(error.message)) {
      throw new Error(
        "Backup records are not installed. Apply supabase/migrations/20260718110000_newsroom_settings_module.sql.",
      );
    }
    throw toAppError(error);
  }
  await writeAuditLog({
    actor_id: user.id,
    action: "security.backup.record",
    entity_type: "admin_backup_records",
    summary: data.label?.trim() || "Manual checkpoint",
  });
  return { ok: true };
};

export const getAdminSessionInfo = async () => {
  const { user } = await requirePermission("settings:manage");
  const { data } = await supabase.auth.getSession();
  return {
    userId: user.id,
    email: user.email ?? null,
    expiresAt: data.session?.expires_at
      ? new Date(data.session.expires_at * 1000).toISOString()
      : null,
    accessTokenPresent: !!data.session?.access_token,
  };
};
