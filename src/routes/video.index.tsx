import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ListVideo } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { VideoCard, type HomeVideo } from "@/components/home/media-cards";
import { HomeEmptyState } from "@/components/home/section";
import { getPublicVideoPlaylists, getPublicVideos } from "@/lib/video.functions";

const videosQo = queryOptions({
  queryKey: ["public-videos"],
  queryFn: () => getPublicVideos({ pageSize: 48 }),
});

const playlistsQo = queryOptions({
  queryKey: ["public-video-playlists"],
  queryFn: getPublicVideoPlaylists,
});

export const Route = createFileRoute("/video/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(videosQo),
      context.queryClient.ensureQueryData(playlistsQo),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Video — Diplomacy Lens" },
      { name: "description", content: "Dispatches, interviews, and field reporting on video." },
      { property: "og:title", content: "Diplomacy Lens Video" },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(videosQo);
  const { data: playlists } = useSuspenseQuery(playlistsQo);
  const videos = data.rows as unknown as HomeVideo[];
  return (
    <SiteShell>
      <div className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto max-w-[1400px] px-4 py-10">
          <div className="eyebrow text-navy-foreground/60">Video</div>
          <h1 className="mt-1 font-serif text-5xl">Dispatches on tape</h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-12 px-4 py-10">
        {playlists.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl text-ink">Playlists</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist) => (
                <Link
                  key={playlist.id}
                  to="/video/playlist/$slug"
                  params={{ slug: playlist.slug || playlist.id }}
                  className="group border border-border bg-card p-4 transition-colors hover:border-crimson"
                >
                  <div className="flex items-start gap-3">
                    <ListVideo className="mt-1 h-5 w-5 text-muted-foreground" />
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
          </section>
        ) : null}

        <section>
          <h2 className="font-serif text-2xl text-ink">Latest videos</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
            {!videos.length && (
              <div className="md:col-span-2 lg:col-span-3">
                <HomeEmptyState message="No videos published yet. Add videos in the CMS to populate this page." />
              </div>
            )}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
