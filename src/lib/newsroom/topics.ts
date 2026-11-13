import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";
import type { TopicRow, TopicStatus } from "@/lib/newsroom/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `topic-${Math.random().toString(36).slice(2, 8)}`;

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
    entity_type: "topic",
    entity_id: entityId,
    summary,
    payload,
  });
}

export async function listTopics(filters?: { status?: TopicStatus | TopicStatus[]; q?: string }) {
  let query = db().from("topics").select("*").order("name");
  if (Array.isArray(filters?.status)) query = query.in("status", filters.status);
  else if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.q?.trim()) query = query.ilike("name", `%${filters.q.trim()}%`);
  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [] as TopicRow[];
    throw toAppError(error);
  }
  return (data ?? []) as TopicRow[];
}

export async function getTopicById(id: string) {
  const { data, error } = await db().from("topics").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  return data as TopicRow | null;
}

export async function getTopicBySlug(slug: string) {
  const { data, error } = await db()
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return data as TopicRow | null;
}

export async function upsertTopic(input: {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  accent_color?: string | null;
  category_id?: string | null;
  parent_topic_id?: string | null;
  status?: TopicStatus;
  seo_title?: string | null;
  seo_description?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    name: input.name.trim(),
    slug: slugify(input.slug?.trim() || input.name),
    description: input.description ?? null,
    image_url: input.image_url ?? null,
    accent_color: input.accent_color ?? null,
    category_id: input.category_id ?? null,
    parent_topic_id: input.parent_topic_id ?? null,
    status: input.status ?? "active",
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await db()
      .from("topics")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    await writeAudit("topic_updated", input.id, `Topic updated: ${payload.name}`);
    return data as TopicRow;
  }

  const { data, error } = await db()
    .from("topics")
    .insert({ ...payload, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit("topic_created", data.id, `Topic created: ${payload.name}`);
  return data as TopicRow;
}

export async function attachContentTopic(topicId: string, contentType: string, contentId: string) {
  const { error } = await db()
    .from("content_topics")
    .upsert(
      { topic_id: topicId, content_type: contentType, content_id: contentId },
      { onConflict: "topic_id,content_type,content_id" },
    );
  if (error) throw toAppError(error);
  await writeAudit("topic_content_attached", topicId, "Content attached to topic", {
    contentType,
    contentId,
  });
}

export async function detachContentTopic(topicId: string, contentType: string, contentId: string) {
  const { error } = await db()
    .from("content_topics")
    .delete()
    .eq("topic_id", topicId)
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  if (error) throw toAppError(error);
}

export async function listContentForTopic(topicId: string) {
  const { data, error } = await db()
    .from("content_topics")
    .select("*")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function listTopicsForContent(contentType: string, contentId: string) {
  const { data, error } = await db()
    .from("content_topics")
    .select("topic_id, topics(*)")
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [] as TopicRow[];
    throw toAppError(error);
  }
  return ((data ?? []) as { topics: TopicRow | TopicRow[] | null }[])
    .map((row) => (Array.isArray(row.topics) ? row.topics[0] : row.topics))
    .filter(Boolean) as TopicRow[];
}

export async function setArticleTopics(articleId: string, topicIds: string[]) {
  await db()
    .from("content_topics")
    .delete()
    .eq("content_type", "article")
    .eq("content_id", articleId);
  if (topicIds.length) {
    await db()
      .from("content_topics")
      .insert(
        topicIds.map((topic_id) => ({ topic_id, content_type: "article", content_id: articleId })),
      );
  }
}

export async function getTopicsDashboard() {
  const rows = await listTopics();
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
    archived: rows.filter((r) => r.status === "archived").length,
  };
}

/** Topics ranked by attached content + story links (real counts only). */
export async function listTrendingTopics(limit = 20) {
  const topics = await listTopics({ status: "active" });
  const { data: contentLinks, error: cErr } = await db().from("content_topics").select("topic_id");
  if (cErr && !/schema cache|PGRST|relation/i.test(cErr.message)) throw toAppError(cErr);
  const { data: storyLinks, error: sErr } = await db().from("story_topics").select("topic_id");
  if (sErr && !/schema cache|PGRST|relation/i.test(sErr.message)) throw toAppError(sErr);
  const counts = new Map<string, number>();
  for (const row of contentLinks ?? [])
    counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  for (const row of storyLinks ?? []) counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  return topics
    .map((t) => ({ topic: t, attachments: counts.get(t.id) ?? 0 }))
    .sort((a, b) => b.attachments - a.attachments)
    .slice(0, limit);
}
