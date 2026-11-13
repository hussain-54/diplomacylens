import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CmsPageHeader, CmsPanel, cmsButton, cmsInput } from "@/components/cms-ui";
import { formatBytes } from "@/lib/dam";
import {
  canManageInfographics,
  getInfographicSettings,
  updateInfographicSettings,
  type InfographicSettings,
} from "@/lib/infographics.functions";
import { getMe } from "@/lib/admin.functions";

export function InfographicsSettingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const canManage = canManageInfographics(me.data?.roles);
  const settingsQ = useQuery({
    queryKey: ["infographic-settings"],
    queryFn: getInfographicSettings,
  });
  const [form, setForm] = useState<InfographicSettings | null>(null);

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Nothing to save");
      return updateInfographicSettings({
        data: {
          max_asset_bytes: form.max_asset_bytes,
          allow_download_default: form.allow_download_default,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["infographic-settings"] }),
  });

  if (!form) {
    return (
      <div className="space-y-4">
        <CmsPageHeader
          title="Infographic Settings"
          description="Upload defaults for infographics."
        />
        <div className="h-40 animate-pulse rounded-sm border border-border bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Infographic Settings"
        description="Persisted defaults from infographic_settings."
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
            <span className="text-xs text-muted-foreground">Requires infographics:manage</span>
          )
        }
      />

      <CmsPanel className="space-y-4 p-4">
        <label className="block max-w-sm space-y-1 text-xs">
          <span className="text-muted-foreground">Maximum asset upload (MB)</span>
          <input
            type="number"
            min={1}
            max={200}
            className={cmsInput}
            disabled={!canManage}
            value={Math.round(form.max_asset_bytes / 1024 / 1024)}
            onChange={(e) =>
              setForm((f) =>
                f
                  ? {
                      ...f,
                      max_asset_bytes: Math.max(1, Number(e.target.value) || 1) * 1024 * 1024,
                    }
                  : f,
              )
            }
          />
          <span className="text-muted-foreground">{formatBytes(form.max_asset_bytes)}</span>
        </label>
        <label className="flex items-start justify-between gap-4 rounded-sm border border-border p-4">
          <span>
            <span className="block text-sm font-medium">Allow download by default</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              New infographics inherit this unless overridden per item.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            disabled={!canManage}
            checked={form.allow_download_default}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, allow_download_default: e.target.checked } : f))
            }
          />
        </label>
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
