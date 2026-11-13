import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload } from "lucide-react";
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
import { formatBytes } from "@/lib/dam";
import {
  getEpaperEditionAdmin,
  uploadEpaperPdf,
  upsertEpaperEditionFull,
  validatePdfFile,
  type EpaperEditionInput,
  type EpaperStatus,
} from "@/lib/epaper.functions";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const EDITION_TYPES = ["daily", "weekly", "special", "supplement"];

const DEFAULT_FORM: EpaperEditionInput = {
  title: "",
  slug: "",
  description: "",
  published_at: "",
  volume_number: "",
  issue_number: "",
  edition_number: "",
  edition_type: "daily",
  language: "en",
  region: "",
  category: "",
  status: "draft",
  visibility: "public",
  scheduled_for: "",
  is_featured: false,
  allow_download: true,
  allow_print: true,
  seo_title: "",
  seo_description: "",
  og_image_url: "",
  cover_image_url: "",
  publisher: "",
  editor_name: "",
  copyright: "",
  credits: "",
  sort_order: 0,
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

function EpaperEditionForm({ editionId }: { editionId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(editionId);
  const [form, setForm] = useState<EpaperEditionInput>(DEFAULT_FORM);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detailQ = useQuery({
    queryKey: ["epaper-edition", editionId],
    queryFn: () => getEpaperEditionAdmin(editionId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detailQ.data) {
      setForm({
        ...detailQ.data,
        id: detailQ.data.id,
        status: detailQ.data.status as EpaperStatus,
        visibility: (detailQ.data.visibility as EpaperEditionInput["visibility"]) ?? "public",
      });
      setSlugTouched(true);
    }
  }, [detailQ.data]);

  const patch = (partial: Partial<EpaperEditionInput>) =>
    setForm((current) => ({ ...current, ...partial }));

  const save = useMutation({
    mutationFn: (status?: EpaperStatus) =>
      upsertEpaperEditionFull({ data: { ...form, id: editionId, status: status ?? form.status } }),
    onSuccess: (row) => {
      toast.success(isEdit ? "Edition updated" : "Edition created");
      void qc.invalidateQueries({ queryKey: ["epaper-editions-admin"] });
      void qc.invalidateQueries({ queryKey: ["epaper-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["epaper-edition", row.id] });
      if (!isEdit) {
        navigate({ to: "/admin/epaper/$id", params: { id: row.id } });
      } else {
        setForm({
          ...row,
          status: row.status as EpaperStatus,
          visibility: (row.visibility as EpaperEditionInput["visibility"]) ?? "public",
        });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadPdf = useMutation({
    mutationFn: (file: File) => {
      validatePdfFile(file);
      return uploadEpaperPdf({ data: { file, edition_id: editionId, title: form.title } });
    },
    onSuccess: ({ edition }) => {
      toast.success("PDF processed");
      patch({
        pdf_url: edition.pdf_url,
        pdf_path: edition.pdf_path,
        pdf_asset_id: edition.pdf_asset_id,
        page_count: edition.page_count,
        file_size_bytes: edition.file_size_bytes,
        processing_status: edition.processing_status,
      });
      void qc.invalidateQueries({ queryKey: ["epaper-edition", editionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isEdit && detailQ.isLoading) return <CmsPageSkeleton metrics={0} panels={3} />;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow={isEdit ? "Edit edition" : "Create edition"}
        title={isEdit ? form.title || "Edit edition" : "New edition"}
        description="Basic details, publication metadata, SEO, and PDF processing status."
        actions={
          <Link to="/admin/epaper/editions" className={cmsSecondaryButton}>
            Back to editions
          </Link>
        }
      />

      {detailQ.error ? <CmsAlert>{detailQ.error.message}</CmsAlert> : null}
      {save.error ? <CmsAlert>{save.error.message}</CmsAlert> : null}
      {uploadPdf.error ? <CmsAlert>{uploadPdf.error.message}</CmsAlert> : null}

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
          <Field label="Slug" hint="Used in /epaper/<slug>">
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
            <Field label="Description">
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
              onChange={(event) => patch({ status: event.target.value as EpaperStatus })}
            >
              {["draft", "ready", "scheduled", "published", "archived"].map((option) => (
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
                patch({ visibility: event.target.value as EpaperEditionInput["visibility"] })
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
              <span className="text-xs font-semibold">Featured edition</span>
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
        title="Publication details"
        description="Volume, issue, taxonomy, and rights metadata"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <Field label="Volume number">
            <input
              className={cmsInput}
              value={form.volume_number ?? ""}
              onChange={(e) => patch({ volume_number: e.target.value })}
            />
          </Field>
          <Field label="Issue number">
            <input
              className={cmsInput}
              value={form.issue_number ?? ""}
              onChange={(e) => patch({ issue_number: e.target.value })}
            />
          </Field>
          <Field label="Edition number">
            <input
              className={cmsInput}
              value={form.edition_number ?? ""}
              onChange={(e) => patch({ edition_number: e.target.value })}
            />
          </Field>
          <Field label="Edition type">
            <select
              className={cmsInput}
              value={form.edition_type ?? "daily"}
              onChange={(e) => patch({ edition_type: e.target.value })}
            >
              {EDITION_TYPES.map((type) => (
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
          <Field label="Category">
            <input
              className={cmsInput}
              value={form.category ?? ""}
              onChange={(e) => patch({ category: e.target.value })}
            />
          </Field>
          <Field label="Publisher">
            <input
              className={cmsInput}
              value={form.publisher ?? ""}
              onChange={(e) => patch({ publisher: e.target.value })}
            />
          </Field>
          <Field label="Editor name">
            <input
              className={cmsInput}
              value={form.editor_name ?? ""}
              onChange={(e) => patch({ editor_name: e.target.value })}
            />
          </Field>
          <Field label="Copyright">
            <input
              className={cmsInput}
              value={form.copyright ?? ""}
              onChange={(e) => patch({ copyright: e.target.value })}
            />
          </Field>
          <Field label="Credits">
            <input
              className={cmsInput}
              value={form.credits ?? ""}
              onChange={(e) => patch({ credits: e.target.value })}
            />
          </Field>
          <Field label="Cover image URL">
            <input
              className={cmsInput}
              value={form.cover_image_url ?? ""}
              onChange={(e) => patch({ cover_image_url: e.target.value })}
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              className={cmsInput}
              value={form.sort_order ?? 0}
              onChange={(e) => patch({ sort_order: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
            <span className="text-xs font-semibold">Allow download</span>
            <input
              type="checkbox"
              checked={Boolean(form.allow_download)}
              onChange={(event) => patch({ allow_download: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
            <span className="text-xs font-semibold">Allow print</span>
            <input
              type="checkbox"
              checked={Boolean(form.allow_print)}
              onChange={(event) => patch({ allow_print: event.target.checked })}
            />
          </label>
        </div>
      </CmsPanel>

      <CmsPanel
        title="SEO & social"
        description="Overrides used for search results and social sharing"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="SEO title" hint="Falls back to edition title">
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

      <CmsPanel
        title="PDF & processing"
        description="Current file, page count, and processing status"
      >
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {form.cover_image_url ? (
                <img src={form.cover_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              <div>
                {form.pdf_url ? (
                  <a
                    href={form.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    View current PDF
                  </a>
                ) : (
                  "No PDF attached yet"
                )}
              </div>
              <div className="mt-0.5">
                {form.page_count ? `${form.page_count} pages` : "Pages unknown"}
                {form.file_size_bytes ? ` · ${formatBytes(form.file_size_bytes)}` : ""}
              </div>
            </div>
            {form.processing_status ? <StatusBadge status={form.processing_status} /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadPdf.mutate(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={uploadPdf.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploadPdf.isPending ? "Processing…" : form.pdf_url ? "Replace PDF" : "Attach PDF"}
            </button>
          </div>
        </div>
      </CmsPanel>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link to="/admin/epaper/editions" className={cmsSecondaryButton}>
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

export function EpaperCreatePage() {
  return <EpaperEditionForm />;
}

export function EpaperEditPage({ editionId }: { editionId: string }) {
  return <EpaperEditionForm editionId={editionId} />;
}
