import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";
import type { StoryContentType, StoryItemRow, StoryRow, StoryStatus } from "@/lib/newsroom/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `story-${Math.random().toString(36).slice(2, 8)}`;

async function writeAudit(
  action: string,
  entityId: string | null,
  summary: string,
  payload: Record<string, unknown> = {},
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await db().from("admin_audit_logs").insert({
    actor_id: user.id,
    action,
    entity_type: "story",
    entity_id: entityId,
    summary,
    payload,
  });
}

export async function listStories(filters?: { status?: StoryStatus | StoryStatus[]; q?: string }) {
  let query = db().from("stories").select("*").order("updated_at", { ascending: false });
  if (Array.isArray(filters?.status)) query = query.in("status", filters.status);
  else if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.q?.trim()) query = query.ilike("title", `%${filters.q.trim()}%`);
  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [] as StoryRow[];
    throw toAppError(error);
  }
  return (data ?? []) as StoryRow[];
}

export async function getStoryById(id: string) {
  const { data, error } = await db().from("stories").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  return data as StoryRow | null;
}

export async function getStoryBySlug(slug: string) {
  const { data, error } = await db()
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return data as StoryRow | null;
}

export async function getStoryItems(storyId: string) {
  const { data, error } = await db()
    .from("story_items")
    .select("*")
    .eq("story_id", storyId)
    .order("position", { ascending: true });
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [] as StoryItemRow[];
    throw toAppError(error);
  }
  return (data ?? []) as StoryItemRow[];
}

export async function upsertStory(input: {
  id?: string;
  title: string;
  slug?: string;
  short_description?: string | null;
  summary?: string | null;
  hero_image_url?: string | null;
  category_id?: string | null;
  primary_author_id?: string | null;
  status?: StoryStatus;
  featured?: boolean;
  start_date?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  topic_ids?: string[];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const slug = slugify(input.slug?.trim() || input.title);
  const payload = {
    title: input.title.trim(),
    slug,
    short_description: input.short_description ?? null,
    summary: input.summary ?? null,
    hero_image_url: input.hero_image_url ?? null,
    category_id: input.category_id ?? null,
    primary_author_id: input.primary_author_id ?? null,
    status: input.status ?? "draft",
    featured: Boolean(input.featured),
    start_date: input.start_date ?? null,
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  let row: StoryRow;
  if (input.id) {
    const { data, error } = await db()
      .from("stories")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    row = data as StoryRow;
  } else {
    const { data, error } = await db()
      .from("stories")
      .insert({ ...payload, created_by: user?.id ?? null })
      .select("*")
      .single();
    if (error) throw toAppError(error);
    row = data as StoryRow;
  }

  if (input.topic_ids) {
    await db().from("story_topics").delete().eq("story_id", row.id);
    if (input.topic_ids.length) {
      await db()
        .from("story_topics")
        .insert(input.topic_ids.map((topic_id) => ({ story_id: row.id, topic_id })));
    }
  }

  await writeAudit(
    input.id ? "story_updated" : "story_created",
    row.id,
    `Story ${input.id ? "updated" : "created"}: ${row.title}`,
  );
  return row;
}

export async function setStoryStatus(id: string, status: StoryStatus) {
  const { data, error } = await db()
    .from("stories")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit(`story_${status}`, id, `Story marked ${status}`);
  return data as StoryRow;
}

export async function addStoryItem(input: {
  story_id: string;
  content_type: StoryContentType;
  content_id: string;
  label?: string | null;
}) {
  const existing = await getStoryItems(input.story_id);
  const position = existing.length;
  const { data, error } = await db()
    .from("story_items")
    .upsert(
      {
        story_id: input.story_id,
        content_type: input.content_type,
        content_id: input.content_id,
        position,
        label: input.label ?? null,
      },
      { onConflict: "story_id,content_type,content_id" },
    )
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit("story_item_added", input.story_id, "Content attached to story", {
    content_type: input.content_type,
    content_id: input.content_id,
  });
  return data as StoryItemRow;
}

export async function removeStoryItem(id: string, storyId: string) {
  const { error } = await db().from("story_items").delete().eq("id", id);
  if (error) throw toAppError(error);
  await writeAudit("story_item_removed", storyId, "Content removed from story", { item_id: id });
}

export async function reorderStoryItems(storyId: string, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db().from("story_items").update({ position: index }).eq("id", id).eq("story_id", storyId),
    ),
  );
  await writeAudit("story_items_reordered", storyId, "Story coverage reordered", { orderedIds });
}

export async function listStoryTopicIds(storyId: string) {
  const { data, error } = await db()
    .from("story_topics")
    .select("topic_id")
    .eq("story_id", storyId);
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [] as string[];
    throw toAppError(error);
  }
  return ((data ?? []) as { topic_id: string }[]).map((r) => r.topic_id);
}

export async function getStoriesDashboard() {
  const rows = await listStories();
  return {
    total: rows.length,
    draft: rows.filter((r) => r.status === "draft").length,
    active: rows.filter((r) => r.status === "active").length,
    paused: rows.filter((r) => r.status === "paused").length,
    archived: rows.filter((r) => r.status === "archived").length,
    featured: rows.filter((r) => r.featured).length,
  };
}

/** Topics that link 2+ stories — real clusters, not mock groupings. */
export async function listStoryClusters() {
  const { data, error } = await db()
    .from("story_topics")
    .select("story_id, topic_id, topics(id,name,slug)");
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  const byTopic = new Map<
    string,
    { topicId: string; name: string; slug: string; storyIds: string[] }
  >();
  for (const row of data ?? []) {
    const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    if (!topic?.id) continue;
    const entry = byTopic.get(topic.id) ?? {
      topicId: topic.id,
      name: topic.name ?? "Topic",
      slug: topic.slug ?? topic.id,
      storyIds: [] as string[],
    };
    if (!entry.storyIds.includes(row.story_id)) entry.storyIds.push(row.story_id);
    byTopic.set(topic.id, entry);
  }
  const stories = await listStories();
  const storyMap = new Map(stories.map((s) => [s.id, s]));
  return [...byTopic.values()]
    .filter((c) => c.storyIds.length >= 2)
    .map((c) => ({
      ...c,
      stories: c.storyIds.map((id) => storyMap.get(id)).filter(Boolean) as StoryRow[],
    }))
    .sort((a, b) => b.stories.length - a.stories.length);
}

/** Stories with 2+ linked items — follow-up / continuing coverage. */
export async function listFollowUpStories() {
  const stories = await listStories();
  const results: Array<{ story: StoryRow; itemCount: number }> = [];
  for (const story of stories) {
    const items = await getStoryItems(story.id);
    if (items.length >= 2) results.push({ story, itemCount: items.length });
  }
  return results.sort((a, b) => b.itemCount - a.itemCount);
}

/** Stories that share at least one topic with another story. */
export async function listRelatedStoryPairs() {
  const clusters = await listStoryClusters();
  return clusters.flatMap((c) =>
    c.stories.map((story) => ({
      story,
      topicName: c.name,
      relatedCount: c.stories.length - 1,
      clusterTopicId: c.topicId,
    })),
  );
}

export async function resolveStoryItemTitles(items: StoryItemRow[]) {
  const byType = new Map<string, string[]>();
  for (const item of items) {
    const list = byType.get(item.content_type) ?? [];
    list.push(item.content_id);
    byType.set(item.content_type, list);
  }

  const titleMap = new Map<string, { title: string; href?: string; at?: string | null }>();

  const load = async (
    table: string,
    ids: string[],
    titleCol: string,
    slugCol?: string,
    dateCol?: string,
  ) => {
    if (!ids.length) return;
    const { data } = await db()
      .from(table)
      .select(`id,${titleCol}${slugCol ? `,${slugCol}` : ""}${dateCol ? `,${dateCol}` : ""}`)
      .in("id", ids);
    for (const row of data ?? []) {
      const title = String(row[titleCol] ?? "Untitled");
      const slug = slugCol ? row[slugCol] : null;
      titleMap.set(String(row.id), {
        title,
        href: slug
          ? table === "articles"
            ? `/article/${slug}`
            : table === "videos"
              ? `/video/${slug}`
              : table === "podcast_episodes"
                ? `/podcast/${slug}`
                : table === "infographics"
                  ? `/infographics/${slug}`
                  : table === "epaper_editions"
                    ? `/epaper/${slug}`
                    : undefined
          : undefined,
        at: dateCol ? row[dateCol] : null,
      });
    }
  };

  await Promise.all([
    load("articles", byType.get("article") ?? [], "title", "slug", "published_at"),
    load("videos", byType.get("video") ?? [], "title", "slug", "published_at"),
    load("podcast_episodes", byType.get("podcast") ?? [], "title", "slug", "published_at"),
    load("infographics", byType.get("infographic") ?? [], "title", "slug", "published_at"),
    load("epaper_editions", byType.get("epaper") ?? [], "title", "slug", "published_at"),
    load("breaking_news", byType.get("breaking_news") ?? [], "headline", undefined, "published_at"),
  ]);

  return items.map((item) => ({
    ...item,
    meta: titleMap.get(item.content_id) ?? {
      title: `${item.content_type} ${item.content_id.slice(0, 8)}…`,
    },
  }));
}
