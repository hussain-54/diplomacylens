from pathlib import Path

root = Path(r"c:\Users\Black Scorpion\Downloads\diplomacy-hub-main\src\routes\_authenticated")


def write(name: str, content: str) -> None:
    (root / name).write_text(content, encoding="utf-8")
    print("wrote", name)


layouts = [
    ("admin.workflow.tsx", "/_authenticated/admin/workflow", "articles:view"),
    ("admin.newsroom-ops.tsx", "/_authenticated/admin/newsroom-ops", "dashboard:view"),
    ("admin.tips.tsx", "/_authenticated/admin/tips", "articles:view"),
    ("admin.editorial-calendar.tsx", "/_authenticated/admin/editorial-calendar", "articles:view"),
    ("admin.authors.tsx", "/_authenticated/admin/authors", "staff:manage"),
    ("admin.pages.tsx", "/_authenticated/admin/pages", "settings:manage"),
    ("admin.menus.tsx", "/_authenticated/admin/menus", "settings:manage"),
    ("admin.footer.tsx", "/_authenticated/admin/footer", "settings:manage"),
    ("admin.security.tsx", "/_authenticated/admin/security", "settings:manage"),
    ("admin.performance.tsx", "/_authenticated/admin/performance", "settings:manage"),
    ("admin.backup.tsx", "/_authenticated/admin/backup", "settings:manage"),
    ("admin.qa.tsx", "/_authenticated/admin/qa", "settings:manage"),
    ("admin.taxonomy.tsx", "/_authenticated/admin/taxonomy", "categories:manage"),
]

for fname, route, perm in layouts:
    write(
        fname,
        f'''import {{ createFileRoute, Outlet, redirect }} from "@tanstack/react-router";
import {{ hasPermission }} from "@/lib/permissions";

export const Route = createFileRoute("{route}")({{
  beforeLoad: ({{ context }}) => {{
    if (!hasPermission(context.roles, "{perm}")) throw redirect({{ to: "/admin" }});
  }},
  component: () => <Outlet />,
}});
''',
    )

hubs = [
    (
        "admin.workflow.index.tsx",
        "/_authenticated/admin/workflow/",
        "Workflow",
        "WORKFLOW_NAV",
        "Editorial workflow queues reuse the Articles status lanes.",
    ),
    (
        "admin.newsroom-ops.index.tsx",
        "/_authenticated/admin/newsroom-ops/",
        "Newsroom Operations",
        "NEWSROOM_OPS_NAV",
        "Operations desk linking Breaking News, Stories, and assignment views.",
    ),
    (
        "admin.tips.index.tsx",
        "/_authenticated/admin/tips/",
        "News Tips",
        "NEWS_TIPS_NAV",
        "Tip intake desks. Persistence requires news_tips migration; empty states until then (no mock data).",
    ),
    (
        "admin.editorial-calendar.index.tsx",
        "/_authenticated/admin/editorial-calendar/",
        "Editorial Calendar",
        "EDITORIAL_CALENDAR_NAV",
        "Cross-content calendar linking scheduled articles and social campaigns.",
    ),
    (
        "admin.authors.index.tsx",
        "/_authenticated/admin/authors/",
        "Authors / Contributors",
        "AUTHORS_LOCKED_NAV",
        "Author desks reuse Staff profiles and bylines.",
    ),
    (
        "admin.pages.index.tsx",
        "/_authenticated/admin/pages/",
        "Pages",
        "PAGES_LOCKED_NAV",
        "CMS pages desk. Public policy pages remain intact.",
    ),
    (
        "admin.menus.index.tsx",
        "/_authenticated/admin/menus/",
        "Navigation / Menus",
        "MENUS_LOCKED_NAV",
        "Menu builder desk. Category show_in_nav continues to work.",
    ),
    (
        "admin.footer.index.tsx",
        "/_authenticated/admin/footer/",
        "Footer Management",
        "FOOTER_LOCKED_NAV",
        "Footer builder. Existing footer-pages registry remains the public fallback.",
    ),
    (
        "admin.security.index.tsx",
        "/_authenticated/admin/security/",
        "Security",
        "SECURITY_LOCKED_NAV",
        "Security desk linking Settings security controls — no duplicate auth system.",
    ),
    (
        "admin.performance.index.tsx",
        "/_authenticated/admin/performance/",
        "Performance",
        "PERFORMANCE_LOCKED_NAV",
        "Performance desk. Configuration status only — never fake Core Web Vitals.",
    ),
    (
        "admin.backup.index.tsx",
        "/_authenticated/admin/backup/",
        "Backup / DR",
        "BACKUP_LOCKED_NAV",
        "Backup desk. Uses admin_backup_records when present; never fake success.",
    ),
    (
        "admin.qa.index.tsx",
        "/_authenticated/admin/qa/",
        "QA / UAT",
        "QA_LOCKED_NAV",
        "QA management desk. Empty until qa_* tables are migrated.",
    ),
    (
        "admin.taxonomy.index.tsx",
        "/_authenticated/admin/taxonomy/",
        "Taxonomy",
        "TAXONOMY_LOCKED_NAV",
        "Categories, tags, and topics — reused from existing modules.",
    ),
]

for fname, route, title, nav, note in hubs:
    write(
        fname,
        f'''import {{ createFileRoute }} from "@tanstack/react-router";
import {{ ModuleDeskPage }} from "@/components/admin/module-desk-page";
import {{ {nav} }} from "@/components/admin/locked-nav";

export const Route = createFileRoute("{route}")({{
  component: () => (
    <ModuleDeskPage
      title="{title}"
      description="Locked CMS desk — opens real linked modules."
      items={{{nav}}}
      note="{note}"
    />
  ),
}});
''',
    )

print("done")
