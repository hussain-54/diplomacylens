import { listStaffTable } from "@/lib/staff.functions";

const AUTHOR_ROLES = new Set([
  "editor_in_chief",
  "managing_editor",
  "section_editor",
  "reporter",
  "contributor",
  "translator",
  "fact_checker",
]);

export async function listAuthors(kind: "authors" | "contributors" | "guests" | "all" = "all") {
  const table = await listStaffTable({
    data: { page: 1, pageSize: 100, status: "active", sort: "name", sortDir: "asc" },
  });
  let rows = (table.items ?? []).filter((s) => s.roles.some((r: string) => AUTHOR_ROLES.has(r)));

  if (kind === "contributors") {
    rows = rows.filter((s) => s.roles.includes("contributor"));
  } else if (kind === "guests") {
    rows = rows.filter((s) => s.roles.includes("contributor") && !s.roles.includes("reporter"));
  } else if (kind === "authors") {
    rows = rows.filter((s) =>
      s.roles.some((r) => r === "reporter" || String(r).includes("editor")),
    );
  }

  return rows.map((s) => {
    const row = s as typeof s & { byline_name?: string | null; avatar_url?: string | null };
    return {
      id: row.id,
      name: row.byline_name || row.name || row.email || "Unnamed",
      email: row.email,
      byline: row.byline_name ?? null,
      roles: row.roles,
      avatar_url: row.avatar_url ?? null,
      status: row.status,
      href: `/admin/staff/${row.id}`,
    };
  });
}
