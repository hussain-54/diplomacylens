import { useEffect, useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";
import type { Block } from "@/lib/blocks";
import { cn } from "@/lib/utils";

export type WritingChecklistId =
  | "headline"
  | "category"
  | "featured_image"
  | "introduction"
  | "main_content"
  | "paragraphs"
  | "inline_images"
  | "image_layout"
  | "references"
  | "spelling"
  | "seo"
  | "preview"
  | "publish_status";

export type WritingChecklistInput = {
  title: string;
  deck: string;
  sectionId: string;
  heroImageUrl: string;
  blocks: Block[];
  wordCount: number;
  hasReferences: boolean;
  seoTitle: string;
  metaDescription: string;
  status: string;
  articleId: string;
  isNew: boolean;
};

type ChecklistDef = {
  id: WritingChecklistId;
  label: string;
  /** When true, auto-ok can be overridden by the editor. */
  auto: boolean;
};

const DEFS: ChecklistDef[] = [
  { id: "headline", label: "Article headline added", auto: true },
  { id: "category", label: "Category selected", auto: true },
  { id: "featured_image", label: "Featured image uploaded", auto: true },
  { id: "introduction", label: "Article introduction completed", auto: true },
  { id: "main_content", label: "Main article content written", auto: true },
  { id: "paragraphs", label: "Paragraphs properly formatted", auto: true },
  { id: "inline_images", label: "Images added and correctly positioned", auto: true },
  { id: "image_layout", label: "Image sizes and alignment checked", auto: false },
  { id: "references", label: "Sources and references added where required", auto: true },
  { id: "spelling", label: "Spelling and grammar reviewed", auto: false },
  { id: "seo", label: "SEO title and meta description completed", auto: true },
  { id: "preview", label: "Article preview reviewed", auto: false },
  { id: "publish_status", label: "Final publication status selected", auto: true },
];

function computeAuto(input: WritingChecklistInput): Record<WritingChecklistId, boolean> {
  const paragraphs = input.blocks.filter((b) => b.type === "paragraph" && b.data.text.trim());
  const headings = input.blocks.filter((b) => b.type === "heading" && b.data.text.trim());
  const media = input.blocks.filter(
    (b) =>
      (b.type === "image" && b.data.url) ||
      (b.type === "gallery" && b.data.images.some((img) => img.url)),
  );
  const imagesConfigured = media.every((b) => {
    if (b.type === "image") {
      return Boolean(b.data.size && b.data.align && (b.data.fit || true));
    }
    return true;
  });

  return {
    headline: input.title.trim().length >= 12,
    category: Boolean(input.sectionId.trim()),
    featured_image: Boolean(input.heroImageUrl.trim()),
    introduction: input.deck.trim().length >= 40,
    main_content: input.wordCount >= 200,
    paragraphs: paragraphs.length >= 2 || (paragraphs.length >= 1 && headings.length >= 1),
    inline_images: media.length > 0 || Boolean(input.heroImageUrl.trim()),
    image_layout: media.length > 0 ? imagesConfigured : Boolean(input.heroImageUrl.trim()),
    references: input.hasReferences,
    spelling: false,
    seo:
      (input.seoTitle.trim().length >= 12 || input.title.trim().length >= 12) &&
      input.metaDescription.trim().length >= 50,
    preview: false,
    publish_status: ["review", "approved", "scheduled", "published"].includes(input.status),
  };
}

function storageKey(articleId: string) {
  return `gdl-writing-checklist:${articleId || "new"}`;
}

export function WritingChecklist({
  input,
  className,
}: {
  input: WritingChecklistInput;
  className?: string;
}) {
  const auto = useMemo(() => computeAuto(input), [input]);
  const [overrides, setOverrides] = useState<Partial<Record<WritingChecklistId, boolean>>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(input.articleId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<WritingChecklistId, boolean>>;
      if (parsed && typeof parsed === "object") setOverrides(parsed);
    } catch {
      /* ignore */
    }
  }, [input.articleId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(input.articleId), JSON.stringify(overrides));
    } catch {
      /* ignore */
    }
  }, [overrides, input.articleId]);

  const items = DEFS.map((def) => {
    const computed = auto[def.id];
    const override = overrides[def.id];
    const ok = override !== undefined ? override : computed;
    return { ...def, ok, computed };
  });

  const done = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);

  const toggle = (id: WritingChecklistId, current: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: !current }));
  };

  return (
    <section
      className={cn("border border-border/80 bg-card", className)}
      aria-label="Article writing checklist"
    >
      <div className="border-b border-border/80 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
              Writing checklist
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Track readiness for publication
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {done}/{total}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {pct}% ready
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-navy transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ul className="max-h-[28rem] space-y-0.5 overflow-y-auto px-2 py-2 sm:px-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id, item.ok)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-sm px-2 py-2 text-left text-[12.5px] leading-snug transition-colors",
                item.ok
                  ? "text-foreground hover:bg-muted/60"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                  item.ok
                    ? "border-navy bg-navy text-navy-foreground"
                    : "border-border bg-background",
                )}
              >
                {item.ok ? (
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-2.5 w-2.5 opacity-0" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(item.ok && "text-foreground")}>{item.label}</span>
                {!item.auto ? (
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    Tap to confirm
                  </span>
                ) : overrides[item.id] !== undefined && overrides[item.id] !== item.computed ? (
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    Manually adjusted
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
