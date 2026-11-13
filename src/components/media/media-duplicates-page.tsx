import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPageSkeleton,
  CmsPanel,
  cmsSecondaryButton,
} from "@/components/cms";
import { formatBytes } from "@/lib/dam";
import { listDuplicateMediaGroups, trashMediaAssets } from "@/lib/media.functions";
import { getMe } from "@/lib/admin.functions";
import { hasPermission } from "@/lib/permissions";

export function MediaDuplicatesPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const canUpload = hasPermission(me.data?.roles, "media:upload");
  const groupsQ = useQuery({ queryKey: ["media-duplicates"], queryFn: listDuplicateMediaGroups });

  const trash = useMutation({
    mutationFn: (ids: string[]) => trashMediaAssets({ data: { ids } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media-duplicates"] });
      void qc.invalidateQueries({ queryKey: ["media-counts"] });
      void qc.invalidateQueries({ queryKey: ["media-dashboard"] });
    },
  });

  if (groupsQ.isLoading) return <CmsPageSkeleton metrics={2} panels={1} />;

  const groups = groupsQ.data ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Duplicate Media"
        description="Groups matched by SHA-256 content hash — not by filename. Keep the original and trash extras."
      />

      {groupsQ.error ? (
        <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(groupsQ.error as Error).message}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <CmsEmptyState
          title="No duplicates found"
          description="Exact duplicate files (same bytes) will appear here after uploads are hashed. Apply the media hash migration if this stays empty after uploads."
        />
      ) : (
        groups.map((group) => {
          const [original, ...dupes] = group.assets;
          return (
            <CmsPanel
              key={group.content_hash}
              title={`${group.count} copies · ${formatBytes(group.total_bytes)}`}
              description={`Hash ${group.content_hash.slice(0, 16)}…`}
            >
              <div className="space-y-3 p-4">
                <div className="rounded-sm border border-emerald-600/30 bg-emerald-500/5 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Original
                  </div>
                  <div className="mt-1 font-medium">{original.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(original.size_bytes)} ·{" "}
                    {new Date(original.created_at).toLocaleString()}
                  </div>
                  <a
                    href={original.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-cat-blue underline"
                  >
                    Open
                  </a>
                </div>
                {dupes.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-3 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        {asset.file_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(asset.size_bytes)} ·{" "}
                        {new Date(asset.created_at).toLocaleString()}
                      </div>
                    </div>
                    {canUpload ? (
                      <button
                        type="button"
                        className={cmsSecondaryButton}
                        disabled={trash.isPending}
                        onClick={() => {
                          if (window.confirm(`Move duplicate “${asset.file_name}” to trash?`)) {
                            trash.mutate([asset.id]);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Trash duplicate
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </CmsPanel>
          );
        })
      )}
    </div>
  );
}
