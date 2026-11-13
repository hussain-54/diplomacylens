import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";
import { listScheduledChannels } from "@/lib/newsroom/social";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type CalendarItem = {
  id: string;
  title: string;
  at: string;
  kind: "article" | "social" | "event" | "deadline";
  href?: string;
  meta?: string;
};

export async function listEditorialEvents() {
  const { data, error } = await db()
    .from("editorial_events")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function upsertEditorialEvent(input: {
  id?: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  event_type?: "event" | "deadline" | "campaign";
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    title: input.title.trim(),
    description: input.description ?? null,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    event_type: input.event_type ?? "event",
    updated_at: new Date().toISOString(),
  };
  if (!payload.title) throw new Error("Title is required.");
  if (input.id) {
    const { data, error } = await db()
      .from("editorial_events")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data;
  }
  const { data, error } = await db()
    .from("editorial_events")
    .insert({ ...payload, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return data;
}

export async function getEditorialCalendarItems(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarItem[]> {
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const items: CalendarItem[] = [];

  const { data: articles, error: artErr } = await db()
    .from("articles")
    .select("id,title,slug,status,scheduled_at")
    .eq("status", "scheduled")
    .gte("scheduled_at", startIso)
    .lte("scheduled_at", endIso);
  if (artErr && !/schema cache|PGRST/i.test(artErr.message)) throw toAppError(artErr);
  for (const a of articles ?? []) {
    if (!a.scheduled_at) continue;
    items.push({
      id: `article-${a.id}`,
      title: a.title,
      at: a.scheduled_at,
      kind: "article",
      href: `/admin/articles/${a.id}`,
      meta: "Scheduled article",
    });
  }

  try {
    const social = await listScheduledChannels(60);
    for (const row of social) {
      const at = row.scheduled_at as string | null;
      if (!at) continue;
      const t = new Date(at).getTime();
      if (t < rangeStart.getTime() || t > rangeEnd.getTime()) continue;
      items.push({
        id: `social-${row.id}`,
        title: (row.content as string)?.slice(0, 80) || `${row.platform} post`,
        at,
        kind: "social",
        href: "/admin/social/queue",
        meta: String(row.platform),
      });
    }
  } catch {
    // social tables may be absent
  }

  const events = await listEditorialEvents();
  for (const ev of events) {
    const at = ev.starts_at as string;
    const t = new Date(at).getTime();
    if (t < rangeStart.getTime() || t > rangeEnd.getTime()) continue;
    items.push({
      id: `event-${ev.id}`,
      title: ev.title,
      at,
      kind: ev.event_type === "deadline" ? "deadline" : "event",
      meta: ev.event_type,
    });
  }

  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
