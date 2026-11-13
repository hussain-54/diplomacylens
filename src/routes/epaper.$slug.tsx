import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Download, FileText, Printer } from "lucide-react";
import { useEffect, useMemo } from "react";
import { SiteShell } from "@/components/site-shell";
import { PdfViewer } from "@/components/epaper/pdf-viewer";
import { ShareButtons } from "@/components/share-buttons";
import { formatDate, timeAgo } from "@/lib/format";
import {
  epaperSeo,
  getPublicEpaperBySlug,
  getRelatedPublicEditions,
  trackEpaperEvent,
} from "@/lib/epaper.functions";
import { SITE_NAME } from "@/lib/seo";
import { cmsGhostButton } from "@/components/cms-ui";

const qo = (slug: string) =>
  queryOptions({
    queryKey: ["public-epaper-edition", slug],
    queryFn: () => getPublicEpaperBySlug(slug),
  });

export const Route = createFileRoute("/epaper/$slug")({
  loader: async ({ context, params }) => {
    const edition = await context.queryClient.ensureQueryData(qo(params.slug));
    if (!edition) throw notFound();
    return { edition };
  },
  head: ({ loaderData }) => {
    const edition = loaderData?.edition;
    if (!edition) return {};
    const seo = epaperSeo(edition);
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
        { name: "twitter:title", content: seo.twitterTitle },
        { name: "twitter:description", content: seo.twitterDescription },
        { name: "twitter:image", content: seo.twitterImage },
      ],
      links: [{ rel: "canonical", href: seo.canonical }],
    };
  },
  component: EpaperDetailPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Edition not found</h1>
        <p className="mt-3 text-muted-foreground">
          This edition may have been unpublished or archived.
        </p>
        <Link to="/epaper" className="mt-6 inline-block text-crimson underline">
          Browse all editions
        </Link>
      </div>
    </SiteShell>
  ),
});

function EpaperDetailPage() {
  const { slug } = Route.useParams();
  const { data: edition } = useSuspenseQuery(qo(slug));
  const e = edition!;

  const relatedQ = useQuery({
    queryKey: ["public-epaper-related", e.id],
    queryFn: () => getRelatedPublicEditions(e.id, 4),
  });

  useEffect(() => {
    const key = `epaper-viewed:${e.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void trackEpaperEvent({ data: { edition_id: e.id, event_type: "epaper_opened" } });
  }, [e.id]);

  const shareUrl = useMemo(() => epaperSeo(e).canonical, [e]);

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
          <Link to="/epaper" className="hover:text-crimson">
            ePaper
          </Link>
        </nav>

        <div className="flex flex-col gap-2">
          {e.issue_number ? <p className="eyebrow text-crimson">Issue {e.issue_number}</p> : null}
          <h1 className="font-serif text-3xl font-bold text-ink md:text-4xl">{e.title}</h1>
          {e.description ? (
            <p className="max-w-3xl text-muted-foreground">{e.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={e.published_at ?? undefined}>{formatDate(e.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{timeAgo(e.published_at)}</span>
            {e.page_count ? (
              <>
                <span aria-hidden>·</span>
                <span>{e.page_count} pages</span>
              </>
            ) : null}
            {e.publisher ? (
              <>
                <span aria-hidden>·</span>
                <span>{e.publisher}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ShareButtons title={e.title} url={shareUrl} summary={e.description} variant="full" />
          <div className="flex items-center gap-2">
            {e.pdf_url && e.allow_print ? (
              <button
                type="button"
                className={cmsGhostButton}
                onClick={() => {
                  void trackEpaperEvent({
                    data: { edition_id: e.id, event_type: "epaper_printed" },
                  });
                  window.open(e.pdf_url!, "_blank", "noopener,noreferrer");
                }}
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            ) : null}
            {e.pdf_url && e.allow_download ? (
              <a
                href={e.pdf_url}
                download
                target="_blank"
                rel="noreferrer"
                className={cmsGhostButton}
                onClick={() =>
                  void trackEpaperEvent({
                    data: { edition_id: e.id, event_type: "epaper_downloaded" },
                  })
                }
              >
                <Download className="h-4 w-4" /> Download PDF
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <PdfViewer
            pdfUrl={e.pdf_url}
            pageCount={e.page_count}
            allowDownload={Boolean(e.allow_download)}
            allowPrint={Boolean(e.allow_print)}
            onPageChange={(page) =>
              void trackEpaperEvent({
                data: { edition_id: e.id, event_type: "epaper_page_viewed", page_number: page },
              })
            }
            onDownload={() => {
              void trackEpaperEvent({
                data: { edition_id: e.id, event_type: "epaper_downloaded" },
              });
              if (e.pdf_url) window.open(e.pdf_url, "_blank", "noopener,noreferrer");
            }}
            onPrint={() => {
              void trackEpaperEvent({ data: { edition_id: e.id, event_type: "epaper_printed" } });
              if (e.pdf_url) window.open(e.pdf_url, "_blank", "noopener,noreferrer");
            }}
            onShare={() => {
              void trackEpaperEvent({ data: { edition_id: e.id, event_type: "epaper_shared" } });
              if (navigator.share) {
                void navigator.share({ title: e.title, url: shareUrl }).catch(() => {});
              } else {
                void navigator.clipboard?.writeText(shareUrl);
              }
            }}
          />
        </div>
      </section>

      {(relatedQ.data?.length ?? 0) > 0 ? (
        <section className="border-t border-border bg-secondary">
          <div className="mx-auto max-w-[1200px] px-4 py-12">
            <h2 className="rule-top mb-6 pt-3 font-serif text-2xl text-ink">More editions</h2>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              {relatedQ.data?.map((r) => (
                <Link
                  key={r.id}
                  to="/epaper/$slug"
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
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <span className="font-serif text-sm font-semibold text-ink">{r.title}</span>
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
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
