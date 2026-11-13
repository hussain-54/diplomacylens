import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { HomeEmptyState } from "@/components/home/section";
import { timeAgo } from "@/lib/format";
import { getPublicCollectionBySlug, type Infographic } from "@/lib/infographics.functions";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

type CollectionItemRow = { sort_order: number; infographic: Infographic | null };

const qo = (slug: string) =>
  queryOptions({
    queryKey: ["public-infographic-collection", slug],
    queryFn: () => getPublicCollectionBySlug(slug),
  });

export const Route = createFileRoute("/infographics/collections/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(qo(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const collection = loaderData?.collection;
    if (!collection) return {};
    const title = `${collection.title} — Infographics Collection | ${SITE_NAME}`;
    const description =
      collection.description?.trim() || `Browse the “${collection.title}” infographics collection.`;
    const canonical = absoluteUrl(`/infographics/collections/${collection.slug ?? collection.id}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: InfographicCollectionPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-ink">Collection not found</h1>
        <p className="mt-3 text-muted-foreground">This collection may have been unpublished.</p>
        <Link to="/infographics" className="mt-6 inline-block text-crimson underline">
          Browse all infographics
        </Link>
      </div>
    </SiteShell>
  ),
});

function InfographicCollectionPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(qo(slug));
  const { collection, items } = data!;
  const rows = (items as unknown as CollectionItemRow[]).filter((row) => row.infographic);

  return (
    <SiteShell>
      <section className="mx-auto max-w-[1400px] px-4 py-12">
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
        <p className="eyebrow text-crimson">Collection</p>
        <h1 className="font-serif text-4xl font-bold text-ink md:text-5xl">{collection.title}</h1>
        {collection.description ? (
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{collection.description}</p>
        ) : null}

        {rows.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {rows.map(({ infographic }) => (
              <Link
                key={infographic!.id}
                to="/infographics/$slug"
                params={{ slug: infographic!.slug ?? "" }}
                className="group block"
              >
                <div className="overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                  <div className="aspect-[3/4] overflow-hidden border border-border bg-muted">
                    {infographic!.cover_image_url ? (
                      <img
                        src={infographic!.cover_image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    {infographic!.category ? (
                      <div className="eyebrow text-crimson">{infographic!.category}</div>
                    ) : null}
                    <h3 className="mt-1 font-serif text-base text-ink transition-colors group-hover:text-crimson">
                      {infographic!.title}
                    </h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {timeAgo(infographic!.published_at)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <HomeEmptyState message="This collection doesn't have any infographics yet." />
          </div>
        )}
      </section>
    </SiteShell>
  );
}
