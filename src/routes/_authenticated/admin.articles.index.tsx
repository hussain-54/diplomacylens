import { createFileRoute } from "@tanstack/react-router";
import { ArticlesDashboardPage } from "@/components/articles/articles-dashboard-page";
import { requirePermissionRoute } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/articles/")({
  beforeLoad: ({ context }) => requirePermissionRoute(context.roles, "articles:view"),
  component: ArticlesDashboardPage,
});
