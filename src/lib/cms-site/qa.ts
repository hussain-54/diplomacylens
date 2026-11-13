import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export async function listQaSuites() {
  const { data, error } = await db()
    .from("qa_test_suites")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function listQaCases(suiteId?: string) {
  let query = db().from("qa_test_cases").select("*").order("updated_at", { ascending: false });
  if (suiteId) query = query.eq("suite_id", suiteId);
  const { data, error } = await query;
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function listQaBugs() {
  const { data, error } = await db()
    .from("qa_bugs")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
}

export async function getQaDashboard() {
  const [suites, cases, bugs] = await Promise.all([listQaSuites(), listQaCases(), listQaBugs()]);
  return {
    suites: suites.length,
    cases: cases.length,
    passed: cases.filter((c: { status: string }) => c.status === "passed").length,
    failed: cases.filter((c: { status: string }) => c.status === "failed").length,
    openBugs: bugs.filter(
      (b: { status: string }) => b.status === "open" || b.status === "in_progress",
    ).length,
  };
}

export async function upsertQaCase(input: {
  id?: string;
  title: string;
  steps?: string | null;
  expected_result?: string | null;
  status?: string;
  priority?: string;
  suite_id?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    title: input.title.trim(),
    steps: input.steps ?? null,
    expected_result: input.expected_result ?? null,
    status: input.status ?? "draft",
    priority: input.priority ?? "medium",
    suite_id: input.suite_id ?? null,
    updated_at: new Date().toISOString(),
  };
  if (!payload.title) throw new Error("Title is required.");
  if (input.id) {
    const { data, error } = await db()
      .from("qa_test_cases")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data;
  }
  const { data, error } = await db()
    .from("qa_test_cases")
    .insert({ ...payload, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return data;
}

export async function upsertQaBug(input: {
  id?: string;
  title: string;
  description?: string | null;
  severity?: string;
  status?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    title: input.title.trim(),
    description: input.description ?? null,
    severity: input.severity ?? "medium",
    status: input.status ?? "open",
    updated_at: new Date().toISOString(),
  };
  if (!payload.title) throw new Error("Title is required.");
  if (input.id) {
    const { data, error } = await db()
      .from("qa_bugs")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data;
  }
  const { data, error } = await db()
    .from("qa_bugs")
    .insert({ ...payload, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return data;
}

export async function createQaSignoff(releaseLabel: string, notes?: string, approved = false) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await db()
    .from("qa_signoffs")
    .insert({
      release_label: releaseLabel.trim(),
      notes: notes ?? null,
      approved,
      approved_by: approved ? (user?.id ?? null) : null,
      approved_at: approved ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw toAppError(error);
  return data;
}
