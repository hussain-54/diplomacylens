import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, PenLine } from "lucide-react";
import { getDashboardMetrics, getMe, listDashboardArticles } from "@/lib/admin.functions";
import { PageHeader, CmsPageSkeleton, CmsAlert } from "@/components/cms";
import { hasPermission } from "@/lib/permissions";
import { requirePermissionRoute } from "@/lib/route-guards";
import { cmsButton } from "@/components/cms-ui";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: ({ context }) => requirePermissionRoute(context.roles, "dashboard:view"),
  component: Overview,
});

function Overview() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe(), staleTime: 60_000 });
  const canCreate = hasPermission(me.data?.roles, "articles:create");
  const metrics = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: getDashboardMetrics,
    staleTime: 15_000,
  });
  const articles = useQuery({
    queryKey: ["dashboard-articles"],
    queryFn: listDashboardArticles,
    staleTime: 15_000,
  });

  if (metrics.isLoading || articles.isLoading) return <CmsPageSkeleton />;
  if (metrics.isError) {
    return (
      <CmsAlert tone="danger">
        {(metrics.error as Error).message || "Could not load dashboard."}
      </CmsAlert>
    );
  }

  const total = metrics.data?.totalArticles ?? 0;
  const published = metrics.data?.publishedTotal ?? 0;
  const drafts = metrics.data?.drafts ?? 0;
  const recent = (articles.data ?? []).slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Lightweight Diplomacy Lens content desk."
        actions={
          canCreate ? (
            <Link to="/admin/articles/$id" params={{ id: "new" }} className={cmsButton}>
              <PenLine className="h-4 w-4" />
              New Article
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total articles" value={total} />
        <MetricCard label="Published" value={published} />
        <MetricCard label="Drafts" value={drafts} />
      </div>

      <section className="rounded-xl border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold">Recent articles</h2>
          <Link to="/admin/articles" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-border/60">
            {recent.map((article) => (
              <li key={article.id}>
                <Link
                  to="/admin/articles/$id"
                  params={{ id: article.id }}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {article.title || "Untitled"}
                    </div>
                    <div className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                      {article.status}
                      {article.updated_at ? ` · ${timeAgo(article.updated_at)}` : ""}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No articles yet.
            {canCreate ? (
              <>
                {" "}
                <Link
                  to="/admin/articles/$id"
                  params={{ id: "new" }}
                  className="font-medium text-primary hover:underline"
                >
                  Create the first one
                </Link>
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
