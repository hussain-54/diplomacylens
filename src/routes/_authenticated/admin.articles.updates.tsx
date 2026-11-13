import { createFileRoute } from "@tanstack/react-router";
import { ArticlesListPanel } from "@/components/articles/articles-list-panel";
import { requirePermissionRoute } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/articles/updates")({
  beforeLoad: ({ context }) => requirePermissionRoute(context.roles, "articles:view"),
  component: () => (
    <ArticlesListPanel
      title="Updates"
      description="Recently updated published articles (sorted by last update)."
      lockedStatus="published"
    />
  ),
});
