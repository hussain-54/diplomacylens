import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";
import {
  DEFAULT_BREAKING_SETTINGS,
  priorityRank,
  type BreakingNewsRow,
  type BreakingNewsSettings,
  type BreakingPriority,
  type BreakingStatus,
  type BreakingType,
} from "@/lib/breaking-news/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

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
    entity_type: "breaking_news",
    entity_id: entityId,
    summary,
    payload,
  });
}

export async function getBreakingNewsSettings(): Promise<BreakingNewsSettings> {
  const { data, error } = await db()
    .from("breaking_news_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message))
      return DEFAULT_BREAKING_SETTINGS;
    throw toAppError(error);
  }
  return (data as BreakingNewsSettings) ?? DEFAULT_BREAKING_SETTINGS;
}

export async function updateBreakingNewsSettings(patch: Partial<BreakingNewsSettings>) {
  const { data, error } = await db()
    .from("breaking_news_settings")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit(
    "breaking_news_settings_updated",
    "1",
    "Breaking news settings updated",
    patch as Record<string, unknown>,
  );
  return data as BreakingNewsSettings;
}

export async function listBreakingNewsAdmin(filters?: {
  status?: BreakingStatus | BreakingStatus[] | "active";
  q?: string;
}): Promise<BreakingNewsRow[]> {
  // Keep window fresh for scheduled/expired transitions
  try {
    await db().rpc("publish_due_breaking_news");
  } catch {
    /* optional until migration applied */
  }

  let query = db()
    .from("breaking_news")
    .select("*")
    .order("priority_rank")
    .order("sort_order")
    .order("updated_at", { ascending: false });

  if (filters?.status === "active") {
    query = query.eq("status", "published");
  } else if (Array.isArray(filters?.status)) {
    query = query.in("status", filters.status);
  } else if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.q?.trim()) query = query.ilike("headline", `%${filters.q.trim()}%`);

  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [];
    throw toAppError(error);
  }

  const rows = (data ?? []) as BreakingNewsRow[];
  if (filters?.status === "active") {
    const now = Date.now();
    return rows.filter(
      (r) =>
        (!r.starts_at || new Date(r.starts_at).getTime() <= now) &&
        (!r.expires_at || new Date(r.expires_at).getTime() > now),
    );
  }
  return rows;
}

export async function getBreakingNewsById(id: string): Promise<BreakingNewsRow | null> {
  const { data, error } = await db().from("breaking_news").select("*").eq("id", id).maybeSingle();
  if (error) throw toAppError(error);
  return data as BreakingNewsRow | null;
}

export async function listPublicBreakingNews(limit = 40) {
  const { data, error } = await db()
    .from("breaking_news")
    .select("*, articles(slug,title,hero_image_url)")
    .eq("status", "published")
    .order("priority_rank")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [];
    throw toAppError(error);
  }
  const now = Date.now();
  return (
    (data ?? []) as (BreakingNewsRow & {
      articles?: {
        slug?: string | null;
        title?: string | null;
        hero_image_url?: string | null;
      } | null;
    })[]
  ).filter((r) => !r.starts_at || new Date(r.starts_at).getTime() <= now);
}

export async function getActiveBreakingNews(
  limit = 20,
): Promise<(BreakingNewsRow & { articles?: { slug?: string | null } | null })[]> {
  const { data, error } = await db()
    .from("breaking_news")
    .select(
      "id,headline,priority,priority_rank,sort_order,status,published_at,starts_at,expires_at,show_on_ticker,show_on_homepage_alert,articles(slug)",
    )
    .eq("status", "published")
    .order("priority_rank")
    .order("sort_order")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (/schema cache|PGRST|relation|does not exist|column/i.test(error.message)) {
      const rpc = await db().rpc("get_active_breaking_news", { p_limit: limit });
      if (rpc.error) {
        const fallback = await db()
          .from("breaking_news")
          .select("*, articles(slug)")
          .eq("status", "published")
          .order("priority_rank")
          .order("sort_order")
          .order("published_at", { ascending: false })
          .limit(limit);
        if (fallback.error) return [];
        const now = Date.now();
        return (
          (fallback.data ?? []) as (BreakingNewsRow & {
            articles?: { slug?: string | null } | null;
          })[]
        ).filter(
          (r) =>
            (!r.starts_at || new Date(r.starts_at).getTime() <= now) &&
            (!r.expires_at || new Date(r.expires_at).getTime() > now),
        );
      }
      return (rpc.data ?? []) as BreakingNewsRow[];
    }
    throw toAppError(error);
  }

  const now = Date.now();
  return (
    (data ?? []) as (BreakingNewsRow & { articles?: { slug?: string | null } | null })[]
  ).filter(
    (r) =>
      (!r.starts_at || new Date(r.starts_at).getTime() <= now) &&
      (!r.expires_at || new Date(r.expires_at).getTime() > now),
  );
}

export type BreakingNewsInput = {
  id?: string;
  headline: string;
  description?: string | null;
  category_id?: string | null;
  article_id?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | "audio" | null;
  breaking_type?: BreakingType;
  priority?: BreakingPriority;
  status?: BreakingStatus;
  sort_order?: number;
  starts_at?: string | null;
  expires_at?: string | null;
  show_on_ticker?: boolean;
  show_on_homepage_alert?: boolean;
  notification_enabled?: boolean;
};

export async function upsertBreakingNews(input: BreakingNewsInput): Promise<BreakingNewsRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const priority = input.priority ?? "normal";
  const payload = {
    headline: input.headline.trim(),
    description: input.description ?? null,
    category_id: input.category_id || null,
    article_id: input.article_id || null,
    media_url: input.media_url || null,
    media_type: input.media_type || null,
    breaking_type:
      input.breaking_type ?? (input.article_id ? "article" : input.media_url ? "media" : "simple"),
    priority,
    priority_rank: priorityRank(priority),
    status: input.status ?? "draft",
    sort_order: input.sort_order ?? 0,
    starts_at: input.starts_at ?? null,
    expires_at: input.expires_at ?? null,
    show_on_ticker: input.show_on_ticker ?? true,
    show_on_homepage_alert: input.show_on_homepage_alert ?? true,
    notification_enabled: input.notification_enabled ?? false,
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await db()
      .from("breaking_news")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    await writeAudit("breaking_news_edited", input.id, "Breaking news updated");
    return data as BreakingNewsRow;
  }

  const { data, error } = await db()
    .from("breaking_news")
    .insert({ ...payload, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit("breaking_news_created", data.id, "Breaking news created");
  return data as BreakingNewsRow;
}

export async function publishBreakingNewsNow(id: string, sendPush = false) {
  const { data, error } = await db().rpc("publish_breaking_news_now", {
    p_id: id,
    p_send_push: sendPush,
  });
  if (error) throw toAppError(error);
  return data as { ok: boolean; id: string; notification_job_id?: string };
}

export async function scheduleBreakingNews(
  id: string,
  startsAt: string,
  expiresAt?: string | null,
) {
  const { data, error } = await db()
    .from("breaking_news")
    .update({
      status: "scheduled",
      starts_at: startsAt,
      expires_at: expiresAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit("breaking_news_scheduled", id, "Breaking news scheduled", {
    starts_at: startsAt,
    expires_at: expiresAt,
  });
  return data as BreakingNewsRow;
}

export async function setBreakingNewsStatus(id: string, status: BreakingStatus) {
  const { data, error } = await db()
    .from("breaking_news")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await writeAudit(`breaking_news_${status}`, id, `Breaking news marked ${status}`);
  return data as BreakingNewsRow;
}

export async function reorderBreakingNews(ids: string[]) {
  await Promise.all(
    ids.map((id, index) =>
      db()
        .from("breaking_news")
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq("id", id),
    ),
  );
  await writeAudit("breaking_news_reordered", null, "Breaking news reordered", { ids });
}

export async function deleteBreakingNews(id: string) {
  const { error } = await db().from("breaking_news").delete().eq("id", id);
  if (error) throw toAppError(error);
  await writeAudit("breaking_news_deleted", id, "Breaking news deleted");
}

export async function sendBreakingNewsUpdateNotification(id: string) {
  const row = await getBreakingNewsById(id);
  if (!row) throw new Error("Not found");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: job, error } = await db()
    .from("breaking_news_notification_jobs")
    .insert({
      breaking_news_id: id,
      status: "pending",
      payload: {
        title: "BREAKING NEWS UPDATE",
        body: row.headline,
        breaking_news_id: id,
        article_id: row.article_id,
        update: true,
      },
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await db()
    .from("breaking_news")
    .update({
      notification_enabled: true,
      notification_sent: true,
      notification_sent_at: new Date().toISOString(),
      notification_id: job.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  await writeAudit("breaking_news_push_update", id, "Update push notification queued", {
    job_id: job.id,
  });
  return job;
}

export async function listNotificationJobs() {
  const { data, error } = await db()
    .from("breaking_news_notification_jobs")
    .select("*, breaking_news(headline)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function getBreakingNewsDashboard() {
  const rows = await listBreakingNewsAdmin();
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const active = rows.filter(
    (r) =>
      r.status === "published" &&
      (!r.starts_at || new Date(r.starts_at).getTime() <= now) &&
      (!r.expires_at || new Date(r.expires_at).getTime() > now),
  );
  const jobs = await listNotificationJobs();
  return {
    active: active.length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    expired: rows.filter((r) => r.status === "expired").length,
    drafts: rows.filter((r) => r.status === "draft").length,
    publishedToday: rows.filter((r) => r.published_at && new Date(r.published_at) >= startOfDay)
      .length,
    totalViews: rows.reduce((s, r) => s + (r.view_count ?? 0), 0),
    totalClicks: rows.reduce((s, r) => s + (r.click_count ?? 0), 0),
    notificationCount: jobs.filter(
      (j: { status: string }) => j.status === "sent" || j.status === "pending",
    ).length,
    avgEngagement:
      rows.length === 0
        ? 0
        : Math.round(
            (rows.reduce((s, r) => s + (r.click_count ?? 0), 0) /
              Math.max(
                rows.reduce((s, r) => s + (r.view_count ?? 0), 0),
                1,
              )) *
              1000,
          ) / 10,
  };
}

export async function trackBreakingNewsEvent(
  id: string,
  eventType: "view" | "click" | "ticker_impression" | "alert_impression" | "notification_open",
) {
  // Public ticker/alert impressions: events table only.
  // Updating view_count here triggered Realtime UPDATE → invalidate → refetch storms on `/`.
  if (eventType === "ticker_impression" || eventType === "alert_impression") {
    await db().from("breaking_news_events").insert({ breaking_news_id: id, event_type: eventType });
    return;
  }

  if (eventType === "notification_open") {
    await db().from("breaking_news_events").insert({ breaking_news_id: id, event_type: eventType });
    return;
  }

  const counter = eventType === "click" ? "click_count" : "view_count";

  const [, current] = await Promise.all([
    db().from("breaking_news_events").insert({ breaking_news_id: id, event_type: eventType }),
    db().from("breaking_news").select(counter).eq("id", id).maybeSingle(),
  ]);
  const row = current.data as Record<string, number | null> | null;
  if (!row) return;
  await db()
    .from("breaking_news")
    .update({ [counter]: (row[counter] ?? 0) + 1 })
    .eq("id", id);
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export async function getBreakingNewsAnalytics(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, days));
  const sinceIso = since.toISOString();

  const rows = await listBreakingNewsAdmin();
  const jobs = await listNotificationJobs();

  const { data: events, error } = await db()
    .from("breaking_news_events")
    .select("id,breaking_news_id,event_type,created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error && !/schema cache|PGRST|relation|does not exist/i.test(error.message))
    throw toAppError(error);

  const eventRows = (events ?? []) as {
    id: string;
    breaking_news_id: string;
    event_type: string;
    created_at: string;
  }[];

  const seriesMap = new Map<
    string,
    { date: string; views: number; clicks: number; impressions: number }
  >();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    seriesMap.set(key, { date: key, views: 0, clicks: 0, impressions: 0 });
  }

  const byType: Record<string, number> = {};
  for (const ev of eventRows) {
    byType[ev.event_type] = (byType[ev.event_type] ?? 0) + 1;
    const key = dayKey(ev.created_at);
    const bucket = seriesMap.get(key);
    if (!bucket) continue;
    if (ev.event_type === "click") bucket.clicks += 1;
    else if (ev.event_type === "ticker_impression" || ev.event_type === "alert_impression")
      bucket.impressions += 1;
    else if (ev.event_type === "view" || ev.event_type === "notification_open") bucket.views += 1;
  }

  const topItems = [...rows]
    .sort(
      (a, b) =>
        (b.view_count ?? 0) + (b.click_count ?? 0) - ((a.view_count ?? 0) + (a.click_count ?? 0)),
    )
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      headline: r.headline,
      status: r.status,
      views: r.view_count ?? 0,
      clicks: r.click_count ?? 0,
      ctr:
        (r.view_count ?? 0) > 0
          ? Math.round(((r.click_count ?? 0) / (r.view_count ?? 1)) * 1000) / 10
          : 0,
    }));

  const totalViews = rows.reduce((s, r) => s + (r.view_count ?? 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (r.click_count ?? 0), 0);

  return {
    days,
    totals: {
      views: totalViews,
      clicks: totalClicks,
      events: eventRows.length,
      notificationsSent: jobs.filter((j: { status: string }) => j.status === "sent").length,
      notificationsPending: jobs.filter((j: { status: string }) => j.status === "pending").length,
      ctr: totalViews > 0 ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0,
    },
    series: [...seriesMap.values()],
    eventBreakdown: Object.entries(byType).map(([label, value]) => ({ label, value })),
    topItems,
  };
}

export async function listBreakingNewsActivityLogs(limit = 150) {
  const { data, error } = await db()
    .from("admin_audit_logs")
    .select(
      "id,action,entity_type,entity_id,summary,payload,created_at,actor_id,profiles(name,email)",
    )
    .eq("entity_type", "breaking_news")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const legacy = await db()
      .from("admin_audit_logs")
      .select("id,action,entity_type,entity_id,summary,payload,created_at,actor_id")
      .order("created_at", { ascending: false })
      .limit(400);
    if (legacy.error) {
      if (/admin_audit_logs|schema cache|PGRST/i.test(error.message)) return [];
      throw toAppError(error);
    }
    return ((legacy.data ?? []) as { action?: string; entity_type?: string }[]).filter(
      (row) =>
        row.entity_type === "breaking_news" ||
        (typeof row.action === "string" && row.action.startsWith("breaking_news")),
    );
  }
  return data ?? [];
}
