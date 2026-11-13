import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getTopicBySlug, listContentForTopic } from "@/lib/newsroom/topics";
import { listStories } from "@/lib/newsroom/stories";
import { supabase } from "@/integrations/supabase/client";
import { SITE_NAME } from "@/lib/seo";

export const Route = createFileRoute("/topic/$slug")({
  component: PublicTopicPage,
});

function PublicTopicPage() {
  const { slug } = Route.useParams();
  const topicQ = useQuery({
    queryKey: ["public-topic", slug],
    queryFn: () => getTopicBySlug(slug),
  });
  const contentQ = useQuery({
    queryKey: ["public-topic-content", topicQ.data?.id],
    enabled: !!topicQ.data?.id,
    queryFn: async () => {
      const links = await listContentForTopic(topicQ.data!.id);
      const articleIds = links
        .filter((l: { content_type: string }) => l.content_type === "article")
        .map((l: { content_id: string }) => l.content_id);
      const storyIds = links
        .filter((l: { content_type: string }) => l.content_type === "story")
        .map((l: { content_id: string }) => l.content_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const articles = articleIds.length
        ? ((
            await client
              .from("articles")
              .select("id,title,slug,published_at")
              .in("id", articleIds)
              .eq("status", "published")
          ).data ?? [])
        : [];
      const allStories = await listStories({ status: "active" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storyTopicRows =
        (await client.from("story_topics").select("story_id").eq("topic_id", topicQ.data!.id))
          .data ?? [];
      const linkedStoryIds = new Set([
        ...storyIds,
        ...storyTopicRows.map((r: { story_id: string }) => r.story_id),
      ]);
      const stories = allStories.filter((s) => linkedStoryIds.has(s.id));
      return { articles, stories, links };
    },
  });

  if (topicQ.isLoading) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-[1100px] px-4 py-16">
          <div className="h-32 animate-pulse bg-muted" />
        </div>
      </SiteShell>
    );
  }
  const topic = topicQ.data;
  if (!topic) throw notFound();

  return (
    <SiteShell>
      <div className="border-b border-border bg-secondary">
        <div className="mx-auto max-w-[1100px] px-4 py-10">
          <div className="eyebrow text-crimson">Topic</div>
          <h1
            className="mt-1 font-serif text-5xl text-ink"
            style={topic.accent_color ? { color: topic.accent_color } : undefined}
          >
            {topic.name}
          </h1>
          {topic.description ? (
            <p className="mt-3 max-w-2xl text-muted-foreground">{topic.description}</p>
          ) : null}
        </div>
      </div>
      <div className="mx-auto grid max-w-[1100px] gap-10 px-4 py-10 lg:grid-cols-2">
        <section>
          <h2 className="font-serif text-2xl">Stories</h2>
          <ul className="mt-4 space-y-3">
            {(contentQ.data?.stories ?? []).map((s) => (
              <li key={s.id}>
                <Link
                  to="/story/$slug"
                  params={{ slug: s.slug }}
                  className="font-medium hover:text-crimson"
                >
                  {s.title}
                </Link>
              </li>
            ))}
            {!contentQ.data?.stories?.length ? (
              <li className="text-sm text-muted-foreground">No linked stories yet.</li>
            ) : null}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl">Articles</h2>
          <ul className="mt-4 space-y-3">
            {(contentQ.data?.articles ?? []).map(
              (a: { id: string; title: string; slug: string }) => (
                <li key={a.id}>
                  <Link
                    to="/article/$slug"
                    params={{ slug: a.slug }}
                    className="font-medium hover:text-crimson"
                  >
                    {a.title}
                  </Link>
                </li>
              ),
            )}
            {!contentQ.data?.articles?.length ? (
              <li className="text-sm text-muted-foreground">No linked articles yet.</li>
            ) : null}
          </ul>
        </section>
      </div>
      <p className="mx-auto max-w-[1100px] px-4 pb-10 text-xs text-muted-foreground">{SITE_NAME}</p>
    </SiteShell>
  );
}
