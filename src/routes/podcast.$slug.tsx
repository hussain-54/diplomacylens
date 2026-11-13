import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Mic } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { AudioPlayer } from "@/components/podcasts/audio-player";
import { ShareButtons } from "@/components/share-buttons";
import { formatDate, timeAgo } from "@/lib/format";
import {
  formatDuration,
  getPublicPodcastEpisodeBySlug,
  getPublicPodcastShowById,
  getRelatedPodcastEpisodes,
  podcastEpisodeSeo,
  trackPodcastEvent,
} from "@/lib/podcast.functions";
import { SITE_NAME } from "@/lib/seo";

const qo = (slug: string) =>
  queryOptions({
    queryKey: ["public-podcast-episode", slug],
    queryFn: () => getPublicPodcastEpisodeBySlug(slug),
  });

export const Route = createFileRoute("/podcast/$slug")({
  loader: async ({ context, params }) => {
    const episode = await context.queryClient.ensureQueryData(qo(params.slug));
    if (!episode) throw notFound();
    return { episode };
  },
  head: ({ loaderData }) => {
    const episode = loaderData?.episode;
    if (!episode) return {};
    const seo = podcastEpisodeSeo(episode);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: "music.song" },
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
  component: PodcastDetailPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Episode not found</h1>
        <p className="mt-3 text-muted-foreground">
          This episode may have been unpublished or archived.
        </p>
        <Link to="/podcast" className="mt-6 inline-block text-crimson underline">
          Browse all episodes
        </Link>
      </div>
    </SiteShell>
  ),
});

function PodcastDetailPage() {
  const { slug } = Route.useParams();
  const { data: episode } = useSuspenseQuery(qo(slug));
  const e = episode!;

  const relatedQ = useQuery({
    queryKey: ["public-podcast-related", e.id],
    queryFn: () => getRelatedPodcastEpisodes(e.id, 4),
  });
  const showQ = useQuery({
    queryKey: ["public-podcast-show-by-id", e.show_id],
    queryFn: () => getPublicPodcastShowById(e.show_id!),
    enabled: Boolean(e.show_id),
  });
  const show = showQ.data ?? null;

  const [transcriptOpen, setTranscriptOpen] = useState(false);

  useEffect(() => {
    const key = `podcast-viewed:${e.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void trackPodcastEvent({
      data: { episode_id: e.id, show_id: e.show_id, event_type: "episode_opened" },
    });
  }, [e.id, e.show_id]);

  const shareUrl = useMemo(() => podcastEpisodeSeo(e).canonical, [e]);

  return (
    <SiteShell>
      <section className="mx-auto max-w-[900px] px-4 py-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-crimson">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link to="/podcast" className="hover:text-crimson">
            Podcast
          </Link>
          {show ? (
            <>
              <span aria-hidden>/</span>
              <Link
                to="/podcast/show/$slug"
                params={{ slug: show.slug || show.id }}
                className="hover:text-crimson"
              >
                {show.title}
              </Link>
            </>
          ) : null}
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {e.artwork_url ? (
              <img src={e.artwork_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-navy text-navy-foreground">
                <Mic className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {e.category ? <p className="eyebrow text-crimson">{e.category}</p> : null}
            <h1 className="font-serif text-3xl font-bold text-ink md:text-4xl">{e.title}</h1>
            {show ? (
              <p className="mt-1 text-sm text-muted-foreground">
                From{" "}
                <Link
                  to="/podcast/show/$slug"
                  params={{ slug: show.slug || show.id }}
                  className="font-medium text-crimson hover:underline"
                >
                  {show.title}
                </Link>
              </p>
            ) : null}
            {e.short_description || e.description ? (
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {e.short_description || e.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <time dateTime={e.published_at ?? undefined}>{formatDate(e.published_at)}</time>
              <span aria-hidden>·</span>
              <span>{timeAgo(e.published_at)}</span>
              {e.duration || e.duration_seconds ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{e.duration || formatDuration(e.duration_seconds)}</span>
                </>
              ) : null}
              {e.host ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Hosted by {e.host}</span>
                </>
              ) : null}
              {e.guests ? (
                <>
                  <span aria-hidden>·</span>
                  <span>With {e.guests}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <AudioPlayer
            src={e.audio_url}
            title={e.title}
            artworkUrl={e.artwork_url}
            allowDownload={Boolean(e.allow_download)}
            onPlay={() =>
              void trackPodcastEvent({
                data: { episode_id: e.id, show_id: e.show_id, event_type: "play_started" },
              })
            }
            onPause={(position) =>
              void trackPodcastEvent({
                data: {
                  episode_id: e.id,
                  show_id: e.show_id,
                  event_type: "play_paused",
                  position_seconds: Math.round(position),
                },
              })
            }
            onSeek={(position) =>
              void trackPodcastEvent({
                data: {
                  episode_id: e.id,
                  show_id: e.show_id,
                  event_type: "seek",
                  position_seconds: Math.round(position),
                },
              })
            }
            onProgress={(position, duration) =>
              void trackPodcastEvent({
                data: {
                  episode_id: e.id,
                  show_id: e.show_id,
                  event_type: "listen_progress",
                  position_seconds: Math.round(position),
                  duration_seconds: Math.round(duration) || null,
                },
              })
            }
            onComplete={(duration) =>
              void trackPodcastEvent({
                data: {
                  episode_id: e.id,
                  show_id: e.show_id,
                  event_type: "play_completed",
                  duration_seconds: Math.round(duration) || null,
                },
              })
            }
            onDownload={() =>
              void trackPodcastEvent({
                data: { episode_id: e.id, show_id: e.show_id, event_type: "downloaded" },
              })
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ShareButtons
            title={e.title}
            url={shareUrl}
            summary={e.short_description}
            variant="full"
          />
          {e.external_url ? (
            <a
              href={e.external_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-crimson hover:underline"
              onClick={() =>
                void trackPodcastEvent({
                  data: { episode_id: e.id, show_id: e.show_id, event_type: "shared" },
                })
              }
            >
              Listen on external platform <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>

        {e.description ? (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="eyebrow mb-3 text-muted-foreground">Episode notes</h2>
            <p className="whitespace-pre-wrap text-base leading-7 text-foreground">
              {e.description}
            </p>
          </div>
        ) : null}

        {e.credits || e.references_text ? (
          <div className="mt-6 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
            {e.credits ? (
              <p>
                <span className="font-semibold text-foreground">Credits: </span>
                {e.credits}
              </p>
            ) : null}
            {e.references_text ? (
              <p>
                <span className="font-semibold text-foreground">References: </span>
                {e.references_text}
              </p>
            ) : null}
          </div>
        ) : null}

        {e.transcript ? (
          <div className="mt-8 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="eyebrow text-muted-foreground">Transcript</span>
              {transcriptOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {transcriptOpen ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {e.transcript}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {(relatedQ.data?.length ?? 0) > 0 ? (
        <section className="border-t border-border bg-secondary">
          <div className="mx-auto max-w-[1200px] px-4 py-12">
            <h2 className="rule-top mb-6 pt-3 font-serif text-2xl text-ink">More episodes</h2>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              {relatedQ.data?.map(
                (r: {
                  id: string;
                  slug?: string | null;
                  artwork_url?: string | null;
                  title: string;
                  published_at?: string | null;
                }) => (
                  <Link
                    key={r.id}
                    to="/podcast/$slug"
                    params={{ slug: r.slug ?? "" }}
                    className="group block"
                  >
                    <div className="aspect-square overflow-hidden rounded-sm border border-border bg-muted">
                      {r.artwork_url ? (
                        <img
                          src={r.artwork_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 bg-navy text-navy-foreground">
                          <Mic className="h-8 w-8" />
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
