import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getStoryBySlug, getStoryItems, resolveStoryItemTitles } from "@/lib/newsroom/stories";
import { SITE_NAME, siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/story/$slug")({
  component: PublicStoryPage,
});

function PublicStoryPage() {
  const { slug } = Route.useParams();
  const storyQ = useQuery({
    queryKey: ["public-story", slug],
    queryFn: () => getStoryBySlug(slug),
  });
  const itemsQ = useQuery({
    queryKey: ["public-story-items", storyQ.data?.id],
    enabled: !!storyQ.data?.id,
    queryFn: async () => resolveStoryItemTitles(await getStoryItems(storyQ.data!.id)),
  });

  if (storyQ.isLoading) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-[900px] px-4 py-16">
          <div className="h-40 animate-pulse bg-muted" />
        </div>
      </SiteShell>
    );
  }

  const story = storyQ.data;
  if (!story) throw notFound();

  const items = (itemsQ.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.meta.at || b.created_at).getTime() -
        new Date(a.meta.at || a.created_at).getTime(),
    );

  return (
    <SiteShell>
      <article>
        <header className="border-b border-border bg-secondary">
          <div className="mx-auto max-w-[900px] px-4 py-10">
            <div className="eyebrow text-crimson">Story</div>
            <h1 className="mt-1 font-serif text-4xl text-ink md:text-5xl">{story.title}</h1>
            {story.short_description ? (
              <p className="mt-3 text-muted-foreground">{story.short_description}</p>
            ) : null}
          </div>
        </header>
        {story.hero_image_url ? (
          <div className="mx-auto max-w-[1100px] px-4 py-6">
            <img src={story.hero_image_url} alt="" className="aspect-[21/9] w-full object-cover" />
          </div>
        ) : null}
        <div className="mx-auto max-w-[900px] space-y-8 px-4 py-8">
          {story.summary ? (
            <p className="text-lg leading-relaxed text-foreground/90">{story.summary}</p>
          ) : null}
          <section>
            <h2 className="font-serif text-2xl text-ink">Timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-border">
              {items.map((item) => (
                <li key={item.id} className="relative pl-5">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-crimson" />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {item.content_type}
                    {item.meta.at ? ` · ${new Date(item.meta.at).toLocaleString()}` : ""}
                  </div>
                  {item.meta.href ? (
                    <a href={item.meta.href} className="font-medium hover:text-crimson">
                      {item.meta.title}
                    </a>
                  ) : (
                    <div className="font-medium">{item.meta.title}</div>
                  )}
                </li>
              ))}
              {!items.length ? (
                <p className="pl-5 text-sm text-muted-foreground">
                  Coverage will appear as editors attach content.
                </p>
              ) : null}
            </ol>
          </section>
          <p className="text-xs text-muted-foreground">
            {SITE_NAME} · <Link to="/">Home</Link> · <a href={siteUrl()}>{siteUrl()}</a>
          </p>
        </div>
      </article>
    </SiteShell>
  );
}
