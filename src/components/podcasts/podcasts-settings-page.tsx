import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CmsPageHeader, CmsPanel, cmsButton, cmsInput } from "@/components/cms-ui";
import { formatBytes } from "@/lib/dam";
import {
  getPodcastSettings,
  updatePodcastSettings,
  type PodcastSettings,
  canManagePodcasts,
} from "@/lib/podcast.functions";
import { getMe } from "@/lib/admin.functions";

export function PodcastsSettingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const canManage = canManagePodcasts(me.data?.roles);
  const settingsQ = useQuery({ queryKey: ["podcast-settings"], queryFn: getPodcastSettings });
  const [form, setForm] = useState<PodcastSettings | null>(null);

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Nothing to save");
      return updatePodcastSettings({
        data: {
          max_audio_bytes: form.max_audio_bytes,
          allow_download_default: form.allow_download_default,
          allow_embed_default: form.allow_embed_default,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcast-settings"] }),
  });

  if (!form) {
    return (
      <div className="space-y-4">
        <CmsPageHeader
          title="Podcast Settings"
          description="Upload and playback defaults for podcasts."
        />
        <div className="h-40 animate-pulse rounded-sm border border-border bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Podcast Settings"
        description="Persisted defaults from podcast_settings. No secrets are stored here."
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
            <span className="text-xs text-muted-foreground">Requires podcasts:manage</span>
          )
        }
      />

      <CmsPanel className="space-y-4 p-4">
        <label className="block max-w-sm space-y-1 text-xs">
          <span className="text-muted-foreground">Maximum audio upload (MB)</span>
          <input
            type="number"
            min={1}
            max={500}
            className={cmsInput}
            disabled={!canManage}
            value={Math.round(form.max_audio_bytes / 1024 / 1024)}
            onChange={(e) =>
              setForm((f) =>
                f
                  ? {
                      ...f,
                      max_audio_bytes: Math.max(1, Number(e.target.value) || 1) * 1024 * 1024,
                    }
                  : f,
              )
            }
          />
          <span className="text-muted-foreground">{formatBytes(form.max_audio_bytes)}</span>
        </label>
        <label className="flex items-start justify-between gap-4 rounded-sm border border-border p-4">
          <span>
            <span className="block text-sm font-medium">Allow download by default</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              New episodes inherit this unless overridden on the episode form.
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
        <label className="flex items-start justify-between gap-4 rounded-sm border border-border p-4">
          <span>
            <span className="block text-sm font-medium">Allow embed by default</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Controls the default embed permission for new episodes.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            disabled={!canManage}
            checked={form.allow_embed_default}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, allow_embed_default: e.target.checked } : f))
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
