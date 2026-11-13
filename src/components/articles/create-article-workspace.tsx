import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Code2,
  Eye,
  FileText,
  Globe2,
  History,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Newspaper,
  Save,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Wand2,
} from "lucide-react";
import { RichEditor } from "@/components/cms";
import type { ArticleEditorTabId } from "@/components/articles/article-editor-tabs";
import { WritingChecklist } from "@/components/articles/writing-checklist";
import { ARTICLE_TYPE_OPTIONS } from "@/lib/article-cms-extras";
import type { Block } from "@/lib/blocks";
import { ARTICLE_DECK_MAX } from "@/lib/article-excerpt";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TABS: Array<{
  key: ArticleEditorTabId;
  label: string;
  icon: typeof FileText;
  group?: string;
}> = [
  { key: "content", label: "Writing", icon: FileText },
  { key: "media", label: "Images", icon: ImageIcon },
  { key: "categories", label: "Category & Tags", icon: Tag },
  { key: "publishing", label: "Publish", icon: Globe2 },
  { key: "seo", label: "SEO", icon: Search },
  { key: "local-seo", label: "Local SEO", icon: MapPin },
  { key: "google-news", label: "Google News", icon: Newspaper },
  { key: "eeat", label: "EEAT", icon: ShieldCheck },
  { key: "schema", label: "Schema", icon: Code2 },
  { key: "social", label: "Social", icon: Share2 },
  { key: "ai", label: "AI Assistant", icon: Sparkles },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-900",
  scheduled: "bg-violet-100 text-violet-900",
  published: "bg-emerald-100 text-emerald-900",
  archived: "bg-muted text-muted-foreground",
};

function statusLabel(status: string) {
  if (status === "review") return "Pending review";
  if (status === "scheduled") return "Scheduled";
  if (status === "published") return "Published";
  if (status === "approved") return "Approved";
  if (status === "archived") return "Archived";
  return "Draft";
}

function FormSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-b border-border/70 py-6 last:border-b-0 first:pt-0 last:pb-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-[13px] font-medium text-foreground">{children}</label>
      {hint ? <span className="text-[11px] tabular-nums text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

const fieldClass =
  "w-full rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-navy/40 focus:ring-2 focus:ring-navy/15 disabled:opacity-60";

export function CreateArticleWorkspace({
  isNew,
  articleId,
  activeTab,
  onTabChange,
  title,
  deck,
  slug,
  articleType,
  summary,
  status,
  scheduledAt,
  scheduleOn,
  expiryOn,
  onTitleChange,
  onDeckChange,
  onSlugChange,
  onArticleTypeChange,
  onSummaryChange,
  onScheduleOn,
  onExpiryOn,
  onOpenPublishing,
  onOpenSeo,
  blocks,
  onBlocksChange,
  onUploadImage,
  readOnly,
  wordCount,
  charCount,
  readingMinutes,
  lastSavedAt,
  dirty,
  saving,
  publishing,
  canSave,
  canPublish,
  canSubmitReview,
  saveBlockedHint,
  seoScore,
  contentScore = 0,
  eeatScore = 0,
  checklist: _checklist,
  sectionId = "",
  heroImageUrl = "",
  hasReferences = false,
  seoTitle = "",
  onSave,
  onSubmitReview,
  onPublish,
  onSchedulePublish,
  publishIntentKey,
  otherTabContent,
  banners,
}: {
  isNew: boolean;
  articleId: string;
  activeTab: ArticleEditorTabId;
  onTabChange: (tab: ArticleEditorTabId) => void;
  title: string;
  deck: string;
  slug: string;
  articleType: string;
  summary: string;
  status: string;
  scheduledAt?: string;
  scheduleOn: boolean;
  expiryOn: boolean;
  onTitleChange: (v: string) => void;
  onDeckChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onArticleTypeChange: (v: string) => void;
  onSummaryChange: (v: string) => void;
  onScheduleOn: (v: boolean) => void;
  onExpiryOn: (v: boolean) => void;
  onOpenPublishing: () => void;
  onOpenSeo: () => void;
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
  readOnly?: boolean;
  wordCount: number;
  charCount: number;
  readingMinutes: number;
  lastSavedAt: Date | null;
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  canSave: boolean;
  canPublish: boolean;
  canSubmitReview: boolean;
  saveBlockedHint?: string | null;
  seoScore: number;
  contentScore?: number;
  eeatScore?: number;
  checklist: Array<{ label: string; ok: boolean }>;
  sectionId?: string;
  heroImageUrl?: string;
  hasReferences?: boolean;
  seoTitle?: string;
  onSave: () => void;
  onSubmitReview: () => void;
  onPublish: () => void;
  onSchedulePublish: () => void;
  publishIntentKey?: number;
  otherTabContent?: ReactNode;
  banners?: ReactNode;
}) {
  const [publishOpen, setPublishOpen] = useState(false);
  const busy = saving || publishing;
  const showPublish = canPublish && status !== "published" && status !== "archived";
  const readability = wordCount > 400 ? 82 : wordCount > 200 ? 68 : 45;
  const engagement = Math.min(95, Math.round(contentScore * 0.9 + (wordCount > 300 ? 8 : 0)));
  const originality = Math.min(95, Math.round(eeatScore * 0.85 + 12));

  useEffect(() => {
    if (publishIntentKey && publishIntentKey > 0 && canSave && !busy) {
      setPublishOpen(true);
    }
  }, [publishIntentKey, canSave, busy]);

  const savedLabel = busy
    ? publishing
      ? "Publishing…"
      : "Saving…"
    : dirty
      ? "Unsaved changes"
      : lastSavedAt
        ? `Saved ${formatRelative(lastSavedAt)}`
        : "All changes saved";

  const publishDateLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not scheduled";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f7f6f3] text-foreground">
      <div className="border-b border-border/80 bg-card">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
          <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground">
              Content
            </Link>
            <span className="text-border">/</span>
            <Link to="/admin/articles" className="hover:text-foreground">
              Articles
            </Link>
            <span className="text-border">/</span>
            <span className="text-foreground">{isNew ? "Create article" : "Edit article"}</span>
          </nav>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                  {isNew ? "Create article" : title.trim() || "Edit article"}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                    STATUS_STYLES[status] ?? STATUS_STYLES.draft,
                  )}
                >
                  {statusLabel(status)}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Newsroom desk for Global Diplomacy Lens — write, illustrate, check quality, then
                publish.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : dirty ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  ) : (
                    <Check className="h-3 w-3 text-emerald-600" />
                  )}
                  {savedLabel}
                </span>
                <span>
                  {wordCount.toLocaleString()} words · {readingMinutes} min read
                </span>
                {saveBlockedHint ? <span className="text-amber-700">{saveBlockedHint}</span> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canSave || busy || readOnly}
                onClick={onSave}
                className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3.5 text-[13px] font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                {saving && !publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save draft
              </button>

              {!isNew ? (
                <Link
                  to="/admin/articles/preview/$articleId"
                  params={{ articleId }}
                  className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3.5 text-[13px] font-medium text-foreground hover:bg-muted/50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Save the article first to preview"
                  className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3.5 text-[13px] font-medium opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
              )}

              {!isNew ? (
                <Link
                  to="/admin/articles/revisions/$articleId"
                  params={{ articleId }}
                  className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3.5 text-[13px] font-medium text-foreground hover:bg-muted/50"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </Link>
              ) : null}

              {canSubmitReview ? (
                <button
                  type="button"
                  disabled={!canSave || busy || readOnly}
                  onClick={onSubmitReview}
                  className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3.5 text-[13px] font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit for review
                </button>
              ) : null}

              {showPublish ? (
                <div className="flex">
                  <button
                    type="button"
                    disabled={!canSave || busy}
                    onClick={() => setPublishOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-l-sm bg-navy px-4 text-[13px] font-semibold text-navy-foreground hover:bg-navy/90 disabled:opacity-50"
                  >
                    {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Publish article
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={!canSave || busy}
                        className="inline-flex h-9 items-center rounded-r-sm border-l border-navy-foreground/20 bg-navy px-2 text-navy-foreground hover:bg-navy/90 disabled:opacity-50"
                        aria-label="Publish options"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setPublishOpen(true)}>
                        Publish now
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={onSchedulePublish}>
                        Schedule publication…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : status === "published" && canPublish ? (
                <button
                  type="button"
                  disabled={!canSave || busy}
                  onClick={onSave}
                  className="inline-flex h-9 items-center rounded-sm bg-navy px-4 text-[13px] font-semibold text-navy-foreground hover:bg-navy/90 disabled:opacity-50"
                >
                  {saving ? "Updating…" : "Update live"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        {banners}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 border border-border/80 bg-card">
            <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border/80 px-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[12.5px] font-medium transition-colors",
                      isActive
                        ? "border-navy text-navy"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "content" ? (
              <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                <FormSection
                  title="Article information"
                  description="Core identity for the story — type and public URL."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Article type</FieldLabel>
                      <select
                        value={articleType || "news"}
                        disabled={readOnly}
                        onChange={(e) => onArticleTypeChange(e.target.value)}
                        className={fieldClass}
                      >
                        {ARTICLE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Slug</FieldLabel>
                      <input
                        value={slug}
                        disabled={readOnly}
                        onChange={(e) => onSlugChange(slugify(e.target.value))}
                        placeholder="auto-generated-from-headline"
                        className={cn(fieldClass, "font-mono text-[13px]")}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                    <button
                      type="button"
                      onClick={() => onTabChange("categories")}
                      className="text-navy hover:underline"
                    >
                      Category & tags →
                    </button>
                    <button
                      type="button"
                      onClick={() => onTabChange("media")}
                      className="text-navy hover:underline"
                    >
                      Featured image & gallery →
                    </button>
                  </div>
                </FormSection>

                <FormSection
                  title="Headline & subheadline"
                  description="The public headline and standfirst shown on cards and the article page."
                >
                  <div className="space-y-4">
                    <div>
                      <FieldLabel hint={`${title.length}/120`}>Headline *</FieldLabel>
                      <input
                        value={title}
                        disabled={readOnly}
                        onChange={(e) => {
                          const next = e.target.value.slice(0, 120);
                          onTitleChange(next);
                          if (!slug.trim() && next.trim()) onSlugChange(slugify(next));
                        }}
                        placeholder="Write a clear, newsworthy headline"
                        className={cn(
                          fieldClass,
                          "font-serif text-lg font-semibold tracking-tight sm:text-xl",
                        )}
                      />
                    </div>
                    <div>
                      <FieldLabel hint={`${deck.length}/${ARTICLE_DECK_MAX}`}>
                        Subheadline / introduction
                      </FieldLabel>
                      <textarea
                        value={deck}
                        disabled={readOnly}
                        rows={3}
                        onChange={(e) => onDeckChange(e.target.value.slice(0, ARTICLE_DECK_MAX))}
                        placeholder="2–4 line introduction under the headline…"
                        className={cn(fieldClass, "resize-y leading-relaxed")}
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  title="Main article content"
                  description="Write the full story in one continuous workspace. Use the toolbar for headings, quotes, lists, links and images."
                  action={
                    <button
                      type="button"
                      onClick={() => onTabChange("ai")}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      AI assist
                    </button>
                  }
                >
                  <div className="overflow-hidden rounded-sm border border-border">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3.5 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        Headings, paragraphs, quotes, lists, alignment ·{" "}
                        <kbd className="rounded border border-border bg-card px-1">/</kbd> insert ·
                        toolbar Image / Photos for media between paragraphs
                      </p>
                      <button
                        type="button"
                        onClick={() => onTabChange("media")}
                        className="shrink-0 text-[11px] font-medium text-navy hover:underline"
                      >
                        Inline images & gallery
                      </button>
                    </div>
                    <div className="min-h-[min(70vh,560px)] bg-card px-2 py-3 sm:px-4 sm:py-5">
                      <RichEditor
                        value={blocks}
                        onChange={onBlocksChange}
                        readOnly={readOnly}
                        onUploadImage={onUploadImage}
                        onOpenAi={() => onTabChange("ai")}
                        className="border-0 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-3.5 py-2 text-[11px] text-muted-foreground">
                      <span>
                        {wordCount.toLocaleString()} words · {charCount.toLocaleString()} characters
                        · {readingMinutes} min read
                      </span>
                      <span>{savedLabel}</span>
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  title="SEO settings"
                  description="Search snippet defaults. Full SEO tools live in the SEO tab."
                  action={
                    <button
                      type="button"
                      onClick={onOpenSeo}
                      className="text-[12px] font-medium text-navy hover:underline"
                    >
                      Open SEO panel →
                    </button>
                  }
                >
                  <div>
                    <FieldLabel hint={`${summary.length}/160`}>Meta description</FieldLabel>
                    <textarea
                      value={summary}
                      disabled={readOnly}
                      onChange={(e) => onSummaryChange(e.target.value.slice(0, 160))}
                      placeholder="Concise summary for search results (aim for 50–160 characters)"
                      rows={3}
                      className={cn(fieldClass, "resize-y")}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Preview & publishing"
                  description="Review the public page, then save, schedule or publish."
                >
                  <div className="flex flex-wrap gap-2">
                    {!isNew ? (
                      <Link
                        to="/admin/articles/preview/$articleId"
                        params={{ articleId }}
                        className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3.5 text-[13px] font-medium hover:bg-muted/40"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview article
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={onOpenPublishing}
                      className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3.5 text-[13px] font-medium hover:bg-muted/40"
                    >
                      <Globe2 className="h-3.5 w-3.5" />
                      Publishing options
                    </button>
                    <button
                      type="button"
                      onClick={onSchedulePublish}
                      className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3.5 text-[13px] font-medium hover:bg-muted/40"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Schedule publication
                    </button>
                  </div>
                </FormSection>
              </div>
            ) : (
              <div className="p-4 sm:p-6 lg:p-8">{otherTabContent}</div>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="border border-border/80 bg-card">
              <div className="border-b border-border/80 px-4 py-3">
                <h2 className="text-[13px] font-semibold tracking-tight">Publishing</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Draft, review, schedule or go live
                </p>
              </div>
              <div className="space-y-3 px-4 py-4 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                      STATUS_STYLES[status] ?? STATUS_STYLES.draft,
                    )}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="text-right text-[12px] font-medium">{publishDateLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Schedule publish</span>
                  <Toggle checked={scheduleOn} disabled={readOnly} onChange={onScheduleOn} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Expiry</span>
                  <Toggle checked={expiryOn} disabled={readOnly} onChange={onExpiryOn} />
                </div>
                <button
                  type="button"
                  onClick={onOpenPublishing}
                  className="pt-1 text-[12px] font-medium text-navy hover:underline"
                >
                  Advanced publishing options →
                </button>
              </div>
            </section>

            <WritingChecklist
              input={{
                title,
                deck,
                sectionId,
                heroImageUrl,
                blocks,
                wordCount,
                hasReferences,
                seoTitle: seoTitle || title,
                metaDescription: summary,
                status,
                articleId,
                isNew,
              }}
            />

            <section className="border border-border/80 bg-card">
              <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
                <h2 className="text-[13px] font-semibold tracking-tight">SEO score</h2>
                <button
                  type="button"
                  onClick={onOpenSeo}
                  className="text-[12px] font-medium text-navy hover:underline"
                >
                  Full report
                </button>
              </div>
              <div className="flex items-center gap-4 px-4 py-4">
                <SeoScoreRing score={seoScore} />
                <div>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      seoScore >= 80
                        ? "text-emerald-700"
                        : seoScore >= 55
                          ? "text-amber-700"
                          : "text-rose-700",
                    )}
                  >
                    {seoScore >= 80 ? "Strong" : seoScore >= 55 ? "Fair" : "Needs work"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    EEAT {eeatScore} · Content {contentScore}
                  </p>
                </div>
              </div>
              <div className="space-y-2.5 border-t border-border/80 px-4 py-4">
                <AnalysisBar label="Readability" value={readability} />
                <AnalysisBar label="Engagement" value={engagement} />
                <AnalysisBar label="Originality" value={originality} />
              </div>
            </section>
          </aside>
        </div>
      </div>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this article now?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Publishing only happens when you confirm. Saving a draft never publishes — the
                  story stays private until you go live.
                </p>
                <div className="rounded-sm border border-border bg-muted/30 px-3 py-2.5 text-left text-xs text-foreground">
                  <div className="font-semibold">{title.trim() || "Untitled article"}</div>
                  <div className="mt-1 text-muted-foreground">
                    Status will change to <strong>Published</strong>.
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canSave || busy}
              onClick={(event) => {
                event.preventDefault();
                setPublishOpen(false);
                onPublish();
              }}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Confirm publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-navy" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

function SeoScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <svg width={88} height={88} viewBox="0 0 100 100" className="shrink-0">
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted"
        strokeWidth="7"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-navy"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        className="fill-foreground"
      >
        {score}
      </text>
    </svg>
  );
}

function AnalysisBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-navy/80 transition-all"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatRelative(date: Date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
