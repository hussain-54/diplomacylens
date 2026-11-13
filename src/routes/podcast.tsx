import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Mic, ListMusic } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { PodcastCard, type PodcastEpisode } from "@/components/home/media-cards";
import { HomeEmptyState } from "@/components/home/section";
import {
  getPublicPodcastEpisodes,
  getPublicPodcastPlaylists,
  getPublicPodcastShows,
  type PodcastShow,
} from "@/lib/podcast.functions";

const episodesQo = queryOptions({
  queryKey: ["public-podcast-episodes"],
  queryFn: () => getPublicPodcastEpisodes({ pageSize: 48 }),
});

const showsQo = queryOptions({
  queryKey: ["public-podcast-shows"],
  queryFn: getPublicPodcastShows,
});

const playlistsQo = queryOptions({
  queryKey: ["public-podcast-playlists"],
  queryFn: getPublicPodcastPlaylists,
});

export const Route = createFileRoute("/podcast")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(episodesQo),
      context.queryClient.ensureQueryData(showsQo),
      context.queryClient.ensureQueryData(playlistsQo),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Podcast — Diplomacy Lens" },
      {
        name: "description",
        content: "Conversations with diplomats, correspondents and analysts.",
      },
      { property: "og:title", content: "Diplomacy Lens Podcast" },
    ],
  }),
  component: PodcastPage,
});

function PodcastPage() {
  const { data: episodesData } = useSuspenseQuery(episodesQo);
  const { data: shows } = useSuspenseQuery(showsQo);
  const { data: playlists } = useSuspenseQuery(playlistsQo);
  const episodes = episodesData.rows as unknown as PodcastEpisode[];

  return (
    <SiteShell>
      <section className="mx-auto max-w-[1400px] px-4 py-12">
        <p className="eyebrow text-crimson">The Podcast</p>
        <h1 className="font-serif text-4xl font-bold text-ink md:text-5xl">
          Diplomatic Frequencies
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Long-form interviews and briefings ready for Spotify, Apple Podcasts, YouTube, and RSS.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/podcasts-rss.xml"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border border-input px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-crimson hover:text-crimson"
          >
            RSS
          </a>
          {["Apple Podcasts", "Spotify", "YouTube"].map((p) => (
            <span
              key={p}
              className="rounded-sm border border-input px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>

        {shows.length > 0 ? (
          <div className="mt-12">
            <h2 className="font-serif text-2xl text-ink">Shows</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shows.map((show: PodcastShow) => (
                <Link
                  key={show.id}
                  to="/podcast/show/$slug"
                  params={{ slug: show.slug || show.id }}
                  className="group border border-border bg-card transition-colors hover:border-crimson"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {show.cover_image_url ? (
                      <img
                        src={show.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Mic className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif text-xl text-ink group-hover:text-crimson">
                      {show.title}
                    </h3>
                    {show.host ? (
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {show.host}
                      </p>
                    ) : null}
                    {show.short_description || show.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {show.short_description || show.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {playlists.length > 0 ? (
          <div className="mt-12">
            <h2 className="font-serif text-2xl text-ink">Playlists</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist) => (
                <Link
                  key={playlist.id}
                  to="/podcast/playlist/$slug"
                  params={{ slug: playlist.slug || playlist.id }}
                  className="group border border-border bg-card p-4 transition-colors hover:border-crimson"
                >
                  <div className="flex items-start gap-3">
                    <ListMusic className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-serif text-xl text-ink group-hover:text-crimson">
                        {playlist.title}
                      </h3>
                      {playlist.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {playlist.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-12">
          <h2 className="font-serif text-2xl text-ink">Latest episodes</h2>
          {episodes.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {episodes.map((episode) => (
                <PodcastCard key={episode.id} episode={episode} />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <HomeEmptyState message="No episodes published yet. Add podcast episodes in the CMS to populate this page." />
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
