import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { InfographicCard, type InfographicItem } from "@/components/home/media-cards";
import { HomeEmptyState } from "@/components/home/section";
import { getPublicInfographics } from "@/lib/infographics.functions";

const qo = queryOptions({
  queryKey: ["public-infographics"],
  queryFn: () => getPublicInfographics({ pageSize: 48 }),
});

export const Route = createFileRoute("/infographics")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  head: () => ({
    meta: [
      { title: "Infographics — Diplomacy Lens" },
      { name: "description", content: "Visual briefings and data stories from Diplomacy Lens." },
    ],
  }),
  component: InfographicsPage,
});

function InfographicsPage() {
  const { data } = useSuspenseQuery(qo);
  const items = data.rows as unknown as InfographicItem[];
  return (
    <SiteShell>
      <section className="mx-auto max-w-[1400px] px-4 py-12">
        <p className="eyebrow text-crimson">Visual briefings</p>
        <h1 className="font-serif text-4xl font-bold text-ink md:text-5xl">Infographics</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Portrait visual explainers covering diplomacy, conflict, and global policy.
        </p>
        {items.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <InfographicCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <HomeEmptyState message="No infographics published yet. Editors can add them in the CMS." />
          </div>
        )}
      </section>
    </SiteShell>
  );
}
