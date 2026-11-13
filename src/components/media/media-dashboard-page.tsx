import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Film,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Music,
  Trash2,
  Upload,
} from "lucide-react";
import {
  CmsEmptyState,
  CmsPageSkeleton,
  CmsPanel,
  MetricCard,
  cmsSecondaryButton,
} from "@/components/cms";
import { formatBytes } from "@/lib/dam";
import { getMediaDashboard } from "@/lib/media.functions";

export function MediaDashboardPage({
  onNavigate,
}: {
  onNavigate?: (
    view: "library" | "upload" | "folders" | "duplicates" | "galleries" | "settings",
  ) => void;
}) {
  const dash = useQuery({
    queryKey: ["media-dashboard"],
    queryFn: getMediaDashboard,
    staleTime: 20_000,
  });

  if (dash.isLoading) return <CmsPageSkeleton metrics={8} />;
  if (dash.error) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {(dash.error as Error).message}
      </div>
    );
  }

  const data = dash.data!;
  const go = (view: "library" | "upload" | "folders" | "duplicates" | "galleries" | "settings") => {
    if (onNavigate) onNavigate(view);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Media Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live library totals, storage usage, and recent activity from the Media Library.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={cmsSecondaryButton} onClick={() => go("upload")}>
            <Upload className="h-4 w-4" /> Upload
          </button>
          <button type="button" className={cmsSecondaryButton} onClick={() => go("folders")}>
            <FolderOpen className="h-4 w-4" /> Folders
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total media" value={data.counts.all} icon={HardDrive} />
        <MetricCard label="Images" value={data.counts.image} icon={ImageIcon} />
        <MetricCard label="Videos" value={data.counts.video} icon={Film} />
        <MetricCard label="Audio" value={data.counts.audio} icon={Music} />
        <MetricCard label="Documents" value={data.counts.document} icon={FileText} />
        <MetricCard label="Trash" value={data.counts.trash} icon={Trash2} />
        <MetricCard label="Folders" value={data.folderCount} icon={FolderOpen} />
        <MetricCard
          label="Storage used"
          value={formatBytes(data.storage.used_bytes)}
          detail={`${data.storage.percent_used}% of ${formatBytes(data.storage.quota_bytes)}`}
          icon={HardDrive}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CmsPanel title="Storage" description="Configured quota (not live cloud metering).">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Used</dt>
              <dd className="font-medium">{formatBytes(data.storage.used_bytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Available</dt>
              <dd className="font-medium">{formatBytes(data.storage.available_bytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quota</dt>
              <dd className="font-medium">{formatBytes(data.storage.quota_bytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Assets</dt>
              <dd className="font-medium">{data.storage.asset_count}</dd>
            </div>
          </dl>
          <div className="mt-4 h-2 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, data.storage.percent_used)}%` }}
            />
          </div>
        </CmsPanel>

        <CmsPanel title="Quick links">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cmsSecondaryButton} onClick={() => go("library")}>
              Open library
            </button>
            <button type="button" className={cmsSecondaryButton} onClick={() => go("galleries")}>
              Galleries
            </button>
            <button type="button" className={cmsSecondaryButton} onClick={() => go("settings")}>
              Settings
            </button>
            <Link to="/admin/media" search={{ view: "library" }} className={cmsSecondaryButton}>
              Browse trash in library
            </Link>
          </div>
        </CmsPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CmsPanel title="Recently uploaded">
          {!data.recentlyUploaded.length ? (
            <CmsEmptyState
              title="No uploads yet"
              description="Upload your first file to populate the library."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentlyUploaded.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="h-10 w-10 overflow-hidden rounded-sm bg-muted">
                    {row.thumbnail_url || (row.asset_type === "image" && row.public_url) ? (
                      <img
                        src={row.thumbnail_url || row.public_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.asset_type} · {formatBytes(row.size_bytes)} ·{" "}
                      {new Date(row.created_at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CmsPanel>

        <CmsPanel title="Recently used in content">
          {!data.recentlyUsed.length ? (
            <CmsEmptyState
              title="No usage yet"
              description="Assets referenced by articles and other content will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentlyUsed.map((row, idx) => {
                const asset = Array.isArray(row.media_assets)
                  ? row.media_assets[0]
                  : row.media_assets;
                return (
                  <li
                    key={`${row.asset_id}-${idx}`}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {(asset as { file_name?: string } | null)?.file_name ?? row.asset_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(asset as { asset_type?: string } | null)?.asset_type ?? "asset"} ·{" "}
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CmsPanel>
      </div>
    </div>
  );
}
