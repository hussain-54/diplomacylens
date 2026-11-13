import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsPageSkeleton,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import {
  getPodcastShowAdmin,
  upsertPodcastShow,
  type PodcastShowInput,
} from "@/lib/podcast.functions";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const DEFAULT_FORM: PodcastShowInput = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  short_description: "",
  cover_image_url: "",
  host: "",
  co_hosts: "",
  category: "",
  tags: [],
  language: "en",
  region: "",
  website_url: "",
  youtube_url: "",
  x_url: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  rss_feed_url: "",
  status: "draft",
  visibility: "public",
  is_featured: false,
  seo_title: "",
  seo_description: "",
  og_image_url: "",
};

export function PodcastShowForm({
  showId,
  onSaved,
  onCancel,
}: {
  showId?: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(showId);
  const [form, setForm] = useState<PodcastShowInput>(DEFAULT_FORM);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const detailQ = useQuery({
    queryKey: ["podcast-show", showId],
    queryFn: () => getPodcastShowAdmin(showId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detailQ.data) {
      setForm({ ...detailQ.data, id: detailQ.data.id });
      setSlugTouched(true);
    }
  }, [detailQ.data]);

  const patch = (partial: Partial<PodcastShowInput>) =>
    setForm((current) => ({ ...current, ...partial }));

  const save = useMutation({
    mutationFn: () => upsertPodcastShow({ data: { ...form, id: showId } }),
    onSuccess: (row) => {
      toast.success(isEdit ? "Show updated" : "Show created");
      void qc.invalidateQueries({ queryKey: ["podcast-shows-admin"] });
      void qc.invalidateQueries({ queryKey: ["podcast-shows-lite"] });
      void qc.invalidateQueries({ queryKey: ["podcasts-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["podcast-show", row.id] });
      onSaved?.(row.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isEdit && detailQ.isLoading) return <CmsPageSkeleton metrics={0} panels={2} />;

  return (
    <div className="space-y-5">
      {detailQ.error ? <CmsAlert>{detailQ.error.message}</CmsAlert> : null}
      {save.error ? <CmsAlert>{save.error.message}</CmsAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Subtitle">
          <input
            className={cmsInput}
            value={form.subtitle ?? ""}
            onChange={(e) => patch({ subtitle: e.target.value })}
          />
        </Field>
        <Field label="Host">
          <input
            className={cmsInput}
            value={form.host ?? ""}
            onChange={(e) => patch({ host: e.target.value })}
          />
        </Field>
        <Field label="Co-hosts">
          <input
            className={cmsInput}
            value={form.co_hosts ?? ""}
            onChange={(e) => patch({ co_hosts: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <input
            className={cmsInput}
            value={form.category ?? ""}
            onChange={(e) => patch({ category: e.target.value })}
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
        <Field label="Cover image URL">
          <input
            className={cmsInput}
            value={form.cover_image_url ?? ""}
            onChange={(e) => patch({ cover_image_url: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            className={cmsInput}
            value={form.status}
            onChange={(e) => patch({ status: e.target.value })}
          >
            {["draft", "scheduled", "published", "archived"].map((option) => (
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
            onChange={(event) => patch({ visibility: event.target.value })}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </Field>
        {form.status === "published" ? (
          <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
            <span className="text-xs font-semibold">Featured show</span>
            <input
              type="checkbox"
              checked={Boolean(form.is_featured)}
              onChange={(event) => patch({ is_featured: event.target.checked })}
            />
          </label>
        ) : null}
      </div>

      <Field label="Description">
        <textarea
          className={`${cmsInput} h-auto py-2`}
          rows={3}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website URL">
          <input
            className={cmsInput}
            value={form.website_url ?? ""}
            onChange={(e) => patch({ website_url: e.target.value })}
          />
        </Field>
        <Field label="RSS feed URL">
          <input
            className={cmsInput}
            value={form.rss_feed_url ?? ""}
            onChange={(e) => patch({ rss_feed_url: e.target.value })}
          />
        </Field>
        <Field label="YouTube URL">
          <input
            className={cmsInput}
            value={form.youtube_url ?? ""}
            onChange={(e) => patch({ youtube_url: e.target.value })}
          />
        </Field>
        <Field label="X (Twitter) URL">
          <input
            className={cmsInput}
            value={form.x_url ?? ""}
            onChange={(e) => patch({ x_url: e.target.value })}
          />
        </Field>
        <Field label="Facebook URL">
          <input
            className={cmsInput}
            value={form.facebook_url ?? ""}
            onChange={(e) => patch({ facebook_url: e.target.value })}
          />
        </Field>
        <Field label="Instagram URL">
          <input
            className={cmsInput}
            value={form.instagram_url ?? ""}
            onChange={(e) => patch({ instagram_url: e.target.value })}
          />
        </Field>
        <Field label="LinkedIn URL">
          <input
            className={cmsInput}
            value={form.linkedin_url ?? ""}
            onChange={(e) => patch({ linkedin_url: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SEO title" hint="Falls back to show title">
          <input
            className={cmsInput}
            value={form.seo_title ?? ""}
            onChange={(e) => patch({ seo_title: e.target.value })}
          />
        </Field>
        <Field label="OG image URL" hint="Falls back to cover image">
          <input
            className={cmsInput}
            value={form.og_image_url ?? ""}
            onChange={(e) => patch({ og_image_url: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="SEO description" hint="Falls back to description">
            <textarea
              className={`${cmsInput} h-auto py-2`}
              rows={2}
              value={form.seo_description ?? ""}
              onChange={(event) => patch({ seo_description: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
        {onCancel ? (
          <button type="button" className={cmsSecondaryButton} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className={cmsButton}
          disabled={save.isPending || !form.title.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create show"}
        </button>
      </div>
    </div>
  );
}
