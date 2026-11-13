import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { listPublicBreakingNews } from "@/lib/breaking-news/functions";
import { timeAgo } from "@/lib/format";
import { DEFAULT_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/breaking")({
  head: () => ({
    meta: [
      { title: `Breaking News — ${SITE_NAME}` },
      {
        name: "description",
        content: `Live breaking news and diplomatic alerts from ${SITE_NAME}. ${DEFAULT_DESCRIPTION}`,
      },
      { name: "robots", content: "index,follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: `Breaking News — ${SITE_NAME}` },
      { property: "og:url", content: `${siteUrl()}/breaking` },
    ],
    links: [{ rel: "canonical", href: `${siteUrl()}/breaking` }],
  }),
  component: BreakingNewsPage,
});

function priorityLabel(priority: string | null | undefined) {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High";
  return "Breaking";
}

function BreakingNewsPage() {
  const q = useQuery({
    queryKey: ["breaking-news-public"],
    queryFn: () => listPublicBreakingNews(60),
    refetchInterval: 60_000,
  });

  const now = Date.now();
  const items = (q.data ?? []).filter(
    (item) => !item.expires_at || new Date(item.expires_at).getTime() > now,
  );
  const expired = (q.data ?? []).filter(
    (item) => item.expires_at && new Date(item.expires_at).getTime() <= now,
  );

  return (
    <SiteShell>
      <div className="border-b border-border bg-secondary">
        <div className="mx-auto max-w-[1400px] px-4 py-10">
          <div className="eyebrow text-crimson">Live desk</div>
          <h1 className="mt-1 font-serif text-5xl text-ink">Breaking News</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Active diplomatic alerts from the newsroom. Full stories open when a related article is
            linked.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-10 px-4 py-10">
        {q.isLoading ? <div className="h-32 animate-pulse bg-muted" /> : null}
        {q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null}

        {!q.isLoading && !items.length ? (
          <p className="text-muted-foreground">No active breaking news right now.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const related = item.articles;
              const href = related?.slug ? `/article/${related.slug}` : null;
              return (
                <article
                  key={item.id}
                  className="border border-border bg-background p-5 sm:flex sm:gap-6"
                >
                  {item.media_url && item.media_type !== "audio" ? (
                    <div className="mb-4 aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted sm:mb-0 sm:w-56">
                      <img
                        src={item.media_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : related?.hero_image_url ? (
                    <div className="mb-4 aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted sm:mb-0 sm:w-56">
                      <img
                        src={related.hero_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm bg-crimson px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-crimson-foreground">
                        {priorityLabel(item.priority)}
                      </span>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={item.published_at ?? item.created_at}
                      >
                        {timeAgo(item.published_at ?? item.created_at)}
                      </time>
                    </div>
                    <h2 className="mt-2 font-serif text-2xl text-ink">{item.headline}</h2>
                    {item.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                    {href ? (
                      <Link
                        to="/article/$slug"
                        params={{ slug: related!.slug! }}
                        className="mt-3 inline-block text-xs font-semibold uppercase tracking-widest text-crimson hover:underline"
                      >
                        {related?.title ? `Read: ${related.title}` : "Read related article →"}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {expired.length ? (
          <section>
            <h2 className="font-serif text-2xl text-ink">Recently expired</h2>
            <ul className="mt-4 divide-y divide-border border border-border">
              {expired.slice(0, 12).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span>{item.headline}</span>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={item.expires_at ?? undefined}
                  >
                    Expired {timeAgo(item.expires_at)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}
