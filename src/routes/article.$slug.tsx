import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { ArticleCard, BadgePill } from "@/components/article-card";
import { ArticleBody } from "@/components/article-body";
import { ShareButtons } from "@/components/share-buttons";
import {
  getArticle,
  getArticleComments,
  getPublicNewsroomSettings,
  reportArticleComment,
  submitArticleComment,
  trackArticleView,
} from "@/lib/content.functions";
import { formatDate } from "@/lib/format";
import { articleSeo, SITE_NAME } from "@/lib/seo";
import { articleReadingMinutes, articleWordCount } from "@/lib/article-scores";
import { articleExcerpt } from "@/lib/article-excerpt";
import { parseCmsExtras } from "@/lib/article-cms-extras";
import { extractHeadings, parseBody } from "@/lib/blocks";
import { SmartWidgetSlot } from "@/components/smart-widgets/public-renderer";

const qo = (slug: string) =>
  queryOptions({
    queryKey: ["article", slug],
    queryFn: () => getArticle({ data: { slug } }),
  });

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(qo(params.slug));
    if (!data.article) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const article = loaderData?.article;
    if (!article) return {};
    const seo = articleSeo(article);
    return {
      meta: [
        { title: seo.documentTitle },
        { name: "description", content: seo.description },
        { name: "robots", content: seo.robots },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: "en_US" },
        { property: "og:title", content: seo.ogTitle },
        { property: "og:description", content: seo.ogDescription },
        { property: "og:url", content: seo.canonical },
        ...(seo.image
          ? [
              { property: "og:image", content: seo.image },
              { property: "og:image:secure_url", content: seo.image },
              { property: "og:image:alt", content: article.title },
              { property: "og:image:type", content: seo.imageType },
              { property: "og:image:width", content: String(seo.imageWidth) },
              { property: "og:image:height", content: String(seo.imageHeight) },
            ]
          : []),
        ...(article.published_at
          ? [{ property: "article:published_time", content: article.published_at }]
          : []),
        { property: "article:modified_time", content: article.updated_at },
        ...(seo.sectionName ? [{ property: "article:section", content: seo.sectionName }] : []),
        ...(seo.authorName ? [{ property: "article:author", content: seo.authorName }] : []),
        { name: "twitter:card", content: seo.twitterCard },
        { name: "twitter:title", content: seo.twitterTitle },
        { name: "twitter:description", content: seo.twitterDescription },
        ...(seo.twitterImage
          ? [
              { name: "twitter:image", content: seo.twitterImage },
              { name: "twitter:image:alt", content: article.title },
            ]
          : []),
      ],
      links: [
        { rel: "canonical", href: seo.canonical },
        ...Object.entries(seo.hreflang).map(([hrefLang, href]) => ({
          rel: "alternate",
          hrefLang,
          href,
        })),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c"),
        },
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Article not found</h1>
        <p className="mt-3 text-muted-foreground">This story may have been unpublished.</p>
        <Link to="/" className="mt-6 inline-block text-crimson underline">
          Return home
        </Link>
      </div>
    </SiteShell>
  ),
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(qo(slug));
  const a = data.article!;
  useEffect(() => {
    const key = `viewed:${a.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void trackArticleView({ data: { articleId: a.id } });
  }, [a.id]);

  const shareUrl = useMemo(() => articleSeo(a).canonical, [a]);
  const summary = useMemo(() => articleExcerpt(a), [a]);
  const extras = useMemo(() => parseCmsExtras(a.cms_extras), [a.cms_extras]);
  const headings = useMemo(() => extractHeadings(parseBody(a.body)), [a.body]);
  const readingMinutes = useMemo(
    () => articleReadingMinutes(articleWordCount(a.body, a.deck)),
    [a.body, a.deck],
  );
  const tags = (a.article_tags ?? [])
    .map((row) => row.tags)
    .filter((tag): tag is { name: string; slug: string } => !!tag);
  const wasUpdated =
    !!a.updated_at &&
    !!a.published_at &&
    new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 60 * 60 * 1000;
  const heroCaption = extras.media?.caption?.trim();
  const heroCredit = extras.media?.credit?.trim();
  const galleryImages = (
    (
      a as {
        article_images?: Array<{
          id: string;
          image_url: string;
          caption: string | null;
          alt_text: string | null;
          display_order: number;
          is_featured: boolean;
        }>;
      }
    ).article_images ??
    (extras.media?.gallery ?? []).map((item, index) => ({
      id: `extra-${index}`,
      image_url: item.url,
      caption: item.caption ?? null,
      alt_text: item.alt ?? null,
      display_order: item.display_order ?? index,
      is_featured: Boolean(item.is_featured),
    }))
  )
    .filter((img) => img.image_url && img.image_url !== a.hero_image_url)
    .sort((x, y) => x.display_order - y.display_order);

  return (
    <SiteShell>
      <article className="article-page">
        <div className="mx-auto max-w-[45rem] px-4 pt-6 sm:pt-10">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Link to="/" className="hover:text-crimson">
              Home
            </Link>
            {a.sections && (
              <>
                <span aria-hidden>/</span>
                <Link
                  to="/section/$slug"
                  params={{ slug: a.sections.slug }}
                  className="hover:text-crimson"
                >
                  {a.sections.name}
                </Link>
              </>
            )}
          </nav>

          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            {a.sections && (
              <Link
                to="/section/$slug"
                params={{ slug: a.sections.slug }}
                className="eyebrow text-crimson hover:underline"
              >
                {a.sections.name}
              </Link>
            )}
            <BadgePill type={a.badge_type} />
            {a.region && <span className="eyebrow text-muted-foreground">{a.region}</span>}
          </div>

          <h1 className="article-headline">{a.title}</h1>
          {summary ? <p className="article-deck">{summary}</p> : null}

          {a.hero_image_url && (
            <figure className="article-hero mt-5 sm:mt-6">
              <img
                src={a.hero_image_url}
                alt={extras.media?.alt_text?.trim() || a.title}
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
                className="article-hero-img rounded-xl object-contain"
              />
              {(heroCaption || heroCredit) && (
                <figcaption className="article-hero-caption">
                  {heroCaption}
                  {heroCaption && heroCredit ? " " : null}
                  {heroCredit ? (
                    <span className="uppercase tracking-wide">{heroCredit}</span>
                  ) : null}
                </figcaption>
              )}
            </figure>
          )}

          <div className="mt-5 flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <time dateTime={a.published_at ?? undefined}>{formatDate(a.published_at)}</time>
                {wasUpdated && (
                  <span>
                    · Updated <time dateTime={a.updated_at}>{formatDate(a.updated_at)}</time>
                  </span>
                )}
                <span>· {readingMinutes} min read</span>
              </div>
            </div>
            <div className="article-share-inline">
              <ShareButtons title={a.title} url={shareUrl} summary={summary} />
            </div>
          </div>
        </div>

        <div className="article-share-bar sm:hidden" aria-label="Share">
          <ShareButtons title={a.title} url={shareUrl} summary={summary} />
        </div>

        <div className="mx-auto max-w-[45rem] px-4 pb-24 sm:pb-12">
          {headings.length >= 3 && (
            <nav
              aria-label="Table of contents"
              className="mt-8 border border-border bg-secondary/60 p-4 sm:p-5"
            >
              <div className="eyebrow text-crimson">In this article</div>
              <ol className="mt-3 space-y-2 text-sm">
                {headings.map((heading, index) => (
                  <li key={`${heading.id}-${index}`} className={heading.level === 3 ? "pl-4" : ""}>
                    <a
                      href={`#${heading.id}`}
                      className="text-navy hover:text-crimson hover:underline"
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <ArticleBody body={a.body} />

          <SmartWidgetSlot
            pageType="article"
            slotKey="sidebar"
            className="mt-8"
            context={{ categorySlug: a.sections?.slug ?? null }}
          />

          {galleryImages.length > 0 ? (
            <section className="mt-10" aria-label="Article gallery">
              <div className="eyebrow mb-4 text-muted-foreground">Gallery</div>
              <div className="grid gap-6 sm:grid-cols-2">
                {galleryImages.map((img) => (
                  <figure key={img.id} className="overflow-hidden">
                    <img
                      src={img.image_url}
                      alt={img.alt_text || a.title}
                      width={1200}
                      height={800}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full rounded-xl bg-muted object-contain"
                    />
                    {img.caption ? (
                      <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">
                        {img.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-10 border-t border-border pt-6">
            <div className="eyebrow mb-3 text-muted-foreground">Share this story</div>
            <ShareButtons title={a.title} url={shareUrl} summary={summary} variant="full" />
          </div>

          {tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-5">
              <span className="eyebrow text-muted-foreground">Topics</span>
              {tags.map((tag) => (
                <Link
                  key={tag.slug}
                  to="/search"
                  search={{ q: tag.name, page: 1 }}
                  className="border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-ink hover:border-crimson hover:text-crimson"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </article>

      <section className="border-t border-border bg-navy">
        <div className="mx-auto flex max-w-[45rem] flex-col items-start gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="eyebrow text-crimson">Stay informed</div>
            <h2 className="mt-1 font-serif text-2xl text-navy-foreground">
              Get diplomacy briefings in your inbox
            </h2>
          </div>
          <Link
            to="/newsletter"
            className="shrink-0 bg-crimson px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90"
          >
            Subscribe free
          </Link>
        </div>
      </section>

      {data.related.length > 0 && (
        <section className="border-t border-border bg-secondary">
          <div className="mx-auto max-w-[1400px] px-4 py-12">
            <h2 className="rule-top mb-6 pt-3 font-serif text-2xl text-ink">Related coverage</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {data.related.map((r) => (
                <ArticleCard key={r.id} article={r} size="md" />
              ))}
            </div>
          </div>
        </section>
      )}
      <CommentsSection articleId={a.id} />
    </SiteShell>
  );
}

function CommentsSection({ articleId }: { articleId: string }) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["public-newsroom-settings"],
    queryFn: getPublicNewsroomSettings,
  });
  const comments = useQuery({
    queryKey: ["article-comments", articleId],
    queryFn: () => getArticleComments({ data: { articleId } }),
  });
  const [form, setForm] = useState({ authorName: "", authorEmail: "", body: "" });
  const [submitted, setSubmitted] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const submit = useMutation({
    mutationFn: () => submitArticleComment({ data: { articleId, ...form } }),
    onSuccess: async () => {
      setSubmitted(true);
      setForm({ authorName: "", authorEmail: "", body: "" });
      await queryClient.invalidateQueries({ queryKey: ["article-comments", articleId] });
    },
  });
  const report = useMutation({
    mutationFn: (value: { commentId: string; reason: string }) =>
      reportArticleComment({ data: value }),
    onSuccess: (_data, vars) => {
      setReportedIds((prev) => new Set(prev).add(vars.commentId));
    },
  });

  if (settings.data?.comments_enabled === false) return null;

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="eyebrow text-crimson">Reader discussion</div>
          <h2 className="mt-2 font-serif text-3xl text-ink">Comments</h2>
          <div className="mt-6 divide-y divide-border">
            {comments.isLoading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading comments…</p>
            ) : !comments.data?.length ? (
              <p className="py-6 text-sm text-muted-foreground">No published comments yet.</p>
            ) : (
              comments.data.map((comment) => (
                <article key={comment.id} className="py-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm font-semibold text-ink">{comment.author_name}</div>
                    <time className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {comment.body}
                  </p>
                  <div className="mt-2">
                    {reportedIds.has(comment.id) ? (
                      <span className="text-xs text-muted-foreground">
                        Thanks — report received.
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-crimson hover:underline"
                        disabled={report.isPending}
                        onClick={() => {
                          const reason = window.prompt(
                            "Why are you reporting this comment? (spam, abuse, off-topic…)",
                          );
                          if (!reason || reason.trim().length < 3) return;
                          report.mutate({ commentId: comment.id, reason: reason.trim() });
                        }}
                      >
                        Report
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
          {report.error ? (
            <p className="mt-3 text-xs text-crimson">{report.error.message}</p>
          ) : null}
        </div>
        <div className="border border-border bg-card p-5">
          <h3 className="font-sans text-sm font-semibold text-foreground">Join the discussion</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Comments are reviewed before publication.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(false);
              submit.mutate();
            }}
          >
            <input
              required
              minLength={2}
              maxLength={80}
              value={form.authorName}
              onChange={(event) => setForm({ ...form, authorName: event.target.value })}
              placeholder="Name"
              className="h-10 w-full border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <input
              required
              type="email"
              value={form.authorEmail}
              onChange={(event) => setForm({ ...form, authorEmail: event.target.value })}
              placeholder="Email (not published)"
              className="h-10 w-full border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <textarea
              required
              minLength={2}
              maxLength={4000}
              rows={5}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="Write a thoughtful comment"
              className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={submit.isPending}
              className="h-10 w-full bg-navy text-xs font-semibold uppercase tracking-widest text-navy-foreground disabled:opacity-50"
            >
              {submit.isPending ? "Submitting…" : "Submit comment"}
            </button>
            {submitted && (
              <p className="text-xs text-cat-green">Comment submitted for editorial review.</p>
            )}
            {submit.error && <p className="text-xs text-crimson">{submit.error.message}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
