import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type TipStatus =
  "new" | "unreviewed" | "investigation" | "verified" | "rejected" | "anonymous";

export type NewsTip = {
  id: string;
  title: string;
  body: string | null;
  status: TipStatus;
  source_name: string | null;
  source_contact: string | null;
  is_anonymous: boolean;
  location: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

async function audit(
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
    entity_type: "news_tip",
    entity_id: entityId,
    summary,
    payload,
  });
}

export async function listNewsTips(filters?: { status?: TipStatus | TipStatus[] }) {
  let query = db().from("news_tips").select("*").order("updated_at", { ascending: false });
  if (Array.isArray(filters?.status)) query = query.in("status", filters.status);
  else if (filters?.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [] as NewsTip[];
    throw toAppError(error);
  }
  return (data ?? []) as NewsTip[];
}

export async function getTipsDashboard() {
  const rows = await listNewsTips();
  return {
    total: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    unreviewed: rows.filter((r) => r.status === "unreviewed" || r.status === "new").length,
    investigation: rows.filter((r) => r.status === "investigation").length,
    verified: rows.filter((r) => r.status === "verified").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    anonymous: rows.filter((r) => r.is_anonymous || r.status === "anonymous").length,
  };
}

export async function upsertNewsTip(input: {
  id?: string;
  title: string;
  body?: string | null;
  status?: TipStatus;
  source_name?: string | null;
  source_contact?: string | null;
  is_anonymous?: boolean;
  location?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    title: input.title.trim(),
    body: input.body ?? null,
    status: input.status ?? "new",
    source_name: input.source_name ?? null,
    source_contact: input.source_contact ?? null,
    is_anonymous: Boolean(input.is_anonymous),
    location: input.location ?? null,
    updated_at: new Date().toISOString(),
  };
  if (!payload.title) throw new Error("Title is required.");

  if (input.id) {
    const { data, error } = await db()
      .from("news_tips")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    await audit("tip_updated", input.id, `Tip updated: ${payload.title}`);
    return data as NewsTip;
  }

  const { data, error } = await db()
    .from("news_tips")
    .insert({ ...payload, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await audit("tip_created", data.id, `Tip created: ${payload.title}`);
  return data as NewsTip;
}

export async function setTipStatus(id: string, status: TipStatus) {
  const { data, error } = await db()
    .from("news_tips")
    .update({
      status,
      reviewed_at: ["verified", "rejected"].includes(status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toAppError(error);
  await audit("tip_status_changed", id, `Tip status → ${status}`, { status });
  return data as NewsTip;
}

export async function listTipSources() {
  const { data, error } = await db().from("news_tip_sources").select("*").order("name");
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function upsertTipSource(input: {
  id?: string;
  name: string;
  organization?: string | null;
  contact?: string | null;
  notes?: string | null;
}) {
  const payload = {
    name: input.name.trim(),
    organization: input.organization ?? null,
    contact: input.contact ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (!payload.name) throw new Error("Source name is required.");
  if (input.id) {
    const { data, error } = await db()
      .from("news_tip_sources")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data;
  }
  const { data, error } = await db().from("news_tip_sources").insert(payload).select("*").single();
  if (error) throw toAppError(error);
  return data;
}
