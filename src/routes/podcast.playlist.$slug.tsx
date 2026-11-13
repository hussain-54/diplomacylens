import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ListMusic } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { PodcastCard, type PodcastEpisode } from "@/components/home/media-cards";
import { ShareButtons } from "@/components/share-buttons";
import {
  getPublicPodcastPlaylistBySlug,
  getPublicPodcastPlaylistItems,
  podcastPlaylistSeo,
} from "@/lib/podcast.functions";
import { SITE_NAME } from "@/lib/seo";

const playlistQo = (slug: string) =>
  queryOptions({
    queryKey: ["public-podcast-playlist", slug],
    queryFn: () => getPublicPodcastPlaylistBySlug(slug),
  });

const itemsQo = (playlistId: string) =>
  queryOptions({
    queryKey: ["public-podcast-playlist-items", playlistId],
    queryFn: () => getPublicPodcastPlaylistItems(playlistId),
  });

export const Route = createFileRoute("/podcast/playlist/$slug")({
  loader: async ({ context, params }) => {
    const playlist = await context.queryClient.ensureQueryData(playlistQo(params.slug));
    if (!playlist) throw notFound();
    await context.queryClient.ensureQueryData(itemsQo(playlist.id));
    return { playlist };
  },
  head: ({ loaderData }) => {
    const playlist = loaderData?.playlist;
    if (!playlist) return {};
    const seo = podcastPlaylistSeo(playlist);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: "music.playlist" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:title", content: seo.ogTitle },
        { property: "og:description", content: seo.ogDescription },
        { property: "og:url", content: seo.canonical },
        { property: "og:image", content: seo.ogImage },
      ],
      links: [{ rel: "canonical", href: seo.canonical }],
    };
  },
  component: PodcastPlaylistPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Playlist not found</h1>
        <Link to="/podcast" className="mt-6 inline-block text-crimson underline">
          Browse podcasts
        </Link>
      </div>
    </SiteShell>
  ),
});

function PodcastPlaylistPage() {
  const { slug } = Route.useParams();
  const { data: playlist } = useSuspenseQuery(playlistQo(slug));
  const p = playlist!;
  const { data: episodes } = useSuspenseQuery(itemsQo(p.id));
  const seo = podcastPlaylistSeo(p);

  return (
    <SiteShell>
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto max-w-[1400px] px-4 py-12">
          <p className="eyebrow text-navy-foreground/60">Podcast playlist</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl">{p.title}</h1>
          {p.description ? (
            <p className="mt-3 max-w-2xl text-navy-foreground/85">{p.description}</p>
          ) : null}
          <div className="mt-6">
            <ShareButtons url={seo.canonical} title={p.title} />
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-[1400px] px-4 py-10">
        {episodes.length ? (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {episodes.map((episode) => (
              <PodcastCard key={episode.id} episode={episode as unknown as PodcastEpisode} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <ListMusic className="h-10 w-10" />
            <p>No published episodes in this playlist yet.</p>
          </div>
        )}
        <Link to="/podcast" className="mt-10 inline-block text-sm text-crimson underline">
          All podcasts
        </Link>
      </section>
    </SiteShell>
  );
}
