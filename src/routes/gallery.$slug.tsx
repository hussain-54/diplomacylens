import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getPublicGalleryBySlug } from "@/lib/media.functions";

export const Route = createFileRoute("/gallery/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: "Gallery — Diplomacy Lens" },
      { name: "description", content: `Public gallery ${params.slug} on Diplomacy Lens.` },
    ],
  }),
  component: PublicGalleryPage,
});

function PublicGalleryPage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-gallery", slug],
    queryFn: () => getPublicGalleryBySlug(slug),
  });

  return (
    <SiteShell>
      <section className="mx-auto max-w-[1200px] px-4 py-12">
        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-sm bg-muted" />
        ) : !q.data ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <h1 className="font-serif text-4xl text-ink">Gallery not found</h1>
            <p className="mt-3 text-muted-foreground">
              This gallery is private, unpublished, or does not exist.
            </p>
            <Link to="/" className="mt-6 inline-block text-navy underline hover:text-crimson">
              Back home
            </Link>
          </div>
        ) : (
          <>
            <nav
              aria-label="Breadcrumb"
              className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Link to="/" className="hover:text-crimson">
                Home
              </Link>
              <span aria-hidden>/</span>
              <span>Galleries</span>
              <span aria-hidden>/</span>
              <span className="font-medium text-foreground" aria-current="page">
                {q.data.gallery.name}
              </span>
            </nav>
            <p className="eyebrow text-crimson">{q.data.gallery.gallery_type}</p>
            <h1 className="mt-2 font-serif text-4xl font-bold text-ink md:text-5xl">
              {q.data.gallery.name}
            </h1>
            {q.data.gallery.description ? (
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                {q.data.gallery.description}
              </p>
            ) : null}
            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {q.data.items.map((item) => {
                const asset = item.media_assets as {
                  id: string;
                  public_url: string;
                  thumbnail_url?: string | null;
                  alt_text?: string | null;
                  file_name: string;
                  asset_type: string;
                } | null;
                if (!asset) return null;
                return (
                  <figure
                    key={asset.id}
                    className="overflow-hidden border border-border bg-background"
                  >
                    <div className="aspect-square bg-muted">
                      {asset.asset_type === "image" || asset.asset_type === "video" ? (
                        <img
                          src={asset.thumbnail_url || asset.public_url}
                          alt={asset.alt_text || asset.file_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase text-muted-foreground">
                          {asset.asset_type}
                        </div>
                      )}
                    </div>
                    {(item.caption_override || asset.alt_text) && (
                      <figcaption className="p-3 text-sm text-muted-foreground">
                        {item.caption_override || asset.alt_text}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          </>
        )}
      </section>
    </SiteShell>
  );
}
