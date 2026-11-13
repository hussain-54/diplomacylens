import { supabase } from "@/integrations/supabase/client";
import { scanCommentContent } from "@/lib/comment-moderation";
import { toAppError } from "@/lib/db-errors";
import { PUBLISHER_PROFILE_SELECT, PUBLISHER_PROFILE_SELECT_MIN } from "@/lib/publisher";

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await run();
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

async function getPublishedEpaperRows(limit: number) {
  const filtered = await supabase
    .from("epaper_editions")
    .select("*")
    .eq("status", "published")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!filtered.error) return filtered.data ?? [];
  // Pre-migration DBs may not have status/archived_at columns yet — fall back gracefully.
  if (/schema cache|PGRST|column|status|archived_at/i.test(filtered.error.message)) {
    return safeSelect(() =>
      supabase
        .from("epaper_editions")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(limit),
    );
  }
  throw toAppError(filtered.error);
}

async function getPublishedMediaRows(
  table: "podcast_episodes" | "infographics" | "videos",
  limit: number,
) {
  // Status/archived_at land with the CMS upgrade migration; cast until types regenerate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const filtered = await client
    .from(table)
    .select("*")
    .eq("status", "published")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!filtered.error) return filtered.data ?? [];
  if (/schema cache|PGRST|column|status|archived_at/i.test(filtered.error.message)) {
    return safeSelect(() =>
      supabase.from(table).select("*").order("published_at", { ascending: false }).limit(limit),
    );
  }
  throw toAppError(filtered.error);
}

export const getHomeData = async () => {
  const [articles, war, ambassadors, embassies, videos, sections, epaper, podcasts, infographics] =
    await Promise.all([
      supabase
        .from("articles")
        .select(
          `id,slug,title,deck,meta_description,hero_image_url,badge_type,published_at,region,section_id,is_featured,body, author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT_MIN}), sections(name,slug)`,
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(48),
      supabase
        .from("war_monitor_items")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase.from("ambassadors").select("*").order("featured", { ascending: false }).limit(6),
      supabase.from("embassies").select("*").order("updated_at", { ascending: false }).limit(6),
      getPublishedMediaRows("videos", 8),
      getSections(),
      getPublishedEpaperRows(8),
      getPublishedMediaRows("podcast_episodes", 8),
      getPublishedMediaRows("infographics", 8),
    ]);
  for (const res of [articles, war, ambassadors, embassies]) {
    if (res.error) throw toAppError(res.error);
  }

  return {
    articles: articles.data ?? [],
    war: war.data ?? [],
    ambassadors: ambassadors.data ?? [],
    embassies: embassies.data ?? [],
    videos,
    sections,
    epaper,
    podcasts,
    infographics,
  };
};

export const getEpaperEditions = async () => getPublishedEpaperRows(40);

export const getPodcastEpisodes = async () => getPublishedMediaRows("podcast_episodes", 40);

export const getInfographics = async () => getPublishedMediaRows("infographics", 40);

export const getSections = async ({ includeHidden = false }: { includeHidden?: boolean } = {}) => {
  let query = supabase.from("sections").select("*").order("sort_order").order("name");
  if (!includeHidden) query = query.eq("visibility", "public");
  const { data, error } = await query;
  if (error) {
    // Before taxonomy migration, visibility column may be missing.
    if (/visibility|schema cache|PGRST/i.test(error.message) && !includeHidden) {
      const fallback = await supabase.from("sections").select("*").order("sort_order");
      if (fallback.error) throw toAppError(fallback.error);
      return fallback.data ?? [];
    }
    throw toAppError(error);
  }
  return data ?? [];
};

export const getTicker = async () => {
  const { data, error } = await supabase
    .from("ticker_items")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const getSectionWithArticles = async ({ data }: { data: { slug: string } }) => {
  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("*")
    .eq("slug", data.slug)
    .maybeSingle();
  if (sectionError) throw toAppError(sectionError);
  if (!section) return { section: null, articles: [] };
  if (section.visibility === "hidden") return { section: null, articles: [] };
  const { data: articles, error } = await supabase
    .from("articles")
    .select(
      `id,slug,title,deck,meta_description,hero_image_url,badge_type,published_at,region, author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT_MIN}), sections(name,slug)`,
    )
    .eq("section_id", section.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(40);
  if (error) throw toAppError(error);
  return { section, articles: articles ?? [] };
};

export const getArticle = async ({ data }: { data: { slug: string } }) => {
  const { data: article, error } = await supabase
    .from("articles")
    .select(
      `*, sections(slug,name,color), author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT}), article_tags(tags(name,slug)), article_images(id,image_url,caption,alt_text,display_order,is_featured)`,
    )
    .eq("slug", data.slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    // Older DBs without article_images — fall back without gallery join.
    if (/article_images|schema cache|PGRST/i.test(error.message)) {
      const fallback = await supabase
        .from("articles")
        .select(
          `*, sections(slug,name,color), author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT}), article_tags(tags(name,slug))`,
        )
        .eq("slug", data.slug)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();
      if (fallback.error) throw toAppError(fallback.error);
      if (!fallback.data) return { article: null, related: [] };
      return loadRelated(fallback.data);
    }
    throw toAppError(error);
  }
  if (!article) return { article: null, related: [] };
  return loadRelated(article);
};

async function loadRelated<T extends { id: string; section_id?: string | null }>(article: T) {
  const q = supabase
    .from("articles")
    .select(
      `id,slug,title,deck,meta_description,hero_image_url,badge_type,published_at, author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT_MIN}), sections(name,slug)`,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("id", article.id);
  const relatedRes = article.section_id
    ? await q
        .eq("section_id", article.section_id)
        .order("published_at", { ascending: false })
        .limit(4)
    : await q.order("published_at", { ascending: false }).limit(4);
  if (relatedRes.error) throw toAppError(relatedRes.error);
  return { article, related: relatedRes.data ?? [] };
}

export const getAllAmbassadors = async () => {
  const { data, error } = await supabase
    .from("ambassadors")
    .select("*")
    .order("featured", { ascending: false });
  if (error) throw toAppError(error);
  return data ?? [];
};

export const getAmbassador = async ({ data }: { data: { id: string } }) => {
  const { data: amb, error } = await supabase
    .from("ambassadors")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();
  if (error) throw toAppError(error);
  return amb;
};

export const getAllEmbassies = async () => {
  const { data, error } = await supabase
    .from("embassies")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw toAppError(error);
  return data ?? [];
};

export const getEmbassy = async ({ data }: { data: { id: string } }) => {
  const { data: emb, error } = await supabase
    .from("embassies")
    .select("*, ambassadors(*)")
    .eq("id", data.id)
    .maybeSingle();
  if (error) throw toAppError(error);
  return emb;
};

export const getAllVideos = async () => getPublishedMediaRows("videos", 200);

export const getLatestArticles = async () => {
  const { data, error } = await supabase
    .from("articles")
    .select(
      `id,slug,title,deck,meta_description,hero_image_url,badge_type,published_at,region,section_id, author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT_MIN}), sections(name,slug)`,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(60);
  if (error) throw toAppError(error);
  return data ?? [];
};

const SEARCH_PAGE_SIZE = 20;

export const searchArticles = async ({ data }: { data: { query: string; page?: number } }) => {
  const query = data.query.trim();
  if (!query) return { articles: [], total: 0, pageSize: SEARCH_PAGE_SIZE };
  const page = Math.max(1, data.page ?? 1);
  const from = (page - 1) * SEARCH_PAGE_SIZE;
  // Escape PostgREST pattern characters so user input is treated literally.
  const pattern = `%${query.replace(/[%_\\]/g, (m) => `\\${m}`).replace(/[(),]/g, " ")}%`;
  const {
    data: articles,
    error,
    count,
  } = await supabase
    .from("articles")
    .select(
      `id,slug,title,deck,meta_description,hero_image_url,badge_type,published_at,region,section_id, author:profiles!articles_author_id_fkey(${PUBLISHER_PROFILE_SELECT_MIN}), sections(name,slug)`,
      { count: "exact" },
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .or(`title.ilike.${pattern},deck.ilike.${pattern},meta_description.ilike.${pattern}`)
    .order("published_at", { ascending: false })
    .range(from, from + SEARCH_PAGE_SIZE - 1);
  if (error) throw toAppError(error);
  return { articles: articles ?? [], total: count ?? 0, pageSize: SEARCH_PAGE_SIZE };
};

export const trackArticleView = async ({ data }: { data: { articleId: string } }) => {
  const { error } = await supabase.rpc("increment_article_view", {
    p_article_id: data.articleId,
  });
  if (error && !/increment_article_view|schema cache|PGRST/i.test(error.message)) {
    console.error("Article view tracking failed", error);
  }
  return { ok: !error };
};

export const getArticleComments = async ({ data }: { data: { articleId: string } }) => {
  const { data: comments, error } = await supabase
    .from("comments")
    .select("id,author_name,body,created_at")
    .eq("article_id", data.articleId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw toAppError(error);
  return comments ?? [];
};

export const submitArticleComment = async ({
  data,
}: {
  data: { articleId: string; authorName: string; authorEmail: string; body: string };
}) => {
  const author_name = data.authorName.trim();
  const author_email = data.authorEmail.trim().toLowerCase();
  const body = data.body.trim();
  if (author_name.length < 2 || author_name.length > 80) {
    throw new Error("Name must be between 2 and 80 characters.");
  }
  if (author_email.length < 5 || author_email.length > 254 || !author_email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingsRow } = await (supabase as any)
    .from("comment_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const minLen = Math.max(1, Number(settingsRow?.min_length) || 2);
  const maxLen = Math.max(minLen, Number(settingsRow?.max_length) || 4000);
  if (body.length < minLen || body.length > maxLen) {
    throw new Error(`Comment must be between ${minLen} and ${maxLen} characters.`);
  }

  const { data: blocked } = await supabase
    .from("comment_blocks")
    .select("id")
    .eq("email", author_email)
    .maybeSingle();
  if (blocked) {
    throw new Error("This email address is blocked from commenting.");
  }

  const scan = scanCommentContent(
    { body, authorName: author_name, authorEmail: author_email },
    {
      max_links: Number(settingsRow?.max_links) || 3,
      auto_flag_profanity: settingsRow?.auto_flag_profanity !== false,
      auto_spam_phrases: settingsRow?.auto_spam_phrases !== false,
      banned_words: Array.isArray(settingsRow?.banned_words) ? settingsRow.banned_words : [],
    },
  );

  // require_approval keeps non-spam submissions pending unless already flagged/spam by rules
  let status: "pending" | "approved" | "spam" | "flagged" = scan.status;
  if (settingsRow?.require_approval === false && status === "pending") {
    status = "approved";
  }

  const payload = {
    article_id: data.articleId,
    author_name,
    author_email,
    body,
    status,
    auto_flags: scan.flags,
    moderation_note: scan.note,
  };

  const { error } = await supabase.from("comments").insert(payload);
  if (error) {
    if (
      /auto_flags|moderation_note|flagged|comment_blocks|schema cache|PGRST/i.test(error.message)
    ) {
      const fallbackStatus = scan.status === "flagged" ? "pending" : scan.status;
      const { error: fallbackError } = await supabase.from("comments").insert({
        article_id: data.articleId,
        author_name,
        author_email,
        body,
        status: fallbackStatus === "spam" ? "spam" : "pending",
      });
      if (fallbackError) {
        if (/blocked from commenting/i.test(fallbackError.message)) {
          throw new Error("This email address is blocked from commenting.");
        }
        throw toAppError(fallbackError);
      }
      return { ok: true, status: fallbackStatus === "spam" ? "spam" : "pending", auto: scan.flags };
    }
    if (/blocked from commenting/i.test(error.message)) {
      throw new Error("This email address is blocked from commenting.");
    }
    throw toAppError(error);
  }
  return { ok: true, status: scan.status, auto: scan.flags };
};

export const reportArticleComment = async ({
  data,
}: {
  data: {
    commentId: string;
    reason: string;
    reporterName?: string;
    reporterEmail?: string;
  };
}) => {
  const reason = data.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new Error("Report reason must be between 3 and 500 characters.");
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id,status")
    .eq("id", data.commentId)
    .maybeSingle();
  if (commentError) throw toAppError(commentError);
  if (!comment || comment.status !== "approved") {
    throw new Error("Only published comments can be reported.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("comment_reports").insert({
    comment_id: data.commentId,
    reason,
    reporter_name: data.reporterName?.trim() || null,
    reporter_email: data.reporterEmail?.trim().toLowerCase() || null,
    status: "open",
  });
  if (error) {
    if (/comment_reports|schema cache|PGRST/i.test(error.message)) {
      throw new Error("Comment reporting is not available until the migration is applied.");
    }
    throw toAppError(error);
  }

  // Flag the comment for moderator attention (best-effort).
  await supabase
    .from("comments")
    .update({
      status: "flagged",
      moderation_note: `Reported by reader: ${reason.slice(0, 200)}`,
    })
    .eq("id", data.commentId)
    .eq("status", "approved");

  return { ok: true };
};

export const getPublicNewsroomSettings = async () => {
  const { data, error } = await supabase
    .from("newsroom_settings")
    .select("publication_name,short_name,tagline,comments_enabled")
    .eq("id", true)
    .maybeSingle();
  if (error && !/newsroom_settings|schema cache|PGRST/i.test(error.message))
    throw toAppError(error);
  return data;
};
