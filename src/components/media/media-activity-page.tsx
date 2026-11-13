import { useQuery } from "@tanstack/react-query";
import { CmsEmptyState, CmsPageHeader, CmsPageSkeleton, CmsPanel } from "@/components/cms";
import { listMediaActivityLogs } from "@/lib/media.functions";

export function MediaActivityPage() {
  const logsQ = useQuery({
    queryKey: ["media-activity-logs"],
    queryFn: () => listMediaActivityLogs(150),
  });

  if (logsQ.isLoading) return <CmsPageSkeleton metrics={2} panels={1} />;

  const rows = logsQ.data ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Media Activity"
        description="Upload, edit, trash, restore, and settings events from the newsroom audit log."
      />

      {logsQ.error ? (
        <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(logsQ.error as Error).message}
        </div>
      ) : null}

      <CmsPanel title="Recent media events" description={`${rows.length} events`}>
        {!rows.length ? (
          <CmsEmptyState
            title="No media activity yet"
            description="Actions such as uploads, metadata edits, and trash/restore will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const withProfile = row as typeof row & {
                profiles?: { name?: string | null } | { name?: string | null }[] | null;
              };
              const profile = Array.isArray(withProfile.profiles)
                ? withProfile.profiles[0]
                : withProfile.profiles;
              const name =
                profile && typeof profile === "object" && "name" in profile
                  ? String(profile.name || "Staff")
                  : "Staff";
              return (
                <article
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{row.summary || row.action}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.action}
                      {row.entity_type ? ` · ${row.entity_type}` : ""}
                      {row.entity_id ? ` · ${String(row.entity_id).slice(0, 8)}…` : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{name}</div>
                    <time dateTime={row.created_at}>
                      {new Date(row.created_at).toLocaleString()}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CmsPanel>
    </div>
  );
}
