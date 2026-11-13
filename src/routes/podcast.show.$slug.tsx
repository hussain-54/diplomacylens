import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { PodcastCard, type PodcastEpisode } from "@/components/home/media-cards";
import { ShareButtons } from "@/components/share-buttons";
import {
  getPublicEpisodesForShow,
  getPublicPodcastShowBySlug,
  podcastShowSeo,
} from "@/lib/podcast.functions";
import { SITE_NAME } from "@/lib/seo";

const showQo = (slug: string) =>
  queryOptions({
    queryKey: ["public-podcast-show", slug],
    queryFn: () => getPublicPodcastShowBySlug(slug),
  });

const episodesQo = (showId: string) =>
  queryOptions({
    queryKey: ["public-podcast-show-episodes", showId],
    queryFn: () => getPublicEpisodesForShow(showId),
  });

export const Route = createFileRoute("/podcast/show/$slug")({
  loader: async ({ context, params }) => {
    const show = await context.queryClient.ensureQueryData(showQo(params.slug));
    if (!show) throw notFound();
    await context.queryClient.ensureQueryData(episodesQo(show.id));
    return { show };
  },
  head: ({ loaderData }) => {
    const show = loaderData?.show;
    if (!show) return {};
    const seo = podcastShowSeo(show);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: "music.radio_station" },
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
  component: PodcastShowPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Show not found</h1>
        <p className="mt-3 text-muted-foreground">This podcast show may be unpublished.</p>
        <Link to="/podcast" className="mt-6 inline-block text-crimson underline">
          Browse podcasts
        </Link>
      </div>
    </SiteShell>
  ),
});

function PodcastShowPage() {
  const { slug } = Route.useParams();
  const { data: show } = useSuspenseQuery(showQo(slug));
  const s = show!;
  const { data: episodes } = useSuspenseQuery(episodesQo(s.id));
  const seo = podcastShowSeo(s);

  return (
    <SiteShell>
      <article>
        <header className="border-b border-border bg-navy text-navy-foreground">
          <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-12 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="aspect-square overflow-hidden bg-navy-foreground/10">
              {s.cover_image_url ? (
                <img src={s.cover_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Mic className="h-16 w-16 opacity-40" />
                </div>
              )}
            </div>
            <div>
              <p className="eyebrow text-navy-foreground/60">Podcast show</p>
              <h1 className="mt-2 font-serif text-4xl md:text-5xl">{s.title}</h1>
              {s.host ? (
                <p className="mt-3 text-sm text-navy-foreground/80">Hosted by {s.host}</p>
              ) : null}
              {(s.short_description || s.description) && (
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-navy-foreground/85">
                  {s.short_description || s.description}
                </p>
              )}
              <div className="mt-6">
                <ShareButtons url={seo.canonical} title={s.title} />
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-[1400px] px-4 py-12">
          <h2 className="font-serif text-2xl text-ink">Episodes</h2>
          {episodes.length ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {episodes.map((episode) => (
                <PodcastCard key={episode.id} episode={episode as unknown as PodcastEpisode} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              No published episodes in this show yet.
            </p>
          )}
          <Link to="/podcast" className="mt-10 inline-block text-sm text-crimson underline">
            All podcasts
          </Link>
        </section>
      </article>
    </SiteShell>
  );
}
