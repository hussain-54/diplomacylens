import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Trash2, Upload } from "lucide-react";
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
import { VideoPlayer } from "@/components/videos/video-player";
import { formatBytes } from "@/lib/dam";
import {
  addVideoCaption,
  deleteVideoCaption,
  formatDuration,
  getVideoAdmin,
  listVideoCaptions,
  uploadVideoFile,
  upsertVideoFull,
  validateVideoFile,
  type VideoInput,
  type VideoStatus,
} from "@/lib/video.functions";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const DEFAULT_FORM: VideoInput = {
  title: "",
  slug: "",
  category: "",
  thumbnail_url: "",
  video_url: "",
  description: "",
  short_description: "",
  credits: "",
  source: "",
  author_name: "",
  language: "en",
  region: "",
  tags: [],
  status: "draft",
  visibility: "public",
  allow_download: false,
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

function VideoForm({ videoId }: { videoId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(videoId);
  const [form, setForm] = useState<VideoInput>(DEFAULT_FORM);
  const [tagsInput, setTagsInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const [captionLanguage, setCaptionLanguage] = useState("en");
  const [captionLabel, setCaptionLabel] = useState("");

  const detailQ = useQuery({
    queryKey: ["video-admin", videoId],
    queryFn: () => getVideoAdmin(videoId!),
    enabled: isEdit,
  });

  const captionsQ = useQuery({
    queryKey: ["video-captions", videoId],
    queryFn: () => listVideoCaptions(videoId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detailQ.data) {
      setForm({
        ...detailQ.data,
        id: detailQ.data.id,
        status: detailQ.data.status as VideoStatus,
      });
      setTagsInput((detailQ.data.tags ?? []).join(", "));
      setSlugTouched(true);
    }
  }, [detailQ.data]);

  const patch = (partial: Partial<VideoInput>) =>
    setForm((current) => ({ ...current, ...partial }));

  const save = useMutation({
    mutationFn: (status?: VideoStatus) =>
      upsertVideoFull({
        data: {
          ...form,
          id: videoId,
          status: status ?? form.status,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (row) => {
      toast.success(isEdit ? "Video updated" : "Video created");
      void qc.invalidateQueries({ queryKey: ["videos-admin"] });
      void qc.invalidateQueries({ queryKey: ["videos-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["video-admin", row.id] });
      if (!isEdit) {
        navigate({ to: "/admin/videos/$id", params: { id: row.id } });
      } else {
        setForm({ ...row, status: row.status as VideoStatus });
        setTagsInput((row.tags ?? []).join(", "));
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadVideo = useMutation({
    mutationFn: (file: File) => {
      validateVideoFile(file);
      return uploadVideoFile({ data: { file, video_id: videoId, title: form.title } });
    },
    onSuccess: ({ video }) => {
      toast.success("Video processed");
      patch({
        video_url: video.video_url,
        video_path: video.video_path,
        video_asset_id: video.video_asset_id,
        duration: video.duration,
        duration_seconds: video.duration_seconds,
        file_size_bytes: video.file_size_bytes,
        processing_status: video.processing_status,
      });
      void qc.invalidateQueries({ queryKey: ["video-admin", videoId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addCaption = useMutation({
    mutationFn: (file: File) =>
      addVideoCaption({
        data: {
          video_id: videoId!,
          language: captionLanguage || "en",
          label: captionLabel || null,
          file,
        },
      }),
    onSuccess: () => {
      toast.success("Caption added");
      setCaptionLabel("");
      void qc.invalidateQueries({ queryKey: ["video-captions", videoId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCaption = useMutation({
    mutationFn: (id: string) => deleteVideoCaption({ data: { id } }),
    onSuccess: () => {
      toast.success("Caption removed");
      void qc.invalidateQueries({ queryKey: ["video-captions", videoId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isEdit && detailQ.isLoading) return <CmsPageSkeleton metrics={0} panels={3} />;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow={isEdit ? "Edit video" : "Create video"}
        title={isEdit ? form.title || "Edit video" : "New video"}
        description="Basic details, video file, captions, and SEO for this video."
        actions={
          <Link to="/admin/videos/library" className={cmsSecondaryButton}>
            Back to library
          </Link>
        }
      />

      {detailQ.error ? <CmsAlert>{detailQ.error.message}</CmsAlert> : null}
      {save.error ? <CmsAlert>{save.error.message}</CmsAlert> : null}
      {uploadVideo.error ? <CmsAlert>{uploadVideo.error.message}</CmsAlert> : null}

      <CmsPanel
        title="Basic information"
        description="Title, slug, category, and publishing status"
      >
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
          <Field label="Slug" hint="Used in /video/<slug>">
            <input
              className={cmsInput}
              value={form.slug ?? ""}
              onChange={(event) => {
                setSlugTouched(true);
                patch({ slug: event.target.value });
              }}
            />
          </Field>
          <Field label="Category">
            <input
              className={cmsInput}
              value={form.category ?? ""}
              onChange={(e) => patch({ category: e.target.value })}
            />
          </Field>
          <Field label="Author / reporter">
            <input
              className={cmsInput}
              value={form.author_name ?? ""}
              onChange={(e) => patch({ author_name: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={cmsInput}
              value={form.status}
              onChange={(event) => patch({ status: event.target.value as VideoStatus })}
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
                patch({ visibility: event.target.value as VideoInput["visibility"] })
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
              <span className="text-xs font-semibold">Featured video</span>
              <input
                type="checkbox"
                checked={Boolean(form.is_featured)}
                onChange={(event) => patch({ is_featured: event.target.checked })}
              />
            </label>
          ) : null}
        </div>
      </CmsPanel>

      <CmsPanel title="Details" description="Credits, source, tags, and language">
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <Field label="Credits">
            <input
              className={cmsInput}
              value={form.credits ?? ""}
              onChange={(e) => patch({ credits: e.target.value })}
            />
          </Field>
          <Field label="Source">
            <input
              className={cmsInput}
              value={form.source ?? ""}
              onChange={(e) => patch({ source: e.target.value })}
            />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <input
              className={cmsInput}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
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
        </div>
      </CmsPanel>

      <CmsPanel title="Content" description="Description and short description">
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
        </div>
      </CmsPanel>

      <CmsPanel
        title="Video file & thumbnail"
        description="Upload or replace the video file, and set a thumbnail"
      >
        <div className="space-y-4 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Thumbnail URL">
              <input
                className={cmsInput}
                value={form.thumbnail_url ?? ""}
                onChange={(e) => patch({ thumbnail_url: e.target.value })}
              />
            </Field>
            <label className="flex items-end justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-xs font-semibold">Allow download</span>
              <input
                type="checkbox"
                checked={Boolean(form.allow_download)}
                onChange={(event) => patch({ allow_download: event.target.checked })}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {form.thumbnail_url ? (
                <img src={form.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Film className="h-5 w-5 text-muted-foreground" />
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

          {form.video_url ? (
            <VideoPlayer
              src={form.video_url}
              poster={form.thumbnail_url}
              allowDownload={Boolean(form.allow_download)}
              captions={captionsQ.data ?? []}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mov"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadVideo.mutate(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={uploadVideo.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploadVideo.isPending
                ? "Processing…"
                : form.video_url
                  ? "Replace video"
                  : "Attach video"}
            </button>
          </div>
        </div>
      </CmsPanel>

      {isEdit ? (
        <CmsPanel
          title="Captions"
          description="Add VTT or SRT caption tracks for accessibility and SEO"
        >
          <div className="space-y-4 p-5">
            {(captionsQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No captions added yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {(captionsQ.data ?? []).map((caption) => (
                  <li key={caption.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {caption.label || caption.language} ({caption.format.toUpperCase()})
                        {caption.is_default ? (
                          <span className="ml-2 text-[10px] font-semibold uppercase text-primary">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{caption.language}</div>
                    </div>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-cat-rose"
                      aria-label="Remove caption"
                      onClick={() => removeCaption.mutate(caption.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-28">
                <Field label="Language">
                  <input
                    className={cmsInput}
                    value={captionLanguage}
                    onChange={(e) => setCaptionLanguage(e.target.value)}
                  />
                </Field>
              </div>
              <div className="min-w-[160px] flex-1">
                <Field label="Label">
                  <input
                    className={cmsInput}
                    placeholder="e.g. English"
                    value={captionLabel}
                    onChange={(e) => setCaptionLabel(e.target.value)}
                  />
                </Field>
              </div>
              <input
                ref={captionInputRef}
                type="file"
                accept=".vtt,.srt"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) addCaption.mutate(file);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className={cmsSecondaryButton}
                disabled={addCaption.isPending}
                onClick={() => captionInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />{" "}
                {addCaption.isPending ? "Uploading…" : "Add caption file"}
              </button>
            </div>
          </div>
        </CmsPanel>
      ) : null}

      <CmsPanel
        title="SEO & social"
        description="Overrides used for search results and social sharing"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="SEO title" hint="Falls back to video title">
            <input
              className={cmsInput}
              value={form.seo_title ?? ""}
              onChange={(e) => patch({ seo_title: e.target.value })}
            />
          </Field>
          <Field label="OG image URL" hint="Falls back to thumbnail">
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
        <Link to="/admin/videos/library" className={cmsSecondaryButton}>
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

export function VideosCreatePage() {
  return <VideoForm />;
}

export function VideosEditPage({ videoId }: { videoId: string }) {
  return <VideoForm videoId={videoId} />;
}
