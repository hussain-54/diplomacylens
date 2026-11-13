import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsPageHeader,
  CmsPageSkeleton,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import { formatBytes } from "@/lib/dam";
import {
  getInfographicAdmin,
  uploadInfographicAsset,
  upsertInfographicFull,
  type InfographicInput,
  type InfographicStatus,
} from "@/lib/infographics.functions";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const GRAPHIC_TYPES = [
  "static",
  "chart",
  "map",
  "timeline",
  "comparison",
  "data-viz",
  "interactive",
];

const DEFAULT_FORM: InfographicInput = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  long_description: "",
  alt_text: "",
  category: "",
  graphic_type: "static",
  cover_image_url: "",
  source_url: "",
  author_name: "",
  source: "",
  data_source: "",
  methodology: "",
  data_date: "",
  credits: "",
  language: "en",
  region: "",
  tags: [],
  status: "draft",
  visibility: "public",
  scheduled_for: "",
  is_featured: false,
  allow_download: true,
  seo_title: "",
  seo_description: "",
  og_image_url: "",
  published_at: "",
};

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDateTimeInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function InfographicForm({ infographicId }: { infographicId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(infographicId);
  const [form, setForm] = useState<InfographicInput>(DEFAULT_FORM);
  const [tagsInput, setTagsInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detailQ = useQuery({
    queryKey: ["infographic-admin", infographicId],
    queryFn: () => getInfographicAdmin(infographicId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detailQ.data) {
      setForm({
        ...detailQ.data,
        id: detailQ.data.id,
        status: detailQ.data.status as InfographicStatus,
        visibility: detailQ.data.visibility ?? "public",
      });
      setTagsInput((detailQ.data.tags ?? []).join(", "));
      setSlugTouched(true);
    }
  }, [detailQ.data]);

  const patch = (partial: Partial<InfographicInput>) =>
    setForm((current) => ({ ...current, ...partial }));

  const save = useMutation({
    mutationFn: (status?: InfographicStatus) =>
      upsertInfographicFull({
        data: {
          ...form,
          id: infographicId,
          status: status ?? form.status,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (row) => {
      toast.success(isEdit ? "Infographic updated" : "Infographic created");
      void qc.invalidateQueries({ queryKey: ["infographics-library-admin"] });
      void qc.invalidateQueries({ queryKey: ["infographics-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["infographic-admin", row.id] });
      if (!isEdit) {
        navigate({ to: "/admin/infographics/$id", params: { id: row.id } });
      } else {
        setForm({
          ...row,
          status: row.status as InfographicStatus,
          visibility: row.visibility ?? "public",
        });
        setTagsInput((row.tags ?? []).join(", "));
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAsset = useMutation({
    mutationFn: (file: File) =>
      uploadInfographicAsset({ data: { file, infographic_id: infographicId, title: form.title } }),
    onSuccess: ({ item }) => {
      toast.success("Asset uploaded");
      patch({
        asset_url: item.asset_url,
        asset_path: item.asset_path,
        asset_asset_id: item.asset_asset_id,
        cover_image_url: item.cover_image_url,
        source_url: item.source_url,
        file_format: item.file_format,
        file_size_bytes: item.file_size_bytes,
        width: item.width,
        height: item.height,
      });
      void qc.invalidateQueries({ queryKey: ["infographic-admin", infographicId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isEdit && detailQ.isLoading) return <CmsPageSkeleton metrics={0} panels={3} />;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow={isEdit ? "Edit infographic" : "Create infographic"}
        title={isEdit ? form.title || "Edit infographic" : "New infographic"}
        description="Basic details, accessibility, sourcing, and SEO."
        actions={
          <Link to="/admin/infographics/library" className={cmsSecondaryButton}>
            Back to library
          </Link>
        }
      />

      {detailQ.error ? <CmsAlert>{detailQ.error.message}</CmsAlert> : null}
      {save.error ? <CmsAlert>{save.error.message}</CmsAlert> : null}
      {uploadAsset.error ? <CmsAlert>{uploadAsset.error.message}</CmsAlert> : null}

      <CmsPanel
        title="Basic information"
        description="Title, slug, description, and publishing status"
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
          <Field label="Slug" hint="Used in /infographics/<slug>">
            <input
              className={cmsInput}
              value={form.slug ?? ""}
              onChange={(event) => {
                setSlugTouched(true);
                patch({ slug: event.target.value });
              }}
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Subtitle">
              <input
                className={cmsInput}
                value={form.subtitle ?? ""}
                onChange={(e) => patch({ subtitle: e.target.value })}
              />
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label="Description" hint="Short summary shown in listings">
              <textarea
                className={`${cmsInput} h-auto py-2`}
                rows={3}
                value={form.description ?? ""}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              className={cmsInput}
              value={form.status}
              onChange={(event) => patch({ status: event.target.value as InfographicStatus })}
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
                patch({ visibility: event.target.value as InfographicInput["visibility"] })
              }
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </Field>
          <Field label="Published date">
            <input
              type="date"
              className={cmsInput}
              value={toDateInputValue(form.published_at)}
              onChange={(event) =>
                patch({
                  published_at: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : "",
                })
              }
            />
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
              <span className="text-xs font-semibold">Featured infographic</span>
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
        title="Accessibility"
        description="Alt text and extended description for screen readers and SEO"
      >
        <div className="grid gap-4 p-5">
          <Field label="Alt text" hint="Concise description of the visual for assistive tech">
            <input
              className={cmsInput}
              value={form.alt_text ?? ""}
              onChange={(e) => patch({ alt_text: e.target.value })}
            />
          </Field>
          <Field
            label="Long description"
            hint="Detailed narrative of the data/visual, used for accessible summaries"
          >
            <textarea
              className={`${cmsInput} h-auto py-2`}
              rows={4}
              value={form.long_description ?? ""}
              onChange={(event) => patch({ long_description: event.target.value })}
            />
          </Field>
        </div>
      </CmsPanel>

      <CmsPanel title="Sourcing & metadata" description="Taxonomy, authorship, and data provenance">
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <Field label="Category">
            <input
              className={cmsInput}
              value={form.category ?? ""}
              onChange={(e) => patch({ category: e.target.value })}
            />
          </Field>
          <Field label="Graphic type">
            <select
              className={cmsInput}
              value={form.graphic_type ?? "static"}
              onChange={(e) => patch({ graphic_type: e.target.value })}
            >
              {GRAPHIC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
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
          <Field label="Author name">
            <input
              className={cmsInput}
              value={form.author_name ?? ""}
              onChange={(e) => patch({ author_name: e.target.value })}
            />
          </Field>
          <Field label="Source">
            <input
              className={cmsInput}
              value={form.source ?? ""}
              onChange={(e) => patch({ source: e.target.value })}
            />
          </Field>
          <Field label="Data source">
            <input
              className={cmsInput}
              value={form.data_source ?? ""}
              onChange={(e) => patch({ data_source: e.target.value })}
            />
          </Field>
          <Field label="Data date">
            <input
              className={cmsInput}
              placeholder="e.g. Q2 2026"
              value={form.data_date ?? ""}
              onChange={(e) => patch({ data_date: e.target.value })}
            />
          </Field>
          <Field label="Credits">
            <input
              className={cmsInput}
              value={form.credits ?? ""}
              onChange={(e) => patch({ credits: e.target.value })}
            />
          </Field>
          <div className="lg:col-span-3">
            <Field label="Methodology" hint="How the underlying data was gathered or calculated">
              <textarea
                className={`${cmsInput} h-auto py-2`}
                rows={2}
                value={form.methodology ?? ""}
                onChange={(event) => patch({ methodology: event.target.value })}
              />
            </Field>
          </div>
          <div className="lg:col-span-3">
            <Field label="Tags" hint="Comma-separated">
              <input
                className={cmsInput}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
            <span className="text-xs font-semibold">Allow download</span>
            <input
              type="checkbox"
              checked={Boolean(form.allow_download)}
              onChange={(event) => patch({ allow_download: event.target.checked })}
            />
          </label>
        </div>
      </CmsPanel>

      <CmsPanel
        title="SEO & social"
        description="Overrides used for search results and social sharing"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="SEO title" hint="Falls back to infographic title">
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
          <div className="lg:col-span-2">
            <Field label="SEO description" hint="Falls back to description">
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

      <CmsPanel title="Asset" description="Current image/PDF, dimensions, and file details">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {form.cover_image_url ? (
                <img src={form.cover_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              <div>
                {form.asset_url ? (
                  <a
                    href={form.asset_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    View current asset
                  </a>
                ) : (
                  "No asset attached yet"
                )}
              </div>
              <div className="mt-0.5">
                {form.width && form.height
                  ? `${form.width}×${form.height}px`
                  : "Dimensions unknown"}
                {form.file_format ? ` · ${form.file_format.toUpperCase()}` : ""}
                {form.file_size_bytes ? ` · ${formatBytes(form.file_size_bytes)}` : ""}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAsset.mutate(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={uploadAsset.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploadAsset.isPending
                ? "Uploading…"
                : form.asset_url
                  ? "Replace asset"
                  : "Attach asset"}
            </button>
          </div>
          <Field label="Cover image URL" hint="Overrides the thumbnail shown in listings">
            <input
              className={cmsInput}
              value={form.cover_image_url ?? ""}
              onChange={(e) => patch({ cover_image_url: e.target.value })}
            />
          </Field>
          <Field label="Source URL" hint="External source if this infographic links out">
            <input
              className={cmsInput}
              value={form.source_url ?? ""}
              onChange={(e) => patch({ source_url: e.target.value })}
            />
          </Field>
        </div>
      </CmsPanel>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link to="/admin/infographics/library" className={cmsSecondaryButton}>
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

export function InfographicsCreatePage() {
  return <InfographicForm />;
}

export function InfographicsEditPage({ infographicId }: { infographicId: string }) {
  return <InfographicForm infographicId={infographicId} />;
}
