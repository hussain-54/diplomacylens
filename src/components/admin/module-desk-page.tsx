import { Link } from "@tanstack/react-router";
import { CmsEmptyState, CmsPageHeader, CmsPanel, cmsSecondaryButton } from "@/components/cms";
import type { LockedNavItem } from "@/components/admin/locked-nav";

/**
 * Desk hub for locked sidebar modules.
 * Reuses linked existing CMS routes; never invents fake success metrics.
 */
export function ModuleDeskPage({
  title,
  description,
  items,
  note,
}: {
  title: string;
  description: string;
  items: LockedNavItem[];
  note?: string;
}) {
  return (
    <div className="space-y-6">
      <CmsPageHeader title={title} description={description} />
      {note ? (
        <CmsPanel title="Status">
          <p className="p-4 text-sm text-muted-foreground">{note}</p>
        </CmsPanel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <CmsPanel key={`${item.to}-${item.label}`} title={item.label}>
            <div className="flex items-center justify-between gap-2 px-4 pb-4">
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <Link to={item.to} className={cmsSecondaryButton}>
                Open
              </Link>
            </div>
          </CmsPanel>
        ))}
      </div>
      {!items.length ? (
        <CmsEmptyState title="No sections" description="This desk has no linked modules yet." />
      ) : null}
    </div>
  );
}
