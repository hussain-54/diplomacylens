import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Download, ImageIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { SiteShell } from "@/components/site-shell";
import { InfographicViewer } from "@/components/infographics/infographic-viewer";
import { ShareButtons } from "@/components/share-buttons";
import { formatDate, timeAgo } from "@/lib/format";
import {
  getPublicInfographicBySlug,
  getRelatedInfographics,
  infographicSeo,
  trackInfographicEvent,
} from "@/lib/infographics.functions";
import { SITE_NAME } from "@/lib/seo";
import { cmsGhostButton } from "@/components/cms-ui";

const qo = (slug: string) =>
  queryOptions({
    queryKey: ["public-infographic", slug],
    queryFn: () => getPublicInfographicBySlug(slug),
  });

export const Route = createFileRoute("/infographics/$slug")({
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(qo(params.slug));
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => {
    const item = loaderData?.item;
    if (!item) return {};
    const seo = infographicSeo(item);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:title", content: seo.ogTitle },
        { property: "og:description", content: seo.ogDescription },
        { property: "og:url", content: seo.canonical },
        { property: "og:image", content: seo.ogImage },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.ogTitle },
        { name: "twitter:description", content: seo.ogDescription },
        { name: "twitter:image", content: seo.ogImage },
      ],
      links: [{ rel: "canonical", href: seo.canonical }],
    };
  },
  component: InfographicDetailPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Infographic not found</h1>
        <p className="mt-3 text-muted-foreground">
          This infographic may have been unpublished or archived.
        </p>
        <Link to="/infographics" className="mt-6 inline-block text-crimson underline">
          Browse all infographics
        </Link>
      </div>
    </SiteShell>
  ),
});

function InfographicDetailPage() {
  const { slug } = Route.useParams();
  const { data: infographic } = useSuspenseQuery(qo(slug));
  const item = infographic!;

  const relatedQ = useQuery({
    queryKey: ["public-infographics-related", item.id],
    queryFn: () => getRelatedInfographics(item.id, 4),
  });

  useEffect(() => {
    const key = `infographic-viewed:${item.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void trackInfographicEvent({
      data: { infographic_id: item.id, event_type: "infographic_opened" },
    });
  }, [item.id]);

  const shareUrl = useMemo(() => infographicSeo(item).canonical, [item]);
  const asset = item.asset_url || item.source_url || item.cover_image_url;

  return (
    <SiteShell>
      <section className="mx-auto max-w-[1200px] px-4 py-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-crimson">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link to="/infographics" className="hover:text-crimson">
            Infographics
          </Link>
        </nav>

        <div className="flex flex-col gap-2">
          {item.category ? <p className="eyebrow text-crimson">{item.category}</p> : null}
          <h1 className="font-serif text-3xl font-bold text-ink md:text-4xl">{item.title}</h1>
          {item.subtitle ? (
            <p className="max-w-3xl text-lg text-muted-foreground">{item.subtitle}</p>
          ) : null}
          {item.description ? (
            <p className="max-w-3xl text-muted-foreground">{item.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={item.published_at ?? undefined}>{formatDate(item.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{timeAgo(item.published_at)}</span>
            {item.author_name ? (
              <>
                <span aria-hidden>·</span>
                <span>By {item.author_name}</span>
              </>
            ) : null}
            {item.width && item.height ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {item.width}×{item.height}px
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ShareButtons
            title={item.title}
            url={shareUrl}
            summary={item.description}
            variant="full"
          />
          {asset && item.allow_download ? (
            <a
              href={asset}
              download
              target="_blank"
              rel="noreferrer"
              className={cmsGhostButton}
              onClick={() =>
                void trackInfographicEvent({
                  data: { infographic_id: item.id, event_type: "infographic_downloaded" },
                })
              }
            >
              <Download className="h-4 w-4" /> Download
            </a>
          ) : null}
        </div>

        <div className="mt-6">
          <InfographicViewer
            assetUrl={asset}
            fileFormat={item.file_format}
            altText={item.alt_text || item.title}
            allowDownload={Boolean(item.allow_download)}
            onZoom={() =>
              void trackInfographicEvent({
                data: { infographic_id: item.id, event_type: "infographic_zoomed" },
              })
            }
            onFullscreen={() =>
              void trackInfographicEvent({
                data: { infographic_id: item.id, event_type: "infographic_fullscreen" },
              })
            }
            onDownload={() =>
              void trackInfographicEvent({
                data: { infographic_id: item.id, event_type: "infographic_downloaded" },
              })
            }
            onShare={() =>
              void trackInfographicEvent({
                data: { infographic_id: item.id, event_type: "infographic_shared" },
              })
            }
          />
        </div>

        {item.alt_text ? (
          <p className="mt-4 text-sm italic text-muted-foreground">
            <span className="font-semibold not-italic text-ink">Alt text: </span>
            {item.alt_text}
          </p>
        ) : null}

        {item.long_description ? (
          <div className="mt-4 max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
            <h2 className="font-serif text-lg font-semibold text-ink">About this infographic</h2>
            <p className="whitespace-pre-line">{item.long_description}</p>
          </div>
        ) : null}

        {item.source || item.data_source || item.methodology || item.credits ? (
          <dl className="mt-6 grid gap-3 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-2">
            {item.source ? (
              <div>
                <dt className="font-semibold text-ink">Source</dt>
                <dd>
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-crimson hover:underline"
                    >
                      {item.source}
                    </a>
                  ) : (
                    item.source
                  )}
                </dd>
              </div>
            ) : null}
            {item.data_source ? (
              <div>
                <dt className="font-semibold text-ink">Data source</dt>
                <dd>{item.data_source}</dd>
              </div>
            ) : null}
            {item.data_date ? (
              <div>
                <dt className="font-semibold text-ink">Data as of</dt>
                <dd>{item.data_date}</dd>
              </div>
            ) : null}
            {item.methodology ? (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-ink">Methodology</dt>
                <dd>{item.methodology}</dd>
              </div>
            ) : null}
            {item.credits ? (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-ink">Credits</dt>
                <dd>{item.credits}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>

      {(relatedQ.data?.length ?? 0) > 0 ? (
        <section className="border-t border-border bg-secondary">
          <div className="mx-auto max-w-[1200px] px-4 py-12">
            <h2 className="rule-top mb-6 pt-3 font-serif text-2xl text-ink">More infographics</h2>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              {relatedQ.data?.map(
                (r: {
                  id: string;
                  slug?: string | null;
                  cover_image_url?: string | null;
                  title: string;
                  published_at?: string | null;
                }) => (
                  <Link
                    key={r.id}
                    to="/infographics/$slug"
                    params={{ slug: r.slug ?? "" }}
                    className="group block"
                  >
                    <div className="aspect-[3/4] overflow-hidden border border-border bg-muted">
                      {r.cover_image_url ? (
                        <img
                          src={r.cover_image_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          <span className="font-serif text-sm font-semibold text-ink">
                            {r.title}
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-serif text-sm text-ink group-hover:text-crimson">
                      {r.title}
                    </h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {timeAgo(r.published_at)}
                    </div>
                  </Link>
                ),
              )}
            </div>
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
