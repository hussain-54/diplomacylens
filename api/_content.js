const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function siteOrigin(req) {
  const configured = process.env.SITE_URL || process.env.VITE_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

export function xml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function absolute(value, origin) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${origin}/${String(value).replace(/^\/+/, "")}`;
}

export function sameOrigin(value, origin) {
  try {
    return new URL(value, origin).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

async function rest(table, params) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables.");
  }
  const url = new URL(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function publishedArticles({ newsOnly = false, rssOnly = false } = {}) {
  const params = {
    select:
      "id,slug,title,deck,body,hero_image_url,published_at,updated_at,canonical_url,robots_index,rss_inclusion,hreflang,schema_type,author:profiles!articles_author_id_fkey(name,byline_name)",
    status: "eq.published",
    deleted_at: "is.null",
    robots_index: "eq.true",
    order: "published_at.desc",
    limit: newsOnly ? "1000" : "50000",
  };
  if (newsOnly) {
    params.published_at = `gte.${new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()}`;
  }
  if (rssOnly) params.rss_inclusion = "eq.true";
  return rest("articles", params);
}

/** Single published article for social/crawler previews. */
export async function articleBySlug(slug) {
  const rows = await rest("articles", {
    select:
      "slug,title,deck,hero_image_url,published_at,updated_at,seo_title,meta_description,focus_keyword,canonical_url,robots_index,robots_follow,schema_type,og_title,og_description,og_image_url,twitter_card,twitter_title,twitter_description,twitter_image_url,sections(name,slug),author:profiles!articles_author_id_fkey(name,byline_name)",
    slug: `eq.${slug}`,
    status: "eq.published",
    deleted_at: "is.null",
    limit: "1",
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Published, publicly-visible podcast episodes for the podcast RSS feed. */
export async function publishedPodcastEpisodes({ limit = 100 } = {}) {
  return rest("podcast_episodes", {
    select:
      "id,slug,title,short_description,description,audio_url,duration_seconds,file_size_bytes,artwork_url,category,host,published_at,updated_at",
    status: "eq.published",
    visibility: "in.(public,unlisted)",
    archived_at: "is.null",
    audio_url: "not.is.null",
    order: "published_at.desc",
    limit: String(limit),
  });
}

export async function publicSections() {
  return rest("sections", {
    select: "slug,name",
    visibility: "eq.public",
    order: "sort_order.asc",
    limit: "5000",
  });
}

export function bodyBlocks(body) {
  if (!body || !String(body).trim().startsWith("{")) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed.blocks) ? parsed.blocks : [];
  } catch {
    return [];
  }
}

export function bodyText(body) {
  const blocks = bodyBlocks(body);
  if (!blocks.length) return String(body || "");
  return blocks
    .map((block) => {
      if (["paragraph", "heading", "quote"].includes(block.type)) {
        return block.data?.text || "";
      }
      if (block.type === "live") {
        return `${block.data?.title || ""} ${block.data?.text || ""}`.trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function sendXml(res, body, maxAge = 900) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=86400`);
  res.status(200).send(body);
}

export function sendError(res, error) {
  console.error(error);
  res
    .status(500)
    .setHeader("Content-Type", "text/plain; charset=utf-8")
    .send("SEO feed generation failed.");
}
