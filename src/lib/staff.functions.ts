import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toAppError } from "@/lib/db-errors";
import {
  APP_ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  hasPermission,
  isAppRole,
  type AppRole,
} from "@/lib/permissions";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type StaffListFilters = {
  search?: string;
  role?: AppRole | null;
  department_id?: string | null;
  team_id?: string | null;
  bureau_id?: string | null;
  job_title_id?: string | null;
  status?: "all" | "active" | "suspended" | "invited" | "pending" | "archived" | "deleted";
  joined_from?: string | null;
  joined_to?: string | null;
  last_login_from?: string | null;
  last_login_to?: string | null;
  page?: number;
  pageSize?: number;
  sort?: "name" | "created" | "activity" | "login";
  sortDir?: "asc" | "desc";
};

export type StaffWizardPayload = {
  id?: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  byline_name?: string;
  designation?: string;
  location?: string;
  department_id?: string | null;
  team_id?: string | null;
  bureau_id?: string | null;
  job_title_id?: string | null;
  manager_id?: string | null;
  employment_type?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  nationality?: string | null;
  bio?: string;
  social_links?: Record<string, string>;
  roles?: AppRole[];
  section_ids?: string[];
  status?: "active" | "invited" | "pending" | "suspended" | "archived";
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "item-" + Math.random().toString(36).slice(2, 8);

const checkAuth = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized — please sign in again.");
  return user;
};

const requireStaffManage = async () => {
  const user = await checkAuth();
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) throw toAppError(error);
  const roleList = (roles ?? []).map((r) => r.role);
  if (!hasPermission(roleList, "staff:manage")) {
    throw new Error("Forbidden — missing staff:manage permission.");
  }
  return { user, roles: roleList };
};

const writeStaffActivity = async (entry: {
  actor_id: string;
  subject_id?: string | null;
  action: string;
  details?: string | null;
  payload?: Record<string, unknown>;
}) => {
  const { error } = await supabase.from("staff_activity_logs").insert({
    actor_id: entry.actor_id,
    subject_id: entry.subject_id ?? null,
    action: entry.action,
    details: entry.details ?? null,
    payload: (entry.payload ?? {}) as Json,
  });
  if (error && !/staff_activity_logs|schema cache|PGRST/i.test(error.message)) {
    console.error("Staff activity log failed", error);
  }
};

const STAFF_API_UNAVAILABLE =
  "Staff invite, suspend, password reset, and MFA lookup require the /api/staff serverless endpoint (Vercel). This action is unavailable on static cPanel hosting alone. Other staff profile and role tools still work via Supabase.";

const staffApi = async (payload: Record<string, unknown>) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required.");
  let response: Response;
  try {
    response = await fetch("/api/staff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(STAFF_API_UNAVAILABLE);
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 404 || !contentType.includes("application/json")) {
    throw new Error(STAFF_API_UNAVAILABLE);
  }
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    user_id?: string;
  };
  if (!response.ok) throw new Error(body.error || "Staff administration request failed.");
  return body;
};

async function loadStaffBase(opts?: { includeDeleted?: boolean }) {
  const [profilesRes, rolesRes, accessRes, deptsRes, teamsRes, bureausRes, titlesRes] =
    await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("user_roles").select("*"),
      supabase.from("editor_section_access").select("*"),
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("bureaus").select("*").order("sort_order"),
      supabase.from("job_titles").select("*").order("sort_order"),
    ]);
  if (profilesRes.error) throw toAppError(profilesRes.error);
  if (rolesRes.error) throw toAppError(rolesRes.error);
  if (accessRes.error) throw toAppError(accessRes.error);

  const departments = deptsRes.error ? [] : (deptsRes.data ?? []);
  const teams = teamsRes.error ? [] : (teamsRes.data ?? []);
  const bureaus = bureausRes.error ? [] : (bureausRes.data ?? []);
  const jobTitles = titlesRes.error ? [] : (titlesRes.data ?? []);
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const bureauMap = new Map(bureaus.map((b) => [b.id, b]));
  const titleMap = new Map(jobTitles.map((t) => [t.id, t]));
  const roles = rolesRes.data ?? [];
  const access = accessRes.data ?? [];

  const { data: articleCounts } = await supabase
    .from("articles")
    .select("author_id, status")
    .not("author_id", "is", null);

  const publishedByAuthor = new Map<string, number>();
  const draftByAuthor = new Map<string, number>();
  for (const a of articleCounts ?? []) {
    if (!a.author_id) continue;
    if (a.status === "published") {
      publishedByAuthor.set(a.author_id, (publishedByAuthor.get(a.author_id) ?? 0) + 1);
    } else if (a.status === "draft") {
      draftByAuthor.set(a.author_id, (draftByAuthor.get(a.author_id) ?? 0) + 1);
    }
  }

  const ONLINE_MS = 15 * 60 * 1000;
  const now = Date.now();

  let profiles = profilesRes.data ?? [];
  if (!opts?.includeDeleted) {
    profiles = profiles.filter((p) => !(p as { deleted_at?: string | null }).deleted_at);
  }

  const staff = profiles.map((p) => {
    const memberRoles = roles
      .filter((r) => r.user_id === p.id)
      .map((r) => r.role)
      .filter(isAppRole);
    const published = publishedByAuthor.get(p.id) ?? 0;
    const drafts = draftByAuthor.get(p.id) ?? 0;
    const activity = Math.min(100, published * 8 + drafts * 2 + memberRoles.length * 5);
    const deletedAt = (p as { deleted_at?: string | null }).deleted_at ?? null;
    const bureauId = (p as { bureau_id?: string | null }).bureau_id ?? null;
    const jobTitleId = (p as { job_title_id?: string | null }).job_title_id ?? null;
    const rawStatus = p.status;
    const status = deletedAt
      ? ("deleted" as const)
      : rawStatus === "suspended" ||
          rawStatus === "invited" ||
          rawStatus === "pending" ||
          rawStatus === "archived"
        ? rawStatus
        : ("active" as const);
    const lastLogin = p.last_login_at ? new Date(p.last_login_at).getTime() : 0;
    return {
      ...p,
      deleted_at: deletedAt,
      bureau_id: bureauId,
      job_title_id: jobTitleId,
      roles: memberRoles,
      section_ids: access.filter((a) => a.profile_id === p.id).map((a) => a.section_id),
      department_name: p.department_id ? (deptMap.get(p.department_id)?.name ?? null) : null,
      team_name: p.team_id ? (teamMap.get(p.team_id)?.name ?? null) : null,
      bureau_name: bureauId ? (bureauMap.get(bureauId)?.name ?? null) : null,
      job_title_name: jobTitleId ? (titleMap.get(jobTitleId)?.title ?? null) : null,
      published_count: published,
      draft_count: drafts,
      activity_score: p.activity_score || activity,
      status,
      is_online: Boolean(lastLogin && now - lastLogin <= ONLINE_MS),
      social_links:
        p.social_links && typeof p.social_links === "object" && !Array.isArray(p.social_links)
          ? (p.social_links as Record<string, string>)
          : {},
    };
  });

  return { staff, departments, teams, bureaus, jobTitles, roles, access };
}

export const getStaffDashboard = async () => {
  await requireStaffManage();
  const { staff } = await loadStaffBase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const living = staff.filter((s) => s.status !== "deleted");
  const total = living.length;
  const active = living.filter((s) => s.status === "active").length;
  const invited = living.filter((s) => s.status === "invited" || s.status === "pending").length;
  const suspended = living.filter((s) => s.status === "suspended").length;
  const archived = living.filter((s) => s.status === "archived").length;
  const online = living.filter((s) => s.is_online).length;
  const journalists = living.filter((s) => s.roles.includes("reporter")).length;
  const editors = living.filter((s) =>
    s.roles.some((r) => ["editor_in_chief", "managing_editor", "section_editor"].includes(r)),
  ).length;
  const contributors = living.filter((s) => s.roles.includes("contributor")).length;

  const thisMonth = living.filter((s) => new Date(s.created_at) >= monthStart).length;
  const lastMonth = living.filter((s) => {
    const d = new Date(s.created_at);
    return d >= prevMonthStart && d < monthStart;
  }).length;
  const growthPct =
    lastMonth === 0
      ? thisMonth > 0
        ? 100
        : 0
      : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

  const byRole = APP_ROLES.map((role) => ({
    label: ROLE_LABELS[role],
    value: living.filter((s) => s.roles.includes(role)).length,
  })).filter((r) => r.value > 0);

  const roleTotal = byRole.reduce((s, r) => s + r.value, 0) || 1;
  const byRoleWithPct = byRole.map((r) => ({
    ...r,
    percent: Math.round((r.value / roleTotal) * 100),
  }));

  const statusDistribution = [
    { label: "Active", value: active },
    { label: "Pending", value: invited },
    { label: "Suspended", value: suspended },
    { label: "Archived", value: archived },
  ].filter((s) => s.value > 0);

  const recentRegistrations = [...living]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      name: s.name ?? s.email ?? "Unknown",
      email: s.email,
      status: s.status,
      created_at: s.created_at,
      avatar_url: s.avatar_url,
    }));

  const topAuthors = [...living]
    .sort((a, b) => b.published_count - a.published_count)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      name: s.name ?? s.email ?? "Unknown",
      published: s.published_count,
      activity: s.activity_score,
    }));

  const growthTrend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return {
      label: d.toLocaleString(undefined, { month: "short" }),
      value: living.filter((s) => {
        const c = new Date(s.created_at);
        return c >= d && c < next;
      }).length,
    };
  });

  const deptBreakdown = Array.from(
    living.reduce((map, s) => {
      const key = s.department_name ?? "Unassigned";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([label, value]) => ({ label, value }));

  const { data: recentActivity } = await supabase
    .from("staff_activity_logs")
    .select("id, actor_id, subject_id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  const actorIds = [
    ...new Set(
      (recentActivity ?? [])
        .flatMap((r) => [r.actor_id, r.subject_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map(
    living.filter((s) => actorIds.includes(s.id)).map((s) => [s.id, s.name ?? s.email ?? "User"]),
  );
  if (actorIds.length) {
    const missing = actorIds.filter((id) => !nameById.has(id));
    if (missing.length) {
      const { data: extras } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", missing);
      for (const p of extras ?? []) {
        nameById.set(p.id, p.name ?? p.email ?? "User");
      }
    }
  }

  return {
    kpis: {
      total,
      active,
      pending: invited,
      blocked: suspended,
      suspended,
      archived,
      online,
      newThisMonth: thisMonth,
      journalists,
      editors,
      contributors,
      subscribers: 0,
      growthPct,
    },
    byRole: byRoleWithPct,
    statusDistribution,
    recentRegistrations,
    topAuthors,
    growthTrend,
    deptBreakdown,
    recentActivity: (recentActivity ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      details: r.details,
      created_at: r.created_at,
      actor_name: r.actor_id ? (nameById.get(r.actor_id) ?? null) : null,
      subject_name: r.subject_id ? (nameById.get(r.subject_id) ?? null) : null,
    })),
  };
};

export const listStaffTable = async ({ data }: { data: StaffListFilters }) => {
  await requireStaffManage();
  const page = data.page ?? 1;
  const pageSize = [10, 25, 50, 100].includes(data.pageSize ?? 25) ? (data.pageSize ?? 25) : 25;
  const includeDeleted = data.status === "deleted";
  const { staff } = await loadStaffBase({ includeDeleted });
  let rows = [...staff];

  if (!includeDeleted) {
    rows = rows.filter((s) => s.status !== "deleted");
  } else {
    rows = rows.filter((s) => s.status === "deleted");
  }

  if (data.search?.trim()) {
    const q = data.search.trim().toLowerCase();
    rows = rows.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.username ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.national_id ?? "").toLowerCase().includes(q),
    );
  }
  if (data.role) rows = rows.filter((s) => s.roles.includes(data.role!));
  if (data.department_id) rows = rows.filter((s) => s.department_id === data.department_id);
  if (data.team_id) rows = rows.filter((s) => s.team_id === data.team_id);
  if (data.bureau_id) rows = rows.filter((s) => s.bureau_id === data.bureau_id);
  if (data.job_title_id) rows = rows.filter((s) => s.job_title_id === data.job_title_id);
  if (data.status && data.status !== "all" && data.status !== "deleted") {
    if (data.status === "invited" || data.status === "pending") {
      rows = rows.filter((s) => s.status === "invited" || s.status === "pending");
    } else {
      rows = rows.filter((s) => s.status === data.status);
    }
  }
  if (data.joined_from) {
    const from = new Date(data.joined_from).getTime();
    rows = rows.filter((s) => new Date(s.created_at).getTime() >= from);
  }
  if (data.joined_to) {
    const to = new Date(data.joined_to).getTime();
    rows = rows.filter((s) => new Date(s.created_at).getTime() <= to);
  }
  if (data.last_login_from) {
    const from = new Date(data.last_login_from).getTime();
    rows = rows.filter((s) => s.last_login_at && new Date(s.last_login_at).getTime() >= from);
  }
  if (data.last_login_to) {
    const to = new Date(data.last_login_to).getTime();
    rows = rows.filter((s) => s.last_login_at && new Date(s.last_login_at).getTime() <= to);
  }

  const dir = data.sortDir === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    switch (data.sort) {
      case "activity":
        return (a.activity_score - b.activity_score) * dir;
      case "created":
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      case "login":
        return (
          (new Date(a.last_login_at ?? 0).getTime() - new Date(b.last_login_at ?? 0).getTime()) *
          dir
        );
      default:
        return (a.name ?? "").localeCompare(b.name ?? "") * dir;
    }
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const living = staff.filter((s) => s.status !== "deleted");
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    showingFrom: total === 0 ? 0 : start + 1,
    showingTo: Math.min(start + pageSize, total),
    stats: {
      total: living.length,
      active: living.filter((s) => s.status === "active").length,
      pending: living.filter((s) => s.status === "invited" || s.status === "pending").length,
      suspended: living.filter((s) => s.status === "suspended").length,
      newThisMonth: living.filter((s) => new Date(s.created_at) >= monthStart).length,
    },
  };
};

export const getStaffDetail = async ({ data }: { data: { id: string } }) => {
  await requireStaffManage();
  const { staff, departments, teams, bureaus, jobTitles } = await loadStaffBase({
    includeDeleted: true,
  });
  const member = staff.find((s) => s.id === data.id);
  if (!member) throw new Error("User not found.");

  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug, status, published_at")
    .eq("author_id", data.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(20);

  const { data: activity } = await supabase
    .from("staff_activity_logs")
    .select("*")
    .or(`subject_id.eq.${data.id},actor_id.eq.${data.id}`)
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    member,
    departments,
    teams,
    bureaus,
    jobTitles,
    articles: articles ?? [],
    activity: activity ?? [],
    stats: {
      published: member.published_count,
      drafts: member.draft_count,
      views: null as number | null,
      comments: null as number | null,
      seo: null as number | null,
      engagement: member.activity_score,
      lastLogin: member.last_login_at,
      loginCount: (member as { login_count?: number }).login_count ?? 0,
      isOnline: member.is_online,
    },
  };
};

export const updateStaffMemberProfile = async ({
  data,
}: {
  data: StaffWizardPayload & { id: string };
}) => {
  const { user } = await requireStaffManage();
  const payload = {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    username: data.username?.trim() || null,
    phone: data.phone?.trim() || null,
    byline_name: data.byline_name?.trim() || null,
    designation: data.designation?.trim() || null,
    location: data.location?.trim() || null,
    department_id: data.department_id || null,
    team_id: data.team_id || null,
    bureau_id: data.bureau_id || null,
    job_title_id: data.job_title_id || null,
    manager_id: data.manager_id || null,
    employment_type: data.employment_type?.trim() || null,
    gender: data.gender?.trim() || null,
    date_of_birth: data.date_of_birth || null,
    national_id: data.national_id?.trim() || null,
    nationality: data.nationality?.trim() || null,
    bio: data.bio?.trim() || null,
    social_links: (data.social_links ?? {}) as Json,
    ...(data.status ? { status: data.status } : {}),
  };
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw toAppError(error);

  if (data.roles) {
    const { data: existing } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);
    const current = new Set((existing ?? []).map((r) => r.role));
    const next = new Set(data.roles);
    for (const role of next) {
      if (!current.has(role)) {
        await supabase.from("user_roles").insert({ user_id: data.id, role });
      }
    }
    for (const role of current) {
      if (!next.has(role as AppRole) && isAppRole(role)) {
        await supabase.from("user_roles").delete().eq("user_id", data.id).eq("role", role);
      }
    }
  }

  await writeStaffActivity({
    actor_id: user.id,
    subject_id: data.id,
    action: "staff.update",
    details: `Updated ${payload.name}`,
  });
  return updated;
};

export const inviteStaffUser = async ({ data }: { data: StaffWizardPayload }) => {
  const { user } = await requireStaffManage();
  const role = data.roles?.[0] ?? "contributor";
  const result = await staffApi({
    action: "invite",
    email: data.email,
    name: data.name,
    byline_name: data.byline_name,
    role,
    section_ids: data.section_ids ?? [],
  });

  const inviteRow = {
    email: data.email.trim().toLowerCase(),
    invited_by: user.id,
    roles: data.roles?.length ? data.roles : [role],
    department_id: data.department_id || null,
    team_id: data.team_id || null,
    name: data.name,
    byline_name: data.byline_name || null,
    designation: data.designation || null,
    status: "pending" as const,
  };
  const { error: invError } = await supabase.from("staff_invitations").insert(inviteRow);
  if (invError && !/staff_invitations|schema cache|PGRST/i.test(invError.message)) {
    console.error(invError);
  }

  // Patch org fields on the invited profile when user id is known
  const orgPatch = {
    username: data.username || null,
    phone: data.phone || null,
    department_id: data.department_id || null,
    team_id: data.team_id || null,
    bureau_id: data.bureau_id || null,
    job_title_id: data.job_title_id || null,
    manager_id: data.manager_id || null,
    employment_type: data.employment_type || null,
    gender: data.gender || null,
    date_of_birth: data.date_of_birth || null,
    national_id: data.national_id || null,
    nationality: data.nationality || null,
    designation: data.designation || null,
    location: data.location || null,
    bio: data.bio || null,
  };
  if (result.user_id) {
    await supabase.from("profiles").update(orgPatch).eq("id", result.user_id);

    // Assign additional roles beyond the primary invite role
    for (const extra of data.roles ?? []) {
      if (extra === role) continue;
      await supabase
        .from("user_roles")
        .upsert(
          { user_id: result.user_id, role: extra },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
    }
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", data.email.trim().toLowerCase())
      .maybeSingle();
    if (profile?.id) {
      await supabase.from("profiles").update(orgPatch).eq("id", profile.id);
    }
  }

  await writeStaffActivity({
    actor_id: user.id,
    action: "staff.invite",
    details: `Invited ${data.email}`,
    payload: { role },
  });
  return result;
};

export const suspendStaffUser = async ({
  data,
}: {
  data: { user_id: string; suspended: boolean };
}) => {
  const { user } = await requireStaffManage();
  const result = await staffApi({
    action: data.suspended ? "suspend" : "unsuspend",
    user_id: data.user_id,
  });
  await writeStaffActivity({
    actor_id: user.id,
    subject_id: data.user_id,
    action: data.suspended ? "staff.suspend" : "staff.activate",
    details: data.suspended ? "User suspended" : "User activated",
  });
  return result;
};

export const resetStaffPassword = async ({ data }: { data: { email: string } }) => {
  const { user } = await requireStaffManage();
  const result = await staffApi({ action: "reset_password", email: data.email });
  await writeStaffActivity({
    actor_id: user.id,
    action: "staff.reset_password",
    details: `Password reset for ${data.email}`,
  });
  return result;
};

export const assignStaffRole = async ({
  data,
}: {
  data: { user_id: string; role: AppRole; grant: boolean };
}) => {
  const { user } = await requireStaffManage();
  if (data.grant) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error && error.code !== "23505" && !error.message.includes("duplicate"))
      throw toAppError(error);
  } else {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw toAppError(error);
  }
  await writeStaffActivity({
    actor_id: user.id,
    subject_id: data.user_id,
    action: data.grant ? "staff.role_grant" : "staff.role_revoke",
    details: `${data.grant ? "Granted" : "Revoked"} ${ROLE_LABELS[data.role]}`,
  });
  return { ok: true };
};

export const bulkStaffAction = async ({
  data,
}: {
  data: {
    ids: string[];
    action:
      | "activate"
      | "suspend"
      | "archive"
      | "restore"
      | "delete"
      | "assign_role"
      | "assign_team"
      | "assign_department"
      | "assign_bureau";
    role?: AppRole;
    team_id?: string | null;
    department_id?: string | null;
    bureau_id?: string | null;
    reason?: string;
  };
}) => {
  const { user } = await requireStaffManage();
  for (const id of data.ids) {
    if (data.action === "suspend" || data.action === "activate") {
      await staffApi({
        action: data.action === "suspend" ? "suspend" : "unsuspend",
        user_id: id,
      });
      if (data.action === "suspend") {
        await supabase
          .from("profiles")
          .update({
            suspended_at: new Date().toISOString(),
            suspended_by: user.id,
            suspension_reason: data.reason ?? null,
          })
          .eq("id", id);
      }
    } else if (data.action === "archive") {
      await supabase
        .from("profiles")
        .update({
          status: "archived",
          archive_reason: data.reason ?? null,
        })
        .eq("id", id);
    } else if (data.action === "restore") {
      await supabase
        .from("profiles")
        .update({
          status: "active",
          deleted_at: null,
          deleted_by: null,
          archive_reason: null,
        })
        .eq("id", id);
    } else if (data.action === "delete") {
      await supabase
        .from("profiles")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          status: "archived",
        })
        .eq("id", id);
    } else if (data.action === "assign_role" && data.role) {
      await supabase
        .from("user_roles")
        .upsert(
          { user_id: id, role: data.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
    } else if (data.action === "assign_team" || data.action === "assign_department") {
      await supabase
        .from("profiles")
        .update({
          team_id: data.team_id ?? undefined,
          department_id: data.department_id ?? undefined,
        })
        .eq("id", id);
    } else if (data.action === "assign_bureau") {
      await supabase
        .from("profiles")
        .update({ bureau_id: data.bureau_id || null })
        .eq("id", id);
    }
  }
  await writeStaffActivity({
    actor_id: user.id,
    action: `staff.bulk_${data.action}`,
    details: `${data.ids.length} users`,
    payload: { ids: data.ids, reason: data.reason },
  });
  return { ok: true };
};

export const exportStaffCsv = async ({
  data,
}: {
  data?: StaffListFilters;
} = {}) => {
  await requireStaffManage();
  const table = await listStaffTable({
    data: { ...(data ?? {}), page: 1, pageSize: 100 },
  });
  // Export up to first 5000 matching rows by paging
  const all: typeof table.items = [...table.items];
  for (let page = 2; page <= Math.min(table.totalPages, 50); page++) {
    const next = await listStaffTable({ data: { ...(data ?? {}), page, pageSize: 100 } });
    all.push(...next.items);
  }
  const headers = [
    "id",
    "name",
    "email",
    "username",
    "status",
    "roles",
    "department",
    "bureau",
    "job_title",
    "team",
    "created_at",
    "last_login_at",
  ];
  const lines = [
    headers.join(","),
    ...all.map((s) =>
      [
        s.id,
        s.name,
        s.email,
        s.username,
        s.status,
        s.roles.join("|"),
        s.department_name,
        s.bureau_name,
        s.job_title_name,
        s.team_name,
        s.created_at,
        s.last_login_at,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return { content: lines.join("\n"), filename: "staff-users.csv", mime: "text/csv" };
};

export const listDepartments = async () => {
  await requireStaffManage();
  const { data, error } = await supabase.from("departments").select("*").order("sort_order");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const listTeams = async () => {
  await requireStaffManage();
  const { data, error } = await supabase
    .from("teams")
    .select("*, departments(name, slug)")
    .order("sort_order");
  if (error) throw toAppError(error);
  return data ?? [];
};

export const upsertDepartment = async ({
  data,
}: {
  data: { id?: string; name: string; description?: string; sort_order?: number };
}) => {
  await requireStaffManage();
  const payload = {
    name: data.name.trim(),
    slug: slugify(data.name),
    description: data.description?.trim() || null,
    sort_order: data.sort_order ?? 0,
  };
  const result = data.id
    ? await supabase.from("departments").update(payload).eq("id", data.id).select("*").single()
    : await supabase.from("departments").insert(payload).select("*").single();
  if (result.error) throw toAppError(result.error);
  return result.data;
};

export const upsertTeam = async ({
  data,
}: {
  data: {
    id?: string;
    department_id: string;
    name: string;
    description?: string;
    sort_order?: number;
  };
}) => {
  await requireStaffManage();
  const payload = {
    department_id: data.department_id,
    name: data.name.trim(),
    slug: slugify(data.name),
    description: data.description?.trim() || null,
    sort_order: data.sort_order ?? 0,
  };
  const result = data.id
    ? await supabase.from("teams").update(payload).eq("id", data.id).select("*").single()
    : await supabase.from("teams").insert(payload).select("*").single();
  if (result.error) throw toAppError(result.error);
  return result.data;
};

export const deleteDepartment = async ({ data }: { data: { id: string } }) => {
  await requireStaffManage();
  const { error } = await supabase.from("departments").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const deleteTeam = async ({ data }: { data: { id: string } }) => {
  await requireStaffManage();
  const { error } = await supabase.from("teams").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  return { ok: true };
};

export const listInvitations = async ({
  data,
}: {
  data?: { status?: string; page?: number; pageSize?: number };
}) => {
  await requireStaffManage();
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 30;
  let query = supabase
    .from("staff_invitations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (data?.status) query = query.eq("status", data.status);
  const from = (page - 1) * pageSize;
  const { data: rows, count, error } = await query.range(from, from + pageSize - 1);
  if (error) throw toAppError(error);
  return { items: rows ?? [], total: count ?? 0, page, pageSize };
};

export const revokeInvitation = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireStaffManage();
  const { error } = await supabase
    .from("staff_invitations")
    .update({ status: "revoked" })
    .eq("id", data.id);
  if (error) throw toAppError(error);
  await writeStaffActivity({
    actor_id: user.id,
    action: "staff.invite_revoke",
    details: data.id,
  });
  return { ok: true };
};

export const resendInvitation = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireStaffManage();
  const { data: invite, error } = await supabase
    .from("staff_invitations")
    .select("*")
    .eq("id", data.id)
    .single();
  if (error) throw toAppError(error);
  const role = (
    invite.roles?.[0] && isAppRole(invite.roles[0]) ? invite.roles[0] : "contributor"
  ) as AppRole;
  await staffApi({
    action: "invite",
    email: invite.email,
    name: invite.name || invite.email,
    byline_name: invite.byline_name,
    role,
    section_ids: [],
  });
  await supabase
    .from("staff_invitations")
    .update({
      status: "pending",
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
    .eq("id", data.id);
  await writeStaffActivity({
    actor_id: user.id,
    action: "staff.invite_resend",
    details: invite.email,
  });
  return { ok: true };
};

export const listStaffActivity = async ({
  data,
}: {
  data?: { action?: string; subject_id?: string; page?: number; pageSize?: number };
}) => {
  await requireStaffManage();
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 30;
  let query = supabase
    .from("staff_activity_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (data?.action) query = query.eq("action", data.action);
  if (data?.subject_id) query = query.eq("subject_id", data.subject_id);
  const from = (page - 1) * pageSize;
  const { data: rows, count, error } = await query.range(from, from + pageSize - 1);
  if (error) throw toAppError(error);
  return { items: rows ?? [], total: count ?? 0, page, pageSize };
};

export const listStaffAudit = async ({ data }: { data?: { page?: number; pageSize?: number } }) => {
  await requireStaffManage();
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 30;
  const from = (page - 1) * pageSize;

  const [activity, adminLogs] = await Promise.all([
    supabase
      .from("staff_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(0, 50),
    supabase
      .from("admin_audit_logs")
      .select("*, profiles(name, email)")
      .order("created_at", { ascending: false })
      .range(0, 50),
  ]);

  const merged = [
    ...(activity.data ?? []).map((r) => ({
      id: r.id,
      source: "staff" as const,
      action: r.action,
      details: r.details,
      created_at: r.created_at,
      actor_name: null as string | null,
    })),
    ...(adminLogs.data ?? []).map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: r.id,
        source: "admin" as const,
        action: r.action,
        details: r.summary,
        created_at: r.created_at,
        actor_name: profile?.name ?? profile?.email ?? null,
      };
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    items: merged.slice(from, from + pageSize),
    total: merged.length,
    page,
    pageSize,
  };
};

export const getStaffAnalytics = async () => {
  await requireStaffManage();
  const dash = await getStaffDashboard();
  return {
    metrics: {
      publishingActivity: dash.topAuthors.reduce((s, a) => s + a.published, 0),
      loginActivity: null as number | null,
      userGrowth: dash.kpis.growthPct,
      engagement: null as number | null,
    },
    growthTrend: dash.growthTrend,
    byRole: dash.byRole,
    deptBreakdown: dash.deptBreakdown,
    topAuthors: dash.topAuthors,
    loginTrend: [] as Array<{ label: string; value: number }>,
  };
};

export const getRolesMatrix = async () => {
  await requireStaffManage();
  const { staff } = await loadStaffBase();
  const living = staff.filter((s) => s.status !== "deleted");
  const roles = APP_ROLES.map((role) => {
    const members = living.filter((s) => s.roles.includes(role));
    return {
      role,
      label: ROLE_LABELS[role],
      permissions: ROLE_PERMISSIONS[role],
      userCount: members.length,
      users: members.slice(0, 12).map((m) => ({
        id: m.id,
        name: m.name ?? m.email ?? "User",
        email: m.email,
        status: m.status,
        avatar_url: m.avatar_url,
      })),
    };
  });
  return {
    roles,
    allPermissions: Object.keys(
      Object.fromEntries(
        Object.values(ROLE_PERMISSIONS)
          .flat()
          .map((p) => [p, true]),
      ),
    ) as string[],
    totalAssignments: roles.reduce((sum, r) => sum + r.userCount, 0),
  };
};

export const getStaffLibraryCounts = async () => {
  await requireStaffManage();
  const { staff } = await loadStaffBase({ includeDeleted: true });
  return {
    all: staff.filter((s) => s.status !== "deleted").length,
    active: staff.filter((s) => s.status === "active").length,
    invited: staff.filter((s) => s.status === "invited" || s.status === "pending").length,
    suspended: staff.filter((s) => s.status === "suspended").length,
    archived: staff.filter((s) => s.status === "archived").length,
    deleted: staff.filter((s) => s.status === "deleted").length,
  };
};

export const recordStaffPresence = async () => {
  const user = await checkAuth();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  try {
    const { error } = await supabase.rpc(
      "record_staff_presence" as never,
      {
        p_ip: null,
        p_user_agent: ua,
        p_device: null,
        p_browser: null,
        p_os: null,
      } as never,
    );
    if (error) {
      // Fallback when migration not applied yet
      await supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  } catch {
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);
  }
  return { ok: true };
};

export const listStaffLoginHistory = async ({
  data,
}: {
  data: { user_id: string; page?: number; pageSize?: number };
}) => {
  await requireStaffManage();
  const page = data.page ?? 1;
  const pageSize = data.pageSize ?? 30;
  const from = (page - 1) * pageSize;
  const {
    data: rows,
    count,
    error,
  } = await supabase
    .from("staff_login_events")
    .select("*", { count: "exact" })
    .eq("user_id", data.user_id)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) {
    if (/staff_login_events|schema cache|PGRST/i.test(error.message)) {
      return { items: [], total: 0, page, pageSize };
    }
    throw toAppError(error);
  }
  return { items: rows ?? [], total: count ?? 0, page, pageSize };
};

export const listBureaus = async () => {
  await requireStaffManage();
  const { data, error } = await supabase.from("bureaus").select("*").order("sort_order");
  if (error) {
    if (/bureaus|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const upsertBureau = async ({
  data,
}: {
  data: {
    id?: string;
    name: string;
    city?: string;
    country?: string;
    address?: string;
    head_id?: string | null;
    contact_email?: string;
    contact_phone?: string;
    status?: string;
    sort_order?: number;
  };
}) => {
  const { user } = await requireStaffManage();
  const payload = {
    name: data.name.trim(),
    slug: slugify(data.name),
    city: data.city?.trim() || null,
    country: data.country?.trim() || null,
    address: data.address?.trim() || null,
    head_id: data.head_id || null,
    contact_email: data.contact_email?.trim() || null,
    contact_phone: data.contact_phone?.trim() || null,
    status: data.status ?? "active",
    sort_order: data.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };
  const result = data.id
    ? await supabase.from("bureaus").update(payload).eq("id", data.id).select("*").single()
    : await supabase.from("bureaus").insert(payload).select("*").single();
  if (result.error) throw toAppError(result.error);
  await writeStaffActivity({
    actor_id: user.id,
    action: data.id ? "staff.bureau_update" : "staff.bureau_create",
    details: payload.name,
  });
  return result.data;
};

export const deleteBureau = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireStaffManage();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("bureau_id", data.id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a bureau that still has assigned users. Reassign them first.");
  }
  const { error } = await supabase.from("bureaus").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeStaffActivity({
    actor_id: user.id,
    action: "staff.bureau_delete",
    details: data.id,
  });
  return { ok: true };
};

export const listJobTitles = async () => {
  await requireStaffManage();
  const { data, error } = await supabase
    .from("job_titles")
    .select("*, departments(name)")
    .order("sort_order");
  if (error) {
    if (/job_titles|schema cache|PGRST/i.test(error.message)) return [];
    throw toAppError(error);
  }
  return data ?? [];
};

export const upsertJobTitle = async ({
  data,
}: {
  data: {
    id?: string;
    title: string;
    department_id?: string | null;
    description?: string;
    level?: string;
    status?: string;
    sort_order?: number;
  };
}) => {
  const { user } = await requireStaffManage();
  const payload = {
    title: data.title.trim(),
    slug: slugify(data.title),
    department_id: data.department_id || null,
    description: data.description?.trim() || null,
    level: data.level?.trim() || null,
    status: data.status ?? "active",
    sort_order: data.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };
  const result = data.id
    ? await supabase.from("job_titles").update(payload).eq("id", data.id).select("*").single()
    : await supabase.from("job_titles").insert(payload).select("*").single();
  if (result.error) throw toAppError(result.error);
  await writeStaffActivity({
    actor_id: user.id,
    action: data.id ? "staff.job_title_update" : "staff.job_title_create",
    details: payload.title,
  });
  return result.data;
};

export const deleteJobTitle = async ({ data }: { data: { id: string } }) => {
  const { user } = await requireStaffManage();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("job_title_id", data.id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a job title still assigned to users.");
  }
  const { error } = await supabase.from("job_titles").delete().eq("id", data.id);
  if (error) throw toAppError(error);
  await writeStaffActivity({
    actor_id: user.id,
    action: "staff.job_title_delete",
    details: data.id,
  });
  return { ok: true };
};

export const archiveStaffUser = async ({
  data,
}: {
  data: { user_id: string; reason?: string };
}) => {
  return bulkStaffAction({
    data: { ids: [data.user_id], action: "archive", reason: data.reason },
  });
};

export const softDeleteStaffUser = async ({
  data,
}: {
  data: { user_id: string; reason?: string };
}) => {
  return bulkStaffAction({
    data: { ids: [data.user_id], action: "delete", reason: data.reason },
  });
};

export const restoreStaffUser = async ({ data }: { data: { user_id: string } }) => {
  return bulkStaffAction({ data: { ids: [data.user_id], action: "restore" } });
};

export const approvePendingStaffUser = async ({ data }: { data: { user_id: string } }) => {
  const { user } = await requireStaffManage();
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", data.user_id)
    .in("status", ["invited", "pending"]);
  if (error) throw toAppError(error);
  await writeStaffActivity({
    actor_id: user.id,
    subject_id: data.user_id,
    action: "staff.approve",
    details: "User approved",
  });
  return { ok: true };
};

export const rejectPendingStaffUser = async ({
  data,
}: {
  data: { user_id: string; reason?: string };
}) => {
  const { user } = await requireStaffManage();
  const { error } = await supabase
    .from("profiles")
    .update({
      status: "archived",
      archive_reason: data.reason ?? "Rejected during approval",
    })
    .eq("id", data.user_id)
    .in("status", ["invited", "pending"]);
  if (error) throw toAppError(error);
  await writeStaffActivity({
    actor_id: user.id,
    subject_id: data.user_id,
    action: "staff.reject",
    details: data.reason ?? "User rejected",
  });
  return { ok: true };
};

export type StaffMemberRow = Awaited<ReturnType<typeof loadStaffBase>>["staff"][number];
export type { ProfileRow };
