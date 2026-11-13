import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { EpaperCard, type EpaperEdition } from "@/components/home/media-cards";
import { HomeEmptyState } from "@/components/home/section";
import { getPublicEpaperEditions } from "@/lib/epaper.functions";

const qo = queryOptions({
  queryKey: ["public-epaper-editions"],
  queryFn: () => getPublicEpaperEditions({ pageSize: 48 }),
});

export const Route = createFileRoute("/epaper")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  head: () => ({
    meta: [
      { title: "E-Paper — Diplomacy Lens" },
      { name: "description", content: "Read digital newspaper editions from Diplomacy Lens." },
      { property: "og:title", content: "Diplomacy Lens E-Paper" },
    ],
  }),
  component: EpaperPage,
});

function EpaperPage() {
  const { data } = useSuspenseQuery(qo);
  const editions = data.rows as unknown as EpaperEdition[];
  return (
    <SiteShell>
      <section className="mx-auto max-w-[1400px] px-4 py-12">
        <p className="eyebrow text-crimson">Print desk</p>
        <h1 className="font-serif text-4xl font-bold text-ink md:text-5xl">E-Paper</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Digital newspaper editions with cover art, issue details, and downloadable PDFs.
        </p>
        {editions.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {editions.map((edition) => (
              <EpaperCard key={edition.id} edition={edition} />
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <HomeEmptyState message="No editions published yet. Editors can add covers and PDFs in the CMS." />
          </div>
        )}
      </section>
    </SiteShell>
  );
}
