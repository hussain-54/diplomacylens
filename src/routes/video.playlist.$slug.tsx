import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ListVideo } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { VideoCard, type HomeVideo } from "@/components/home/media-cards";
import { ShareButtons } from "@/components/share-buttons";
import {
  getPublicVideoPlaylistBySlug,
  getPublicVideoPlaylistItems,
  videoPlaylistSeo,
} from "@/lib/video.functions";
import { SITE_NAME } from "@/lib/seo";

const playlistQo = (slug: string) =>
  queryOptions({
    queryKey: ["public-video-playlist", slug],
    queryFn: () => getPublicVideoPlaylistBySlug(slug),
  });

const itemsQo = (playlistId: string) =>
  queryOptions({
    queryKey: ["public-video-playlist-items", playlistId],
    queryFn: () => getPublicVideoPlaylistItems(playlistId),
  });

export const Route = createFileRoute("/video/playlist/$slug")({
  loader: async ({ context, params }) => {
    const playlist = await context.queryClient.ensureQueryData(playlistQo(params.slug));
    if (!playlist) throw notFound();
    await context.queryClient.ensureQueryData(itemsQo(playlist.id));
    return { playlist };
  },
  head: ({ loaderData }) => {
    const playlist = loaderData?.playlist;
    if (!playlist) return {};
    const seo = videoPlaylistSeo(playlist);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: "video.playlist" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:title", content: seo.ogTitle },
        { property: "og:description", content: seo.ogDescription },
        { property: "og:url", content: seo.canonical },
        { property: "og:image", content: seo.ogImage },
      ],
      links: [{ rel: "canonical", href: seo.canonical }],
    };
  },
  component: VideoPlaylistPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Playlist not found</h1>
        <Link to="/video" className="mt-6 inline-block text-crimson underline">
          Browse videos
        </Link>
      </div>
    </SiteShell>
  ),
});

function VideoPlaylistPage() {
  const { slug } = Route.useParams();
  const { data: playlist } = useSuspenseQuery(playlistQo(slug));
  const p = playlist!;
  const { data: videos } = useSuspenseQuery(itemsQo(p.id));
  const seo = videoPlaylistSeo(p);

  return (
    <SiteShell>
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto max-w-[1400px] px-4 py-12">
          <p className="eyebrow text-navy-foreground/60">Video playlist</p>
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
        {videos.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video as unknown as HomeVideo} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <ListVideo className="h-10 w-10" />
            <p>No published videos in this playlist yet.</p>
          </div>
        )}
        <Link to="/video" className="mt-10 inline-block text-sm text-crimson underline">
          All videos
        </Link>
      </section>
    </SiteShell>
  );
}
