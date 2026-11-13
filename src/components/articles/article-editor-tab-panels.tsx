import { CheckCircle2, Plus, Search, Sparkles } from "lucide-react";
import { ArticleAiAssistantPanel } from "@/components/articles/ai-assistant-panel";
import { ArticleMediaGallery } from "@/components/articles/article-media-gallery";
import { CmsPanel, Field, SEOForm, cmsInput, cmsSecondaryButton } from "@/components/cms";
import type { ArticleSeoInput } from "@/lib/admin.functions";
import {
  ARTICLE_TYPE_OPTIONS,
  type ArticleCmsExtras,
  type ArticleGalleryImage,
} from "@/lib/article-cms-extras";
import type { Block } from "@/lib/blocks";
import { siteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ArticleStatus = Database["public"]["Enums"]["article_status"];

const fieldClass = cn(
  cmsInput,
  "h-11 rounded-xl border-border/70 shadow-none focus-visible:ring-primary/20",
);

function ensureGallery(
  media: NonNullable<ArticleCmsExtras["media"]>,
  heroUrl: string,
): ArticleGalleryImage[] {
  const gallery = [...(media.gallery ?? [])].filter((item) => item.url?.trim());
  if (heroUrl?.trim() && !gallery.some((item) => item.url === heroUrl)) {
    gallery.unshift({
      url: heroUrl,
      alt: media.alt_text ?? "",
      caption: media.caption ?? "",
      is_featured: true,
      display_order: 0,
    });
  } else if (heroUrl?.trim()) {
    return gallery.map((item) => ({
      ...item,
      is_featured: item.url === heroUrl || Boolean(item.is_featured),
    }));
  }
  return gallery.map((item, index) => ({
    ...item,
    display_order: item.display_order ?? index,
  }));
}

export function MediaTabPanel({
  heroUrl,
  onHeroUrl,
  media,
  onMedia,
  readOnly,
  mayUpload,
  onUpload,
  onInsertIntoArticle,
  onInsertAllIntoArticle,
  uploadBusy,
  uploadError,
  publisherName,
}: {
  heroUrl: string;
  onHeroUrl: (url: string) => void;
  media: NonNullable<ArticleCmsExtras["media"]>;
  onMedia: (media: NonNullable<ArticleCmsExtras["media"]>) => void;
  readOnly?: boolean;
  mayUpload?: boolean;
  onUpload?: (file: File) => Promise<string>;
  onInsertIntoArticle?: (item: { url: string; alt: string; caption: string }) => void;
  onInsertAllIntoArticle?: (items: Array<{ url: string; alt: string; caption: string }>) => void;
  uploadBusy?: boolean;
  uploadError?: string | null;
  publisherName?: string;
}) {
  const gallery = ensureGallery(media, heroUrl);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CmsPanel
        title="Article Media Gallery"
        description="Upload unlimited images, reorder, caption, and insert inline anywhere in the article"
      >
        <div className="space-y-4 p-4">
          {publisherName ? (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Publishing as <span className="font-semibold text-ink">{publisherName}</span>
            </p>
          ) : null}
          <ArticleMediaGallery
            heroUrl={heroUrl}
            onHeroUrl={onHeroUrl}
            gallery={gallery}
            onGalleryChange={(next) => onMedia({ ...media, gallery: next })}
            featuredAlt={media.alt_text ?? ""}
            featuredCaption={media.caption ?? ""}
            featuredCredit={media.credit ?? ""}
            onFeaturedMeta={(meta) => onMedia({ ...media, ...meta })}
            readOnly={readOnly}
            mayUpload={mayUpload}
            onUpload={onUpload}
            onInsertIntoArticle={onInsertIntoArticle}
            onInsertAllIntoArticle={onInsertAllIntoArticle}
            uploadBusy={uploadBusy}
            uploadError={uploadError}
          />
          <MediaOptimizationScore media={{ ...media, gallery }} heroUrl={heroUrl} />
        </div>
      </CmsPanel>

      <CmsPanel title="Additional media" description="Video and infographics">
        <div className="space-y-4 p-4">
          <Field label="Video URL">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={media.video_url ?? ""}
              onChange={(e) => onMedia({ ...media, video_url: e.target.value })}
            />
          </Field>
          <Field label="Infographic URL">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={media.infographic_url ?? ""}
              onChange={(e) => onMedia({ ...media, infographic_url: e.target.value })}
            />
          </Field>
        </div>
      </CmsPanel>
    </div>
  );
}

function MediaOptimizationScore({
  media,
  heroUrl,
}: {
  media: NonNullable<ArticleCmsExtras["media"]>;
  heroUrl: string;
}) {
  const gallery = media.gallery ?? [];
  let score = 0;
  if (heroUrl) score += 30;
  if (media.alt_text?.trim()) score += 20;
  if (media.caption?.trim()) score += 10;
  if (media.credit?.trim()) score += 10;
  if (gallery.length > 0) score += 15;
  if (gallery.every((g) => g.alt?.trim()) && gallery.length) score += 10;
  if (media.video_url) score += 5;
  return (
    <div className="rounded-xl bg-muted/30 px-4 py-3 text-sm">
      <span className="font-semibold">Media optimization score: </span>
      <span className={score >= 70 ? "text-emerald-600" : "text-amber-600"}>{score}/100</span>
    </div>
  );
}

export function CategoriesTabPanel({
  sectionId,
  onSectionId,
  sections,
  tagNames,
  tagDraft,
  onTagDraft,
  onAddTag,
  onRemoveTag,
  allTags,
  featured,
  onFeatured,
  onSelectExistingTag,
  readOnly,
  storyId,
  onStoryId,
  stories,
  topicIds,
  onTopicIds,
  topics,
}: {
  sectionId: string;
  onSectionId: (id: string) => void;
  sections: Array<{ id: string; name: string }>;
  tagNames: string[];
  tagDraft: string;
  onTagDraft: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (name: string) => void;
  allTags: Array<{ id: string; name: string }>;
  featured: boolean;
  onFeatured: (v: boolean) => void;
  onSelectExistingTag?: (name: string) => void;
  readOnly?: boolean;
  storyId?: string;
  onStoryId?: (id: string) => void;
  stories?: Array<{ id: string; title: string }>;
  topicIds?: string[];
  onTopicIds?: (ids: string[]) => void;
  topics?: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel title="Categories" description="Assign the primary desk category">
        <div className="space-y-4 p-4">
          <Field label="Primary category">
            <select
              disabled={readOnly}
              className={fieldClass}
              value={sectionId}
              onChange={(e) => onSectionId(e.target.value)}
            >
              <option value="">Select category…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={featured}
              onChange={(e) => onFeatured(e.target.checked)}
            />
            Featured category placement
          </label>
        </div>
      </CmsPanel>

      {onStoryId || onTopicIds ? (
        <CmsPanel
          title="Story & Topics"
          description="Link this article to a continuing narrative (Story) and broader subjects (Topics). Content is referenced, not duplicated."
        >
          <div className="space-y-4 p-4">
            {onStoryId ? (
              <Field label="Story">
                <select
                  disabled={readOnly}
                  className={fieldClass}
                  value={storyId ?? ""}
                  onChange={(e) => onStoryId(e.target.value)}
                >
                  <option value="">None</option>
                  {(stories ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {onTopicIds ? (
              <Field label="Topics" hint="Select one or more ongoing subjects">
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 p-2">
                  {(topics ?? []).length ? (
                    (topics ?? []).map((t) => {
                      const checked = (topicIds ?? []).includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={readOnly}
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? (topicIds ?? []).filter((id) => id !== t.id)
                                : [...(topicIds ?? []), t.id];
                              onTopicIds(next);
                            }}
                          />
                          {t.name}
                        </label>
                      );
                    })
                  ) : (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      No topics yet. Create topics under Stories & Topics.
                    </p>
                  )}
                </div>
              </Field>
            ) : null}
          </div>
        </CmsPanel>
      ) : null}

      <CmsPanel title="Tags" description="Multi-select or create new tags">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {tagNames.map((name) => (
              <button
                key={name}
                type="button"
                disabled={readOnly}
                onClick={() => onRemoveTag(name)}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                {name} ×
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={tagDraft}
              onChange={(e) => onTagDraft(e.target.value)}
              placeholder="Add tag…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddTag();
                }
              }}
            />
            <button
              type="button"
              className={cmsSecondaryButton}
              disabled={readOnly}
              onClick={onAddTag}
            >
              Add
            </button>
          </div>
          {allTags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {allTags.slice(0, 24).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  disabled={readOnly || tagNames.includes(tag.name)}
                  className="rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40"
                  onClick={() => onSelectExistingTag?.(tag.name)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </CmsPanel>
    </div>
  );
}

const BADGE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "none", label: "None" },
  { id: "breaking", label: "Breaking" },
  { id: "live", label: "Live" },
  { id: "exclusive", label: "Exclusive" },
  { id: "opinion", label: "Opinion" },
  { id: "premium", label: "Premium" },
  { id: "alert", label: "Alert" },
];

export function PublishingTabPanel({
  status,
  scheduledAt,
  expiryAt,
  region,
  visibility,
  articleType,
  badge,
  onStatus,
  onScheduledAt,
  onExpiryAt,
  onRegion,
  onVisibility,
  onArticleType,
  onBadge,
  readOnly,
  canPublish,
  publisherName,
}: {
  status: ArticleStatus;
  scheduledAt: string;
  expiryAt: string;
  region: string;
  visibility: string;
  articleType: string;
  badge?: string;
  onStatus: (s: ArticleStatus) => void;
  onScheduledAt: (v: string) => void;
  onExpiryAt: (v: string) => void;
  onRegion: (v: string) => void;
  onVisibility: (v: "public" | "premium" | "members") => void;
  onArticleType: (v: string) => void;
  onBadge?: (v: string) => void;
  readOnly?: boolean;
  canPublish?: boolean;
  publisherName?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel title="Publishing controls" description="Workflow, schedule, and visibility">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Publisher
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              By {publisherName?.trim() || "Admin"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Stored from your authenticated account when you save or publish.
            </p>
          </div>
          <Field label="Status">
            <select
              disabled={readOnly || (!canPublish && !["draft", "review"].includes(status))}
              className={fieldClass}
              value={status}
              onChange={(e) => onStatus(e.target.value as ArticleStatus)}
            >
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Article type">
            <select
              disabled={readOnly}
              className={fieldClass}
              value={articleType}
              onChange={(e) => onArticleType(e.target.value)}
            >
              {ARTICLE_TYPE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          {onBadge ? (
            <Field label="Editorial badge">
              <select
                disabled={readOnly}
                className={fieldClass}
                value={badge ?? "none"}
                onChange={(e) => onBadge(e.target.value)}
              >
                {BADGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Schedule date">
            <input
              type="datetime-local"
              disabled={readOnly}
              className={fieldClass}
              value={scheduledAt}
              onChange={(e) => onScheduledAt(e.target.value)}
            />
          </Field>
          <Field label="Expiry date">
            <input
              type="datetime-local"
              disabled={readOnly}
              className={fieldClass}
              value={expiryAt}
              onChange={(e) => onExpiryAt(e.target.value)}
            />
          </Field>
          <Field label="Region / desk">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={region}
              onChange={(e) => onRegion(e.target.value)}
              placeholder="e.g. Middle East, Europe"
            />
          </Field>
          <Field label="Visibility">
            <select
              disabled={readOnly}
              className={fieldClass}
              value={visibility}
              onChange={(e) => onVisibility(e.target.value as "public" | "premium" | "members")}
            >
              <option value="public">Public</option>
              <option value="premium">Premium</option>
              <option value="members">Members only</option>
            </select>
          </Field>
        </div>
      </CmsPanel>
    </div>
  );
}

export function SeoTabPanel({
  seo,
  onSeo,
  secondaryKeywords,
  onSecondaryKeywords,
  readOnly,
  seoScore,
  slug,
  titleFallback,
  deckFallback,
  heroImageUrl,
  hreflangRows,
  onHreflangChange,
}: {
  seo: ArticleSeoInput;
  onSeo: (patch: Partial<ArticleSeoInput>) => void;
  secondaryKeywords: string;
  onSecondaryKeywords: (v: string) => void;
  readOnly?: boolean;
  seoScore: number;
  slug: string;
  titleFallback: string;
  deckFallback: string;
  heroImageUrl?: string;
  hreflangRows: Array<{ locale: string; url: string }>;
  onHreflangChange: (rows: Array<{ locale: string; url: string }>) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel title="SEO center" description={`Live SEO score: ${seoScore}/100`}>
        <div className="space-y-4 p-4">
          <SEOForm
            value={seo}
            onChange={onSeo}
            slug={slug}
            titleFallback={titleFallback}
            deckFallback={deckFallback}
            heroImageUrl={heroImageUrl}
            hreflangRows={hreflangRows}
            onHreflangChange={onHreflangChange}
            readOnly={readOnly}
            showSocial={false}
          />
          <Field label="Secondary keywords">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={secondaryKeywords}
              onChange={(e) => onSecondaryKeywords(e.target.value)}
              placeholder="Comma-separated keywords"
            />
          </Field>
        </div>
      </CmsPanel>
    </div>
  );
}

export function LocalSeoTabPanel({
  local,
  onLocal,
  readOnly,
}: {
  local: NonNullable<ArticleCmsExtras["local_seo"]>;
  onLocal: (v: NonNullable<ArticleCmsExtras["local_seo"]>) => void;
  readOnly?: boolean;
}) {
  let score = 0;
  if (local.country) score += 25;
  if (local.region) score += 20;
  if (local.city) score += 25;
  if (local.local_keywords) score += 20;
  if (local.business_relevance) score += 10;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel title="Local SEO" description={`Local search score: ${score}/100`}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Country">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={local.country ?? ""}
              onChange={(e) => onLocal({ ...local, country: e.target.value })}
            />
          </Field>
          <Field label="Region">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={local.region ?? ""}
              onChange={(e) => onLocal({ ...local, region: e.target.value })}
            />
          </Field>
          <Field label="City">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={local.city ?? ""}
              onChange={(e) => onLocal({ ...local, city: e.target.value })}
            />
          </Field>
          <Field label="Local keywords">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={local.local_keywords ?? ""}
              onChange={(e) => onLocal({ ...local, local_keywords: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Business relevance">
              <textarea
                disabled={readOnly}
                className={cn(fieldClass, "min-h-[80px] py-2.5")}
                value={local.business_relevance ?? ""}
                onChange={(e) => onLocal({ ...local, business_relevance: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </CmsPanel>
    </div>
  );
}

export function GoogleNewsTabPanel({
  gnews,
  onGnews,
  googleNewsFlag,
  onGoogleNewsFlag,
  readOnly,
}: {
  gnews: NonNullable<ArticleCmsExtras["google_news"]>;
  onGnews: (v: NonNullable<ArticleCmsExtras["google_news"]>) => void;
  googleNewsFlag: boolean;
  onGoogleNewsFlag: (v: boolean) => void;
  readOnly?: boolean;
}) {
  const checks = [
    { label: "Google News eligible", ok: googleNewsFlag || Boolean(gnews.eligible) },
    { label: "News category set", ok: Boolean(gnews.news_category?.trim()) },
    { label: "News keywords", ok: Boolean(gnews.news_keywords?.trim()) },
    { label: "Sitemap inclusion", ok: gnews.include_sitemap !== false },
  ];
  const pass = checks.filter((c) => c.ok).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel title="Google News" description="Eligibility and news sitemap settings">
        <div className="space-y-4 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={googleNewsFlag}
              onChange={(e) => {
                onGoogleNewsFlag(e.target.checked);
                onGnews({ ...gnews, eligible: e.target.checked });
              }}
            />
            Google News eligible
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={gnews.include_sitemap !== false}
              onChange={(e) => onGnews({ ...gnews, include_sitemap: e.target.checked })}
            />
            Include in news sitemap
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(gnews.breaking)}
              onChange={(e) => onGnews({ ...gnews, breaking: e.target.checked })}
            />
            Breaking news flag
          </label>
          <Field label="News category">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={gnews.news_category ?? ""}
              onChange={(e) => onGnews({ ...gnews, news_category: e.target.value })}
              placeholder="World, Business, Technology…"
            />
          </Field>
          <Field label="News keywords">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={gnews.news_keywords ?? ""}
              onChange={(e) => onGnews({ ...gnews, news_keywords: e.target.value })}
            />
          </Field>
        </div>
      </CmsPanel>
      <CmsPanel title="Compliance check" description={`${pass}/${checks.length} checks passed`}>
        <ul className="space-y-2 p-4">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              <CheckCircle2
                className={cn("h-4 w-4", c.ok ? "text-emerald-500" : "text-muted-foreground/40")}
              />
              {c.label}
            </li>
          ))}
        </ul>
      </CmsPanel>
    </div>
  );
}

export function EeatTabPanel({
  eeat,
  onEeat,
  eeatScore,
  readOnly,
}: {
  eeat: NonNullable<ArticleCmsExtras["eeat"]>;
  onEeat: (v: NonNullable<ArticleCmsExtras["eeat"]>) => void;
  eeatScore: number;
  readOnly?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel
        title="EEAT"
        description={`Experience · Expertise · Authoritativeness · Trust — score ${eeatScore}/100`}
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Expert reviewer">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={eeat.expert_reviewer ?? ""}
              onChange={(e) => onEeat({ ...eeat, expert_reviewer: e.target.value })}
            />
          </Field>
          <Field label="Fact checker">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={eeat.fact_checker ?? ""}
              onChange={(e) => onEeat({ ...eeat, fact_checker: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Source verification">
              <textarea
                disabled={readOnly}
                className={cn(fieldClass, "min-h-[72px] py-2.5")}
                value={eeat.source_verification ?? ""}
                onChange={(e) => onEeat({ ...eeat, source_verification: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Author credentials">
              <textarea
                disabled={readOnly}
                className={cn(fieldClass, "min-h-[72px] py-2.5")}
                value={eeat.author_credentials ?? ""}
                onChange={(e) => onEeat({ ...eeat, author_credentials: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(eeat.original_reporting)}
              onChange={(e) => onEeat({ ...eeat, original_reporting: e.target.checked })}
            />
            Original reporting
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(eeat.sources_noted)}
              onChange={(e) => onEeat({ ...eeat, sources_noted: e.target.checked })}
            />
            Sources noted in article
          </label>
        </div>
      </CmsPanel>
    </div>
  );
}

export function SchemaTabPanel({
  schemaType,
  onSchemaType,
  title,
  slug,
  metaDescription,
  faqEnabled,
  faqItems,
  readOnly,
}: {
  schemaType: string;
  onSchemaType: (v: ArticleSeoInput["schema_type"]) => void;
  title: string;
  slug: string;
  metaDescription: string;
  faqEnabled?: boolean;
  faqItems?: Array<{ question: string; answer: string }>;
  readOnly?: boolean;
}) {
  const jsonLd = buildJsonLd({
    schemaType,
    title,
    slug,
    metaDescription,
    faqEnabled,
    faqItems,
  });
  let score = 40;
  if (title.trim()) score += 20;
  if (metaDescription.trim().length >= 50) score += 20;
  if (schemaType) score += 10;
  if (faqEnabled && (faqItems?.length ?? 0) > 0) score += 10;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CmsPanel title="Schema markup" description={`Validation score: ${score}/100`}>
        <div className="space-y-4 p-4">
          <Field label="Schema type">
            <select
              disabled={readOnly}
              className={fieldClass}
              value={schemaType}
              onChange={(e) => onSchemaType(e.target.value as ArticleSeoInput["schema_type"])}
            >
              <option value="NewsArticle">NewsArticle</option>
              <option value="Article">Article / BlogPosting</option>
              <option value="Report">Report</option>
              <option value="Review">Review / FAQPage companion</option>
            </select>
          </Field>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live JSON-LD preview
            </div>
            <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-300">
              {JSON.stringify(jsonLd, null, 2)}
            </pre>
          </div>
        </div>
      </CmsPanel>
    </div>
  );
}

function buildJsonLd({
  schemaType,
  title,
  slug,
  metaDescription,
  faqEnabled,
  faqItems,
}: {
  schemaType: string;
  title: string;
  slug: string;
  metaDescription: string;
  faqEnabled?: boolean;
  faqItems?: Array<{ question: string; answer: string }>;
}) {
  const url = `${siteUrl()}/article/${slug || "slug"}`;
  const base = {
    "@context": "https://schema.org",
    "@type": schemaType || "NewsArticle",
    headline: title || "Untitled",
    description: metaDescription || undefined,
    mainEntityOfPage: url,
    url,
  };
  if (faqEnabled && faqItems?.some((f) => f.question.trim())) {
    return [
      base,
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems
          .filter((f) => f.question.trim())
          .map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer || "" },
          })),
      },
    ];
  }
  return base;
}

export function SocialTabPanel({
  seo,
  onSeo,
  title,
  readOnly,
  articleId,
  articleSlug,
  deck,
}: {
  seo: ArticleSeoInput;
  onSeo: (patch: Partial<ArticleSeoInput>) => void;
  title: string;
  readOnly?: boolean;
  articleId?: string;
  articleSlug?: string;
  deck?: string;
}) {
  const ogTitle = seo.og_title || title;
  const ogDesc = seo.og_description || seo.meta_description || "";
  const ogImage = seo.og_image_url || "";
  const socialHref =
    articleId && articleId !== "new"
      ? `/admin/social/create?sourceType=article&sourceId=${encodeURIComponent(articleId)}&title=${encodeURIComponent(title)}&deck=${encodeURIComponent(deck || "")}&slug=${encodeURIComponent(articleSlug || "")}`
      : "/admin/social/create";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CmsPanel
        title="Omnichannel posts"
        description="Repurpose this article into platform-specific drafts"
      >
        <div className="flex flex-wrap items-center gap-3 p-4">
          <a href={socialHref} className={cmsSecondaryButton}>
            Create Social Posts
          </a>
          <p className="text-xs text-muted-foreground">
            Opens Social composer with this article as the source. Live publish requires connected
            channels.
          </p>
        </div>
      </CmsPanel>
      <CmsPanel title="Open Graph & social" description="Titles, descriptions, and share image">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Social title">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={seo.og_title ?? ""}
              onChange={(e) => onSeo({ og_title: e.target.value })}
            />
          </Field>
          <Field label="Twitter title">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={seo.twitter_title ?? ""}
              onChange={(e) => onSeo({ twitter_title: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Social description">
              <textarea
                disabled={readOnly}
                className={cn(fieldClass, "min-h-[72px] py-2.5")}
                value={seo.og_description ?? ""}
                onChange={(e) => onSeo({ og_description: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="OG image URL">
              <input
                disabled={readOnly}
                className={fieldClass}
                value={seo.og_image_url ?? ""}
                onChange={(e) => onSeo({ og_image_url: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Twitter card">
            <select
              disabled={readOnly}
              className={fieldClass}
              value={seo.twitter_card ?? "summary_large_image"}
              onChange={(e) =>
                onSeo({
                  twitter_card: e.target.value === "summary" ? "summary" : "summary_large_image",
                })
              }
            >
              <option value="summary_large_image">Summary large image</option>
              <option value="summary">Summary</option>
            </select>
          </Field>
          <Field label="Twitter image URL">
            <input
              disabled={readOnly}
              className={fieldClass}
              value={seo.twitter_image_url ?? ""}
              onChange={(e) => onSeo({ twitter_image_url: e.target.value })}
              placeholder="Defaults to OG image"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Twitter description">
              <textarea
                disabled={readOnly}
                className={cn(fieldClass, "min-h-[72px] py-2.5")}
                value={seo.twitter_description ?? ""}
                onChange={(e) => onSeo({ twitter_description: e.target.value })}
                placeholder="Defaults to social description"
              />
            </Field>
          </div>
        </div>
      </CmsPanel>
      <div className="grid gap-4 md:grid-cols-3">
        <SocialPreview platform="Facebook" title={ogTitle} description={ogDesc} image={ogImage} />
        <SocialPreview platform="LinkedIn" title={ogTitle} description={ogDesc} image={ogImage} />
        <SocialPreview
          platform="X / Twitter"
          title={seo.twitter_title || ogTitle}
          description={seo.twitter_description || ogDesc}
          image={seo.twitter_image_url || ogImage}
        />
      </div>
    </div>
  );
}

function SocialPreview({
  platform,
  title,
  description,
  image,
}: {
  platform: string;
  title: string;
  description: string;
  image: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {platform} preview
      </div>
      {image ? (
        <img src={image} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center bg-muted/40 text-xs text-muted-foreground">
          No image
        </div>
      )}
      <div className="space-y-1 p-3">
        <div className="line-clamp-2 text-sm font-semibold">{title || "Untitled"}</div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {description || "Add a social description"}
        </p>
      </div>
    </div>
  );
}

export function AiTabPanel({
  title,
  deck,
  blocks,
  readOnly,
  onApplyTitle,
  onApplyDeck,
  onApplyMeta,
  onInsertSummaryBlock,
}: {
  title: string;
  deck: string;
  blocks: Block[];
  readOnly?: boolean;
  onApplyTitle: (t: string) => void;
  onApplyDeck: (d: string) => void;
  onApplyMeta: (meta: {
    seo_title?: string;
    meta_description?: string;
    focus_keyword?: string;
    og_description?: string;
  }) => void;
  onInsertSummaryBlock: (blocks: Block[]) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <CmsPanel
        title="AI Assistant"
        description="Local desk helpers — generate headlines, meta, FAQs, and social captions"
      >
        <div className="p-2">
          <ArticleAiAssistantPanel
            title={title}
            deck={deck}
            blocks={blocks}
            readOnly={readOnly}
            onApplyTitle={onApplyTitle}
            onApplyDeck={onApplyDeck}
            onApplyMeta={onApplyMeta}
            onInsertSummaryBlock={onInsertSummaryBlock}
          />
        </div>
      </CmsPanel>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
        <p className="text-sm text-muted-foreground">
          Suggestions stay on-device for now. Remote LLM writing ships in a later phase — autosave
          still never publishes.
        </p>
      </div>
    </div>
  );
}

export function RelatedArticlesPanel({
  articles,
  selectedIds,
  onToggle,
  notes,
  onNotes,
  readOnly,
}: {
  articles: Array<{ id: string; title: string; slug: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <p className="pl-9 text-xs text-muted-foreground">
          Select related stories for internal linking
        </p>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
        {articles.slice(0, 40).map((a) => (
          <li key={a.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={selectedIds.includes(a.id)}
                onChange={() => onToggle(a.id)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="line-clamp-1 font-medium">{a.title}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  /article/{a.slug}
                </span>
              </span>
            </label>
          </li>
        ))}
        {!articles.length ? (
          <li className="px-2 py-3 text-xs text-muted-foreground">No articles to suggest yet.</li>
        ) : null}
      </ul>
      <textarea
        disabled={readOnly}
        className={cn(fieldClass, "min-h-[72px] py-2.5")}
        placeholder="Anchor text / linking notes for editors…"
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
      />
    </div>
  );
}

export function ReferencesEditor({
  references,
  onChange,
  readOnly,
}: {
  references: Array<{ name: string; url: string; citation_type: string }>;
  onChange: (refs: Array<{ name: string; url: string; citation_type: string }>) => void;
  readOnly?: boolean;
}) {
  const rows = references.length ? references : [{ name: "", url: "", citation_type: "web" }];
  return (
    <div className="space-y-3">
      {rows.map((ref, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-border/50 p-3 sm:grid-cols-3">
          <input
            disabled={readOnly}
            className={fieldClass}
            placeholder="Source name"
            value={ref.name}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...ref, name: e.target.value };
              onChange(next);
            }}
          />
          <input
            disabled={readOnly}
            className={fieldClass}
            placeholder="URL"
            value={ref.url}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...ref, url: e.target.value };
              onChange(next);
            }}
          />
          <select
            disabled={readOnly}
            className={fieldClass}
            value={ref.citation_type}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...ref, citation_type: e.target.value };
              onChange(next);
            }}
          >
            <option value="web">Web</option>
            <option value="wire">Wire</option>
            <option value="document">Document</option>
            <option value="interview">Interview</option>
            <option value="other">Other</option>
          </select>
        </div>
      ))}
      <button
        type="button"
        disabled={readOnly}
        className="text-xs font-semibold text-primary"
        onClick={() => onChange([...rows, { name: "", url: "", citation_type: "web" }])}
      >
        <Plus className="mr-1 inline h-3.5 w-3.5" /> Add source
      </button>
    </div>
  );
}
