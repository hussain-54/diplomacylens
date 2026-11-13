import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CmsPageHeader,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms-ui";
import { formatBytes } from "@/lib/dam";
import {
  getMediaSettings,
  getMediaStorageStats,
  updateMediaSettings,
  type MediaSettingsRow,
} from "@/lib/media.functions";
import { getMe } from "@/lib/admin.functions";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
  description,
  danger,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-sm border border-border p-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(e) => {
          if (danger && e.target.checked) {
            if (!window.confirm(`${label}: this can cause destructive behavior. Continue?`)) return;
          }
          onChange(e.target.checked);
        }}
      />
    </label>
  );
}

export function MediaSettingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const canManage = hasPermission(me.data?.roles, "media:manage_all");
  const settingsQ = useQuery({ queryKey: ["media-settings"], queryFn: getMediaSettings });
  const storageQ = useQuery({ queryKey: ["media-storage"], queryFn: getMediaStorageStats });
  const [form, setForm] = useState<MediaSettingsRow | null>(null);

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Nothing to save");
      const { id: _id, updated_at: _u, updated_by: _b, ...payload } = form;
      return updateMediaSettings({ data: payload });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["media-settings"] }),
        qc.invalidateQueries({ queryKey: ["media-storage"] }),
      ]);
    },
  });

  if (!form) {
    return (
      <div className="space-y-4">
        <CmsPageHeader
          title="Media Settings"
          description="Configure upload, image, and storage options."
        />
        <div className="h-40 animate-pulse rounded-sm border border-border bg-muted" />
      </div>
    );
  }

  const storage = storageQ.data;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Media Settings"
        description="Persisted upload rules and image processing defaults for Diplomacy Lens."
        actions={
          canManage ? (
            <button
              type="button"
              className={cmsButton}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save settings"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Requires media:manage_all to edit</span>
          )
        }
      />

      <CmsPanel className="space-y-4 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Storage
        </h2>
        {storage ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Total (configured quota)</div>
                <div className="font-serif text-2xl">{formatBytes(storage.quota_bytes)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Used</div>
                <div className="font-serif text-2xl">{formatBytes(storage.used_bytes)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Available</div>
                <div className="font-serif text-2xl">{formatBytes(storage.available_bytes)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Usage</div>
                <div className="font-serif text-2xl">{storage.percent_used}%</div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-navy" style={{ width: `${storage.percent_used}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Quota source: configured in Media Settings (not live Supabase plan metering). Used
              storage is the sum of active media_assets.size_bytes ({storage.asset_count} files).
            </p>
            {canManage ? (
              <label className="block max-w-xs space-y-1 text-xs">
                <span className="text-muted-foreground">Configured quota (GB)</span>
                <input
                  type="number"
                  min={1}
                  className={cmsInput}
                  value={Math.round(form.storage_quota_bytes / 1024 / 1024 / 1024)}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            storage_quota_bytes:
                              Math.max(1, Number(e.target.value) || 1) * 1024 * 1024 * 1024,
                          }
                        : f,
                    )
                  }
                />
              </label>
            ) : null}
          </>
        ) : (
          <div className="h-20 animate-pulse rounded-sm bg-muted" />
        )}
      </CmsPanel>

      <CmsPanel className={cn("space-y-4 p-4", !canManage && "pointer-events-none opacity-70")}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Upload settings
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Maximum upload size (MB)</span>
            <input
              type="number"
              min={1}
              max={200}
              className={cmsInput}
              value={Math.round(form.max_upload_bytes / 1024 / 1024)}
              onChange={(e) =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        max_upload_bytes: Math.max(1, Number(e.target.value) || 1) * 1024 * 1024,
                      }
                    : f,
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Bulk upload limit</span>
            <input
              type="number"
              min={1}
              max={100}
              className={cmsInput}
              value={form.bulk_upload_limit}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, bulk_upload_limit: Number(e.target.value) || 1 } : f))
              }
            />
          </label>
        </div>
        <Toggle
          label="Automatic compression"
          description="Optimize images before upload using the quality and format settings below."
          checked={form.auto_compress}
          onChange={(v) => setForm((f) => (f ? { ...f, auto_compress: v } : f))}
        />
        <Toggle
          label="Generate thumbnails"
          description="Create thumbnail derivatives in media-library/thumbnails on upload."
          checked={form.generate_thumbnails}
          onChange={(v) => setForm((f) => (f ? { ...f, generate_thumbnails: v } : f))}
        />
        <Toggle
          label="Preserve originals"
          description="Keep the untouched original in media-library/originals when compression runs."
          checked={form.preserve_originals}
          onChange={(v) => setForm((f) => (f ? { ...f, preserve_originals: v } : f))}
        />
      </CmsPanel>

      <CmsPanel className={cn("space-y-4 p-4", !canManage && "pointer-events-none opacity-70")}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Image settings
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Thumbnail width</span>
            <input
              type="number"
              className={cmsInput}
              value={form.thumbnail_width}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, thumbnail_width: Number(e.target.value) || 300 } : f))
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Thumbnail height</span>
            <input
              type="number"
              className={cmsInput}
              value={form.thumbnail_height}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, thumbnail_height: Number(e.target.value) || 300 } : f))
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Image quality (%)</span>
            <input
              type="number"
              min={40}
              max={100}
              className={cmsInput}
              value={form.image_quality}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, image_quality: Number(e.target.value) || 80 } : f))
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Default format</span>
            <select
              className={cmsInput}
              value={form.default_image_format}
              onChange={(e) =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        default_image_format: e.target
                          .value as MediaSettingsRow["default_image_format"],
                      }
                    : f,
                )
              }
            >
              <option value="webp">WebP</option>
              <option value="jpeg">JPEG</option>
              <option value="original">Original</option>
            </select>
          </label>
        </div>
      </CmsPanel>

      <CmsPanel className={cn("space-y-4 p-4", !canManage && "pointer-events-none opacity-70")}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Other settings
        </h2>
        <Toggle
          label="Detect duplicate uploads"
          description="Block uploads whose SHA-256 content hash already exists in the library (unless force-allowed)."
          checked={form.detect_duplicates}
          onChange={(v) => setForm((f) => (f ? { ...f, detect_duplicates: v } : f))}
        />
        <Toggle
          label="Watermark images"
          description="Flag for future watermark pipeline. Not applied automatically yet."
          checked={form.watermark_images}
          onChange={(v) => setForm((f) => (f ? { ...f, watermark_images: v } : f))}
        />
        <Toggle
          danger
          label="Delete unused files"
          description="Marks intent to purge unused assets. Destructive cleanup should be run deliberately by managers."
          checked={form.delete_unused_files}
          onChange={(v) => setForm((f) => (f ? { ...f, delete_unused_files: v } : f))}
        />
        {canManage ? (
          <button type="button" className={cmsSecondaryButton} onClick={() => save.mutate()}>
            Save settings
          </button>
        ) : null}
        {save.isSuccess ? <p className="text-xs text-emerald-700">Settings saved.</p> : null}
        {save.isError ? (
          <p className="text-xs text-crimson">
            {save.error instanceof Error ? save.error.message : "Save failed"}
          </p>
        ) : null}
      </CmsPanel>
    </div>
  );
}
