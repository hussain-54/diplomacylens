import { Link } from "@tanstack/react-router";
import { timeAgo } from "@/lib/format";
import { articleExcerpt } from "@/lib/article-excerpt";
import { articleReadingMinutes, articleWordCount } from "@/lib/article-scores";

type Badge = "none" | "breaking" | "live" | "exclusive" | "opinion" | "premium" | "alert";

export function BadgePill({ type }: { type: Badge }) {
  if (!type || type === "none") return null;
  const styles: Record<string, string> = {
    breaking: "bg-crimson text-crimson-foreground",
    live: "bg-crimson text-crimson-foreground live-dot",
    alert: "bg-crimson text-crimson-foreground",
    exclusive: "bg-navy text-navy-foreground",
    opinion: "bg-gold text-gold-foreground",
    premium: "bg-gold text-gold-foreground",
  };
  const label: Record<string, string> = {
    breaking: "Breaking",
    live: "Live",
    alert: "Alert",
    exclusive: "Exclusive",
    opinion: "Opinion",
    premium: "Premium",
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${styles[type]}`}
    >
      {label[type]}
    </span>
  );
}

export interface ArticleCardArticle {
  slug: string;
  title: string;
  deck?: string | null;
  meta_description?: string | null;
  hero_image_url?: string | null;
  badge_type: Badge;
  region?: string | null;
  published_at?: string | null;
  body?: string | null;
  publisher_name?: string | null;
  author?: { name?: string | null; byline_name?: string | null } | null;
  sections?: { name?: string | null; slug?: string | null } | null;
}

export function ArticleCard({
  article,
  size = "md",
}: {
  article: ArticleCardArticle;
  size?: "sm" | "md" | "lg";
}) {
  const titleClass =
    size === "lg"
      ? "text-2xl sm:text-3xl md:text-4xl"
      : size === "sm"
        ? "text-[15px] leading-snug md:text-base"
        : "text-lg leading-snug md:text-xl";
  const summary = articleExcerpt(article, size === "sm" ? 90 : 160);
  const readingMinutes =
    size !== "sm" && (article.body || article.deck)
      ? articleReadingMinutes(articleWordCount(article.body, article.deck))
      : null;
  const sectionName = article.sections?.name;

  return (
    <Link
      to="/article/$slug"
      params={{ slug: article.slug }}
      className="group flex h-full flex-col rounded-sm transition-all duration-300 md:hover:-translate-y-0.5 md:hover:shadow-md"
    >
      <div className="mb-2.5 aspect-[16/9] overflow-hidden bg-muted md:mb-3">
        {article.hero_image_url ? (
          <img
            src={article.hero_image_url}
            alt=""
            width={800}
            height={450}
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 92vw, (max-width: 1200px) 45vw, 320px"
            className="h-full w-full object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sectionName ? <span className="eyebrow text-crimson">{sectionName}</span> : null}
        <BadgePill type={article.badge_type} />
        {article.region && !sectionName ? (
          <span className="eyebrow text-muted-foreground">{article.region}</span>
        ) : null}
      </div>
      <h3
        className={`headline-serif mt-1.5 md:mt-2 ${titleClass} transition-colors group-hover:text-crimson`}
      >
        {article.title}
      </h3>
      {summary ? (
        <p
          className={`mt-1.5 text-sm leading-relaxed text-muted-foreground md:mt-2 ${
            size === "sm" ? "line-clamp-2" : "line-clamp-2 md:line-clamp-3"
          }`}
        >
          {summary}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-2 text-[11px] text-muted-foreground md:pt-2.5 md:text-xs">
        <time dateTime={article.published_at ?? undefined}>{timeAgo(article.published_at)}</time>
        {readingMinutes ? (
          <>
            <span aria-hidden>·</span>
            <span>{readingMinutes} min read</span>
          </>
        ) : null}
      </div>
    </Link>
  );
}
