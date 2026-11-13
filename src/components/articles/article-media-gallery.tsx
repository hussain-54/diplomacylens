import { useCallback, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImageIcon,
  ImagePlus,
  Replace,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Field, cmsInput, cmsSecondaryButton } from "@/components/cms";
import type { ArticleGalleryImage } from "@/lib/article-cms-extras";
import { cn } from "@/lib/utils";

const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const fieldClass = cn(
  cmsInput,
  "h-11 rounded-xl border-border/70 shadow-none focus-visible:ring-primary/20",
);

function galleryId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withOrder(items: ArticleGalleryImage[]): ArticleGalleryImage[] {
  return items.map((item, index) => ({
    ...item,
    id: item.id || galleryId(),
    display_order: index,
  }));
}

export function ArticleMediaGallery({
  heroUrl,
  onHeroUrl,
  gallery,
  onGalleryChange,
  featuredAlt,
  featuredCaption,
  featuredCredit,
  onFeaturedMeta,
  readOnly,
  mayUpload,
  onUpload,
  onInsertIntoArticle,
  onInsertAllIntoArticle,
  uploadBusy,
  uploadError,
}: {
  heroUrl: string;
  onHeroUrl: (url: string) => void;
  gallery: ArticleGalleryImage[];
  onGalleryChange: (gallery: ArticleGalleryImage[]) => void;
  featuredAlt: string;
  featuredCaption: string;
  featuredCredit: string;
  onFeaturedMeta: (meta: { alt_text?: string; caption?: string; credit?: string }) => void;
  readOnly?: boolean;
  mayUpload?: boolean;
  onUpload?: (file: File) => Promise<string>;
  onInsertIntoArticle?: (item: { url: string; alt: string; caption: string }) => void;
  onInsertAllIntoArticle?: (items: Array<{ url: string; alt: string; caption: string }>) => void;
  uploadBusy?: boolean;
  uploadError?: string | null;
}) {
  const inputId = useId();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const busy = uploadBusy || localBusy;
  const error = localError || uploadError;

  const items = withOrder(gallery);

  const commit = useCallback(
    (next: ArticleGalleryImage[]) => {
      const ordered = withOrder(next);
      onGalleryChange(ordered);
      const featured = ordered.find((item) => item.is_featured) ?? ordered[0];
      if (featured?.url && featured.url !== heroUrl) {
        onHeroUrl(featured.url);
        if (featured.alt) onFeaturedMeta({ alt_text: featured.alt });
        if (featured.caption) onFeaturedMeta({ caption: featured.caption });
      }
      if (!ordered.length && heroUrl) {
        // Keep hero if gallery emptied via other controls; featured clear is explicit.
      }
    },
    [heroUrl, onFeaturedMeta, onGalleryChange, onHeroUrl],
  );

  const uploadFiles = async (files: FileList | File[]) => {
    if (!onUpload || readOnly || !mayUpload) return;
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name),
    );
    if (!list.length) {
      setLocalError("Select JPG, JPEG, PNG, or WEBP images.");
      return;
    }
    setLocalBusy(true);
    setLocalError(null);
    try {
      // Do not pre-optimize here — onUpload already runs optimizeImageFile once.
      const uploaded: ArticleGalleryImage[] = [];
      for (const raw of list) {
        const url = await onUpload(raw);
        uploaded.push({
          id: galleryId(),
          url,
          alt: raw.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
          caption: "",
          is_featured: false,
        });
      }
      const next = [...items, ...uploaded];
      if (!heroUrl && next[0]) {
        next[0] = { ...next[0], is_featured: true };
        onHeroUrl(next[0].url);
        onFeaturedMeta({ alt_text: next[0].alt || "" });
      } else if (heroUrl && !next.some((i) => i.is_featured)) {
        const heroIdx = next.findIndex((i) => i.url === heroUrl);
        if (heroIdx >= 0) next[heroIdx] = { ...next[heroIdx], is_featured: true };
      }
      commit(next);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLocalBusy(false);
    }
  };

  const setFeatured = (index: number) => {
    if (readOnly) return;
    const next = items.map((item, i) => ({ ...item, is_featured: i === index }));
    commit(next);
    const featured = next[index];
    if (featured?.url) {
      onHeroUrl(featured.url);
      onFeaturedMeta({
        alt_text: featured.alt || featuredAlt,
        caption: featured.caption || featuredCaption,
      });
    }
  };

  const move = (index: number, delta: number) => {
    if (readOnly) return;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    commit(next);
  };

  const removeAt = (index: number) => {
    if (readOnly) return;
    const removed = items[index];
    const next = items.filter((_, i) => i !== index);
    if (removed?.is_featured && next[0]) {
      next[0] = { ...next[0], is_featured: true };
      onHeroUrl(next[0].url);
    } else if (!next.length && removed?.url === heroUrl) {
      onHeroUrl("");
    }
    commit(next);
  };

  const patchItem = (index: number, patch: Partial<ArticleGalleryImage>) => {
    if (readOnly) return;
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    commit(next);
    if (next[index]?.is_featured) {
      onFeaturedMeta({
        alt_text: next[index].alt || "",
        caption: next[index].caption || "",
      });
    }
  };

  const replaceAt = async (index: number, file: File) => {
    if (!onUpload || readOnly) return;
    setLocalBusy(true);
    setLocalError(null);
    try {
      const url = await onUpload(file);
      patchItem(index, {
        url,
        alt: items[index]?.alt || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      });
      if (items[index]?.is_featured) onHeroUrl(url);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Replace failed.");
    } finally {
      setLocalBusy(false);
      setReplaceIndex(null);
    }
  };

  const onDropReorder = (toIndex: number) => {
    if (dragIndex == null || dragIndex === toIndex || readOnly) {
      setDragIndex(null);
      return;
    }
    const next = [...items];
    const [row] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, row);
    setDragIndex(null);
    commit(next);
  };

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-xl border border-dashed p-6 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/70 bg-muted/20",
          (readOnly || !mayUpload) && "opacity-70",
        )}
        onDragOver={(e) => {
          if (readOnly || !mayUpload) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Drop images here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, JPEG, PNG, WEBP · multi-select (10+) · aspect ratio preserved
            </p>
          </div>
          {mayUpload && onUpload ? (
            <label
              htmlFor={inputId}
              className={cn(
                cmsSecondaryButton,
                "cursor-pointer",
                (readOnly || busy) && "pointer-events-none opacity-50",
              )}
            >
              <ImagePlus className="h-4 w-4" />
              {busy ? "Uploading…" : "Select images"}
              <input
                id={inputId}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="sr-only"
                disabled={readOnly || busy}
                onChange={(e) => {
                  if (e.target.files?.length) void uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {busy ? (
        <p className="text-xs text-muted-foreground">Uploading images — please wait…</p>
      ) : null}

      {items.length >= 2 && onInsertAllIntoArticle && !readOnly ? (
        <button
          type="button"
          className={cn(cmsSecondaryButton, "w-full sm:w-auto")}
          onClick={() =>
            onInsertAllIntoArticle(
              items
                .filter((item) => item.url)
                .map((item) => ({
                  url: item.url,
                  alt: item.alt || "",
                  caption: item.caption || "",
                })),
            )
          }
        >
          <ImagePlus className="h-4 w-4" />
          Insert all into article (2 per row)
        </button>
      ) : null}

      {!items.length ? (
        <div className="flex h-36 items-center justify-center rounded-xl border border-border/70 bg-muted/10 text-sm text-muted-foreground">
          <ImageIcon className="mr-2 h-4 w-4" />
          No gallery images yet — upload to build the article media set
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={item.id || `${item.url}-${index}`}
              draggable={!readOnly}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropReorder(index)}
              className={cn(
                "rounded-xl border border-border/70 bg-background p-3 shadow-sm",
                item.is_featured && "ring-1 ring-primary/40",
                dragIndex === index && "opacity-60",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="mt-8 hidden cursor-grab text-muted-foreground sm:block"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                    disabled={readOnly}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <div className="relative flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {item.url ? (
                      <img
                        src={item.url}
                        alt={item.alt || ""}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    {item.is_featured ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        Featured
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      className={cn(cmsSecondaryButton, "h-8 px-2.5 text-xs")}
                      onClick={() => setFeatured(index)}
                      title="Use as featured image"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Featured
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      className={cn(cmsSecondaryButton, "h-8 px-2.5 text-xs")}
                      onClick={() => {
                        setReplaceIndex(index);
                        replaceInputRef.current?.click();
                      }}
                    >
                      <Replace className="h-3.5 w-3.5" />
                      Replace
                    </button>
                    {onInsertIntoArticle && item.url ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        className={cn(cmsSecondaryButton, "h-8 px-2.5 text-xs")}
                        onClick={() =>
                          onInsertIntoArticle({
                            url: item.url,
                            alt: item.alt || "",
                            caption: item.caption || "",
                          })
                        }
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        Insert in article
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={readOnly || index === 0}
                      className={cn(cmsSecondaryButton, "h-8 px-2 text-xs")}
                      onClick={() => move(index, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={readOnly || index === items.length - 1}
                      className={cn(cmsSecondaryButton, "h-8 px-2 text-xs")}
                      onClick={() => move(index, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeAt(index)}
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Field label="Alt text">
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={item.alt ?? ""}
                      onChange={(e) => patchItem(index, { alt: e.target.value })}
                      placeholder="Describe the image for accessibility & SEO"
                    />
                  </Field>
                  <Field label="Caption">
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={item.caption ?? ""}
                      onChange={(e) => patchItem(index, { caption: e.target.value })}
                      placeholder="Optional caption shown below the image"
                    />
                  </Field>
                  <p className="text-[11px] text-muted-foreground">Display order: {index + 1}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replaceIndex != null) void replaceAt(replaceIndex, file);
          e.target.value = "";
        }}
      />

      <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/15 p-4 sm:grid-cols-2">
        <Field label="Featured alt text">
          <input
            disabled={readOnly}
            className={fieldClass}
            value={featuredAlt}
            onChange={(e) => onFeaturedMeta({ alt_text: e.target.value })}
          />
        </Field>
        <Field label="Photographer credit">
          <input
            disabled={readOnly}
            className={fieldClass}
            value={featuredCredit}
            onChange={(e) => onFeaturedMeta({ credit: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Featured caption">
            <textarea
              disabled={readOnly}
              className={cn(fieldClass, "min-h-[72px] py-2.5")}
              value={featuredCaption}
              onChange={(e) => onFeaturedMeta({ caption: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Featured image URL">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={heroUrl}
              onChange={(e) => onHeroUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
