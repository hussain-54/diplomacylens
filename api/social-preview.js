import { absolute, articleBySlug, siteOrigin, xml } from "./_content.js";

// The site is a client-rendered SPA, so social crawlers never run the
// JavaScript that sets per-article meta tags. Vercel rewrites crawler
// requests for /article/:slug here; this handler returns a static document
// with absolute Open Graph / Twitter / JSON-LD metadata.

const SITE_NAME = "Diplomacy Lens";
const DEFAULT_DESCRIPTION =
  "Independent reporting and analysis on diplomacy, geopolitics, embassies, and international affairs.";
const DEFAULT_IMAGE = "/images/hero-unsc.jpg";
/** WhatsApp / Facebook prefer ~1.91:1; advertise 1200×630 for custom heroes. */
const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 630;
const DEFAULT_IMAGE_WIDTH = 1600;
const DEFAULT_IMAGE_HEIGHT = 900;

const first = (value) => (Array.isArray(value) ? value[0] : value);

const clamp = (value, max) => {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

function renderDocument({ meta, jsonLd, headline, canonical, description }) {
  const tags = meta
    .filter(([, content]) => content !== undefined && content !== null && content !== "")
    .map(([key, content]) => {
      const attribute = key.startsWith("og:") || key.startsWith("article:") ? "property" : "name";
      return `    <meta ${attribute}="${xml(key)}" content="${xml(String(content))}" />`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${xml(headline)}</title>
${tags}
    <link rel="canonical" href="${xml(canonical)}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
  </head>
  <body>
    <article>
      <h1>${xml(headline)}</h1>
      ${description ? `<p>${xml(description)}</p>` : ""}
      <p><a href="${xml(canonical)}">Read the full story on ${xml(SITE_NAME)}</a></p>
    </article>
  </body>
</html>
`;
}

export default async function handler(req, res) {
  const origin = siteOrigin(req);
  const url = new URL(req.url, origin);
  const slug = (url.searchParams.get("slug") || "").trim();

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Short CDN TTL so image/title updates appear in share cards quickly.
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=3600");

  let article = null;
  if (slug) {
    try {
      article = await articleBySlug(slug);
    } catch (error) {
      console.error("Social preview lookup failed", error);
    }
  }

  if (!article) {
    const image = absolute(DEFAULT_IMAGE, origin);
    res.status(slug ? 404 : 200).send(
      renderDocument({
        headline: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        canonical: origin,
        meta: [
          ["description", DEFAULT_DESCRIPTION],
          ["robots", "noindex,follow"],
          ["og:site_name", SITE_NAME],
          ["og:type", "website"],
          ["og:title", SITE_NAME],
          ["og:description", DEFAULT_DESCRIPTION],
          ["og:url", origin],
          ["og:image", image],
          ["og:image:secure_url", image],
          ["og:image:type", "image/jpeg"],
          ["og:image:width", DEFAULT_IMAGE_WIDTH],
          ["og:image:height", DEFAULT_IMAGE_HEIGHT],
          ["og:image:alt", SITE_NAME],
          ["twitter:card", "summary_large_image"],
          ["twitter:title", SITE_NAME],
          ["twitter:description", DEFAULT_DESCRIPTION],
          ["twitter:image", image],
        ],
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: origin,
        },
      }),
    );
    return;
  }

  const section = first(article.sections);
  const title = (article.seo_title || "").trim() || article.title;
  // Prefer deck (public standfirst), then SEO meta — same order as articleExcerpt.
  const description = clamp(
    (article.deck || "").trim() || (article.meta_description || "").trim() || DEFAULT_DESCRIPTION,
    200,
  );
  const canonical = absolute(
    (article.canonical_url || "").trim() || `/article/${article.slug}`,
    origin,
  );
  // Prefer explicit social image, then featured hero, then site default.
  // Always absolute HTTPS — scrapers reject relative URLs.
  const rawImage = article.og_image_url || article.hero_image_url || DEFAULT_IMAGE;
  const image = absolute(rawImage, origin);
  const isDefaultImage =
    rawImage === DEFAULT_IMAGE || String(rawImage).endsWith("/images/hero-unsc.jpg");
  const imageWidth = isDefaultImage ? DEFAULT_IMAGE_WIDTH : SHARE_IMAGE_WIDTH;
  const imageHeight = isDefaultImage ? DEFAULT_IMAGE_HEIGHT : SHARE_IMAGE_HEIGHT;
  const imageType = (() => {
    const path = String(image).split("?")[0].toLowerCase();
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  })();
  const ogTitle = (article.og_title || "").trim() || title;
  const ogDescription = (article.og_description || "").trim() || description;
  const twitterImage = article.twitter_image_url
    ? absolute(article.twitter_image_url, origin)
    : image;
  const schemaType = ["NewsArticle", "Article", "Review", "Report"].includes(article.schema_type)
    ? article.schema_type
    : "NewsArticle";

  const meta = [
    ["description", description],
    [
      "robots",
      `${article.robots_index === false ? "noindex" : "index"},${article.robots_follow === false ? "nofollow" : "follow"}`,
    ],
    ["og:site_name", SITE_NAME],
    ["og:locale", "en_US"],
    ["og:type", "article"],
    ["og:title", ogTitle],
    ["og:description", ogDescription],
    ["og:url", canonical],
    ["og:image", image],
    ["og:image:secure_url", image],
    ["og:image:type", imageType],
    ["og:image:width", imageWidth],
    ["og:image:height", imageHeight],
    ["og:image:alt", article.title],
    ["article:published_time", article.published_at],
    ["article:modified_time", article.updated_at],
    ["article:section", section?.name],
    ["twitter:card", article.twitter_card === "summary" ? "summary" : "summary_large_image"],
    ["twitter:title", (article.twitter_title || "").trim() || ogTitle],
    ["twitter:description", (article.twitter_description || "").trim() || ogDescription],
    ["twitter:image", twitterImage],
    ["twitter:image:alt", article.title],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    headline: title,
    description,
    image: [
      {
        "@type": "ImageObject",
        url: image,
        width: imageWidth,
        height: imageHeight,
      },
    ],
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    dateModified: article.updated_at,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
      logo: { "@type": "ImageObject", url: absolute("/images/diplomacy-lens-logo.png", origin) },
    },
    ...(section?.name ? { articleSection: section.name } : {}),
    ...(article.focus_keyword ? { keywords: article.focus_keyword } : {}),
    url: canonical,
  };

  res.status(200).send(
    renderDocument({
      meta,
      jsonLd,
      headline: article.title,
      description,
      canonical,
    }),
  );
}
