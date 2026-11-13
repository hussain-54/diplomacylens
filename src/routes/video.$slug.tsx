import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { useEffect, useMemo } from "react";
import { SiteShell } from "@/components/site-shell";
import { VideoPlayer } from "@/components/videos/video-player";
import { ShareButtons } from "@/components/share-buttons";
import { formatDate, timeAgo } from "@/lib/format";
import {
  formatDuration,
  getPublicVideoBySlug,
  getRelatedVideos,
  videoSeo,
  trackVideoEvent,
} from "@/lib/video.functions";
import { SITE_NAME } from "@/lib/seo";

const qo = (slug: string) =>
  queryOptions({
    queryKey: ["public-video", slug],
    queryFn: () => getPublicVideoBySlug(slug),
  });

export const Route = createFileRoute("/video/$slug")({
  loader: async ({ context, params }) => {
    const video = await context.queryClient.ensureQueryData(qo(params.slug));
    if (!video) throw notFound();
    return { video };
  },
  head: ({ loaderData }) => {
    const video = loaderData?.video;
    if (!video) return {};
    const seo = videoSeo(video);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: "video.other" },
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
  component: VideoDetailPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Video not found</h1>
        <p className="mt-3 text-muted-foreground">
          This video may have been unpublished or archived.
        </p>
        <Link to="/video" className="mt-6 inline-block text-crimson underline">
          Browse all videos
        </Link>
      </div>
    </SiteShell>
  ),
});

function VideoDetailPage() {
  const { slug } = Route.useParams();
  const { data: video } = useSuspenseQuery(qo(slug));
  const v = video!;

  const relatedQ = useQuery({
    queryKey: ["public-video-related", v.id],
    queryFn: () => getRelatedVideos(v.id, 4),
  });

  useEffect(() => {
    const key = `video-viewed:${v.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void trackVideoEvent({ data: { video_id: v.id, event_type: "video_opened" } });
  }, [v.id]);

  const shareUrl = useMemo(() => videoSeo(v).canonical, [v]);

  return (
    <SiteShell>
      <section className="mx-auto max-w-[1100px] px-4 py-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-crimson">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link to="/video" className="hover:text-crimson">
            Video
          </Link>
        </nav>

        {v.category ? <p className="eyebrow text-crimson">{v.category}</p> : null}
        <h1 className="font-serif text-3xl font-bold text-ink md:text-4xl">{v.title}</h1>
        {v.short_description || v.description ? (
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {v.short_description || v.description}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <time dateTime={v.published_at ?? undefined}>{formatDate(v.published_at)}</time>
          <span aria-hidden>·</span>
          <span>{timeAgo(v.published_at)}</span>
          {v.duration || v.duration_seconds ? (
            <>
              <span aria-hidden>·</span>
              <span>{v.duration || formatDuration(v.duration_seconds)}</span>
            </>
          ) : null}
          {v.author_name ? (
            <>
              <span aria-hidden>·</span>
              <span>By {v.author_name}</span>
            </>
          ) : null}
        </div>

        <div className="mt-6">
          <VideoPlayer
            src={v.video_url}
            poster={v.thumbnail_url}
            title={v.title}
            allowDownload={Boolean(v.allow_download)}
            onPlay={() =>
              void trackVideoEvent({ data: { video_id: v.id, event_type: "play_started" } })
            }
            onPause={(position) =>
              void trackVideoEvent({
                data: {
                  video_id: v.id,
                  event_type: "play_paused",
                  position_seconds: Math.round(position),
                },
              })
            }
            onSeek={(position) =>
              void trackVideoEvent({
                data: {
                  video_id: v.id,
                  event_type: "seek",
                  position_seconds: Math.round(position),
                },
              })
            }
            onProgress={(position, duration) =>
              void trackVideoEvent({
                data: {
                  video_id: v.id,
                  event_type: "watch_progress",
                  position_seconds: Math.round(position),
                  duration_seconds: Math.round(duration) || null,
                },
              })
            }
            onComplete={(duration) =>
              void trackVideoEvent({
                data: {
                  video_id: v.id,
                  event_type: "play_completed",
                  duration_seconds: Math.round(duration) || null,
                },
              })
            }
            onDownload={() =>
              void trackVideoEvent({ data: { video_id: v.id, event_type: "downloaded" } })
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ShareButtons
            title={v.title}
            url={shareUrl}
            summary={v.short_description}
            variant="full"
          />
        </div>

        {v.description ? (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="eyebrow mb-3 text-muted-foreground">About this video</h2>
            <p className="whitespace-pre-wrap text-base leading-7 text-foreground">
              {v.description}
            </p>
          </div>
        ) : null}

        {v.credits || v.source ? (
          <div className="mt-6 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
            {v.credits ? (
              <p>
                <span className="font-semibold text-foreground">Credits: </span>
                {v.credits}
              </p>
            ) : null}
            {v.source ? (
              <p>
                <span className="font-semibold text-foreground">Source: </span>
                {v.source}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {(relatedQ.data?.length ?? 0) > 0 ? (
        <section className="border-t border-border bg-secondary">
          <div className="mx-auto max-w-[1200px] px-4 py-12">
            <h2 className="rule-top mb-6 pt-3 font-serif text-2xl text-ink">More videos</h2>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              {relatedQ.data?.map(
                (r: {
                  id: string;
                  slug?: string | null;
                  thumbnail_url?: string | null;
                  title: string;
                  published_at?: string | null;
                }) => (
                  <Link
                    key={r.id}
                    to="/video/$slug"
                    params={{ slug: r.slug ?? "" }}
                    className="group block"
                  >
                    <div className="aspect-video overflow-hidden rounded-sm border border-border bg-muted">
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 bg-navy text-navy-foreground">
                          <Film className="h-8 w-8" />
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
