import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsPageHeader,
  CmsPageSkeleton,
  CmsPanel,
  StatusBadge,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import { AudioPlayer } from "@/components/podcasts/audio-player";
import { formatBytes } from "@/lib/dam";
import {
  formatDuration,
  getPodcastEpisodeAdmin,
  listPodcastShowsAdmin,
  uploadPodcastAudio,
  upsertPodcastEpisode,
  validateAudioFile,
  type PodcastEpisodeInput,
  type PodcastStatus,
} from "@/lib/podcast.functions";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const DEFAULT_FORM: PodcastEpisodeInput = {
  title: "",
  slug: "",
  show_id: null,
  host: "",
  guests: "",
  artwork_url: "",
  audio_url: "",
  external_url: "",
  category: "",
  tags: [],
  transcript: "",
  transcript_language: "en",
  description: "",
  short_description: "",
  season_number: null,
  episode_number: null,
  credits: "",
  references_text: "",
  language: "en",
  region: "",
  status: "draft",
  visibility: "public",
  allow_download: true,
  allow_embed: true,
  is_featured: false,
  seo_title: "",
  seo_description: "",
  og_image_url: "",
};

function toDateTimeInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function PodcastEpisodeForm({ episodeId }: { episodeId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(episodeId);
  const [form, setForm] = useState<PodcastEpisodeInput>(DEFAULT_FORM);
  const [tagsInput, setTagsInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showsQ = useQuery({
    queryKey: ["podcast-shows-lite"],
    queryFn: () => listPodcastShowsAdmin({ pageSize: 100, archived: "exclude" }),
  });

  const detailQ = useQuery({
    queryKey: ["podcast-episode", episodeId],
    queryFn: () => getPodcastEpisodeAdmin(episodeId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detailQ.data) {
      setForm({
        ...detailQ.data,
        id: detailQ.data.id,
        status: detailQ.data.status as PodcastStatus,
      });
      setTagsInput((detailQ.data.tags ?? []).join(", "));
      setSlugTouched(true);
    }
  }, [detailQ.data]);

  const patch = (partial: Partial<PodcastEpisodeInput>) =>
    setForm((current) => ({ ...current, ...partial }));

  const save = useMutation({
    mutationFn: (status?: PodcastStatus) =>
      upsertPodcastEpisode({
        data: {
          ...form,
          id: episodeId,
          status: status ?? form.status,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (row) => {
      toast.success(isEdit ? "Episode updated" : "Episode created");
      void qc.invalidateQueries({ queryKey: ["podcast-episodes-admin"] });
      void qc.invalidateQueries({ queryKey: ["podcasts-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["podcast-episode", row.id] });
      if (!isEdit) {
        navigate({ to: "/admin/podcasts/$id", params: { id: row.id } });
      } else {
        setForm({ ...row, status: row.status as PodcastStatus });
        setTagsInput((row.tags ?? []).join(", "));
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAudio = useMutation({
    mutationFn: (file: File) => {
      validateAudioFile(file);
      return uploadPodcastAudio({ data: { file, episode_id: episodeId, title: form.title } });
    },
    onSuccess: ({ episode }) => {
      toast.success("Audio processed");
      patch({
        audio_url: episode.audio_url,
        audio_path: episode.audio_path,
        audio_asset_id: episode.audio_asset_id,
        duration: episode.duration,
        duration_seconds: episode.duration_seconds,
        file_size_bytes: episode.file_size_bytes,
        processing_status: episode.processing_status,
      });
      void qc.invalidateQueries({ queryKey: ["podcast-episode", episodeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isEdit && detailQ.isLoading) return <CmsPageSkeleton metrics={0} panels={3} />;

  const shows = showsQ.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow={isEdit ? "Edit episode" : "Create episode"}
        title={isEdit ? form.title || "Edit episode" : "New episode"}
        description="Basic details, audio, transcript, and SEO for this podcast episode."
        actions={
          <Link to="/admin/podcasts/episodes" className={cmsSecondaryButton}>
            Back to episodes
          </Link>
        }
      />

      {detailQ.error ? <CmsAlert>{detailQ.error.message}</CmsAlert> : null}
      {save.error ? <CmsAlert>{save.error.message}</CmsAlert> : null}
      {uploadAudio.error ? <CmsAlert>{uploadAudio.error.message}</CmsAlert> : null}

      <CmsPanel title="Basic information" description="Title, slug, show, and publishing status">
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="Title" hint="Required">
            <input
              className={cmsInput}
              value={form.title}
              onChange={(event) => {
                const title = event.target.value;
                patch({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
              }}
            />
          </Field>
          <Field label="Slug" hint="Used in /podcast/<slug>">
            <input
              className={cmsInput}
              value={form.slug ?? ""}
              onChange={(event) => {
                setSlugTouched(true);
                patch({ slug: event.target.value });
              }}
            />
          </Field>
          <Field label="Show">
            <select
              className={cmsInput}
              value={form.show_id ?? ""}
              onChange={(event) => patch({ show_id: event.target.value || null })}
            >
              <option value="">No show</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input
              className={cmsInput}
              value={form.category ?? ""}
              onChange={(e) => patch({ category: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={cmsInput}
              value={form.status}
              onChange={(event) => patch({ status: event.target.value as PodcastStatus })}
            >
              {["draft", "review", "scheduled", "published", "archived"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visibility">
            <select
              className={cmsInput}
              value={form.visibility}
              onChange={(event) =>
                patch({ visibility: event.target.value as PodcastEpisodeInput["visibility"] })
              }
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </Field>
          {form.status === "scheduled" ? (
            <Field label="Scheduled for" hint="Publishes automatically at this time">
              <input
                type="datetime-local"
                className={cmsInput}
                value={toDateTimeInputValue(form.scheduled_for)}
                onChange={(event) =>
                  patch({
                    scheduled_for: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : "",
                  })
                }
              />
            </Field>
          ) : null}
          {form.status === "published" ? (
            <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-xs font-semibold">Featured episode</span>
              <input
                type="checkbox"
                checked={Boolean(form.is_featured)}
                onChange={(event) => patch({ is_featured: event.target.checked })}
              />
            </label>
          ) : null}
        </div>
      </CmsPanel>

      <CmsPanel
        title="Episode details"
        description="Hosts, guests, season/episode numbers, and taxonomy"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <Field label="Host">
            <input
              className={cmsInput}
              value={form.host ?? ""}
              onChange={(e) => patch({ host: e.target.value })}
            />
          </Field>
          <Field label="Guests">
            <input
              className={cmsInput}
              value={form.guests ?? ""}
              onChange={(e) => patch({ guests: e.target.value })}
            />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <input
              className={cmsInput}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </Field>
          <Field label="Season number">
            <input
              type="number"
              className={cmsInput}
              value={form.season_number ?? ""}
              onChange={(e) =>
                patch({ season_number: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="Episode number">
            <input
              type="number"
              className={cmsInput}
              value={form.episode_number ?? ""}
              onChange={(e) =>
                patch({ episode_number: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="Language">
            <input
              className={cmsInput}
              value={form.language ?? "en"}
              onChange={(e) => patch({ language: e.target.value })}
            />
          </Field>
          <Field label="Region">
            <input
              className={cmsInput}
              value={form.region ?? ""}
              onChange={(e) => patch({ region: e.target.value })}
            />
          </Field>
          <Field label="Credits">
            <input
              className={cmsInput}
              value={form.credits ?? ""}
              onChange={(e) => patch({ credits: e.target.value })}
            />
          </Field>
          <Field label="External URL" hint="Spotify / Apple Podcasts / YouTube">
            <input
              className={cmsInput}
              value={form.external_url ?? ""}
              onChange={(e) => patch({ external_url: e.target.value })}
            />
          </Field>
          <div className="lg:col-span-3">
            <Field label="References">
              <textarea
                className={`${cmsInput} h-auto py-2`}
                rows={2}
                value={form.references_text ?? ""}
                onChange={(event) => patch({ references_text: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </CmsPanel>

      <CmsPanel title="Content" description="Description, short description, and full transcript">
        <div className="grid gap-4 p-5">
          <Field label="Description">
            <textarea
              className={`${cmsInput} h-auto py-2`}
              rows={4}
              value={form.description ?? ""}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <Field label="Short description" hint="Used in cards and listings">
            <input
              className={cmsInput}
              value={form.short_description ?? ""}
              onChange={(event) => patch({ short_description: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
            <Field label="Transcript">
              <textarea
                className={`${cmsInput} h-auto py-2`}
                rows={8}
                value={form.transcript ?? ""}
                onChange={(event) => patch({ transcript: event.target.value })}
              />
            </Field>
            <Field label="Transcript language">
              <input
                className={cmsInput}
                value={form.transcript_language ?? "en"}
                onChange={(e) => patch({ transcript_language: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </CmsPanel>

      <CmsPanel
        title="Audio & artwork"
        description="Upload or replace the audio file, and set episode artwork"
      >
        <div className="space-y-4 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Artwork URL">
              <input
                className={cmsInput}
                value={form.artwork_url ?? ""}
                onChange={(e) => patch({ artwork_url: e.target.value })}
              />
            </Field>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                <span className="text-xs font-semibold">Allow download</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.allow_download)}
                  onChange={(event) => patch({ allow_download: event.target.checked })}
                />
              </label>
              <label className="flex flex-1 items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                <span className="text-xs font-semibold">Allow embed</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.allow_embed)}
                  onChange={(event) => patch({ allow_embed: event.target.checked })}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {form.artwork_url ? (
                <img src={form.artwork_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Mic className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              <div>
                {form.duration || formatDuration(form.duration_seconds) || "Duration unknown"}
                {form.file_size_bytes ? ` · ${formatBytes(form.file_size_bytes)}` : ""}
              </div>
            </div>
            {form.processing_status ? <StatusBadge status={form.processing_status} /> : null}
          </div>

          {form.audio_url ? (
            <AudioPlayer src={form.audio_url} allowDownload={Boolean(form.allow_download)} />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAudio.mutate(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={uploadAudio.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploadAudio.isPending
                ? "Processing…"
                : form.audio_url
                  ? "Replace audio"
                  : "Attach audio"}
            </button>
          </div>
        </div>
      </CmsPanel>

      <CmsPanel
        title="SEO & social"
        description="Overrides used for search results and social sharing"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="SEO title" hint="Falls back to episode title">
            <input
              className={cmsInput}
              value={form.seo_title ?? ""}
              onChange={(e) => patch({ seo_title: e.target.value })}
            />
          </Field>
          <Field label="OG image URL" hint="Falls back to artwork">
            <input
              className={cmsInput}
              value={form.og_image_url ?? ""}
              onChange={(e) => patch({ og_image_url: e.target.value })}
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="SEO description" hint="Falls back to short/full description">
              <textarea
                className={`${cmsInput} h-auto py-2`}
                rows={3}
                value={form.seo_description ?? ""}
                onChange={(event) => patch({ seo_description: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </CmsPanel>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link to="/admin/podcasts/episodes" className={cmsSecondaryButton}>
          Cancel
        </Link>
        <button
          type="button"
          className={cmsSecondaryButton}
          disabled={save.isPending || !form.title.trim()}
          onClick={() => save.mutate(undefined)}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        {form.status !== "published" ? (
          <button
            type="button"
            className={cmsButton}
            disabled={save.isPending || !form.title.trim()}
            onClick={() => save.mutate("published")}
          >
            Save & publish
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EpisodesCreatePage() {
  return <PodcastEpisodeForm />;
}

export function EpisodesEditPage({ episodeId }: { episodeId: string }) {
  return <PodcastEpisodeForm episodeId={episodeId} />;
}
