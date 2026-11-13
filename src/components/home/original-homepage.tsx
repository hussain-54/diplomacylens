import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArticleCard, BadgePill } from "@/components/article-card";
import {
  HomeSection,
  HomeEmptyState,
  HomeScrollRail,
  HomeRailItem,
} from "@/components/home/section";
import {
  EpaperCard,
  VideoCard,
  PodcastCard,
  InfographicCard,
  type EpaperEdition,
  type PodcastEpisode,
  type InfographicItem,
  type HomeVideo,
} from "@/components/home/media-cards";
import { HomeNewsletterCta } from "@/components/home/newsletter-cta";
import { getHomeData } from "@/lib/content.functions";
import { articleExcerpt } from "@/lib/article-excerpt";
import { articleReadingMinutes, articleWordCount } from "@/lib/article-scores";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SmartWidgetSlot } from "@/components/smart-widgets/public-renderer";

function warBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-crimson text-crimson-foreground",
    ceasefire: "bg-cat-green text-white",
    tension: "bg-cat-amber text-white",
  };
  return map[status] ?? "bg-muted";
}

function embassyBadge(status: string) {
  const map: Record<string, string> = {
    open: "bg-cat-green text-white",
    limited: "bg-cat-amber text-white",
    closed: "bg-muted text-foreground",
    alert: "bg-crimson text-crimson-foreground",
  };
  return map[status] ?? "bg-muted";
}

function sectionSlug(
  article: {
    section_id?: string | null;
    sections?: { slug?: string | null } | { slug?: string | null }[] | null;
  },
  sections: Array<{ id: string; slug: string }>,
) {
  const joined = Array.isArray(article.sections) ? article.sections[0] : article.sections;
  if (joined?.slug) return joined.slug;
  return sections.find((s) => s.id === article.section_id)?.slug ?? null;
}

/**
 * Original Diplomacy Lens homepage composition (pre–Homepage Builder).
 * Used when the builder has no live version, or as an explicit fallback.
 */
export function OriginalHomepage({ className }: { className?: string }) {
  const q = useQuery({
    queryKey: ["home-original"],
    queryFn: () => getHomeData(),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className={cn(className)}>
        <div className="mx-auto max-w-[1400px] px-4 py-16">
          <div className="h-40 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className={cn(className)}>
        <div className="mx-auto max-w-[1400px] px-4 py-16">
          <HomeEmptyState
            message={q.error instanceof Error ? q.error.message : "Failed to load homepage."}
          />
        </div>
      </div>
    );
  }

  const data = q.data;
  // Prefer image-backed stories for the magazine fold so photos always show.
  const withImages = data.articles.filter((a) => Boolean(a.hero_image_url));
  const pool = withImages.length >= 3 ? withImages : data.articles;
  const featuredIndex = pool.findIndex((a) => a.is_featured);
  const leadIndex = featuredIndex >= 0 ? featuredIndex : 0;
  const lead = pool[leadIndex];
  const rest = data.articles.filter((a) => a.id !== lead?.id);
  const secondaryStack = (withImages.length >= 3 ? withImages : rest)
    .filter((a) => a.id !== lead?.id)
    .slice(0, 2);
  const featuredStories = rest
    .filter((a) => !secondaryStack.some((s) => s.id === a.id))
    .slice(0, 5);
  const latest = rest
    .filter(
      (a) =>
        !secondaryStack.some((s) => s.id === a.id) && !featuredStories.some((s) => s.id === a.id),
    )
    .slice(0, 9);
  const politics = data.articles
    .filter((a) => sectionSlug(a, data.sections) === "politics")
    .slice(0, 5);
  const explore = rest.slice(0, 10);
  const epaper = (data.epaper ?? []) as unknown as EpaperEdition[];
  const podcasts = (data.podcasts ?? []) as unknown as PodcastEpisode[];
  const infographics = (data.infographics ?? []) as unknown as InfographicItem[];
  const videos = (data.videos ?? []) as unknown as HomeVideo[];

  return (
    <div className={cn(className)}>
      <div className="mx-auto max-w-[1400px] px-4 pt-4">
        <SmartWidgetSlot pageType="homepage" slotKey="sidebar" />
      </div>
      <section className="border-b border-border" aria-label="Top stories">
        <div className="mx-auto max-w-[1400px] px-3 py-5 md:px-4 md:py-8">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              {lead ? (
                <Link to="/article/$slug" params={{ slug: lead.slug }} className="group block">
                  {lead.hero_image_url ? (
                    <div className="-mx-3 mb-3 aspect-[16/10] overflow-hidden bg-muted sm:mx-0 sm:mb-4 sm:aspect-[16/9]">
                      <img
                        src={lead.hero_image_url}
                        alt=""
                        width={1600}
                        height={900}
                        fetchPriority="high"
                        decoding="async"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 58vw, 820px"
                        className="h-full w-full object-cover object-[center_20%] transition-transform duration-700 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 aspect-[16/9] bg-muted" aria-hidden />
                  )}
                  <div className="flex items-center gap-3">
                    <BadgePill type={lead.badge_type} />
                    {lead.region ? (
                      <span className="eyebrow text-muted-foreground">{lead.region}</span>
                    ) : null}
                  </div>
                  <h1 className="headline-serif mt-2 text-[1.65rem] leading-[1.15] tracking-tight transition-colors group-hover:text-crimson sm:mt-3 sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                    {lead.title}
                  </h1>
                  {(() => {
                    const leadSummary = articleExcerpt(lead);
                    return leadSummary ? (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground line-clamp-3 sm:mt-3 sm:text-base md:line-clamp-4">
                        {leadSummary}
                      </p>
                    ) : null;
                  })()}
                  <div className="mt-2 text-[11px] text-muted-foreground sm:mt-3 sm:text-xs">
                    {timeAgo(lead.published_at)}
                    {" · "}
                    {articleReadingMinutes(articleWordCount(lead.body, lead.deck))} min read
                  </div>
                </Link>
              ) : (
                <HomeEmptyState message="No featured stories published yet." />
              )}
            </div>
            <aside
              className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:gap-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"
              aria-label="Also making news"
            >
              {secondaryStack.length ? (
                secondaryStack.map((a, i) => {
                  const stackSummary = articleExcerpt(a, 140);
                  return (
                    <Link
                      key={a.id}
                      to="/article/$slug"
                      params={{ slug: a.slug }}
                      className="group grid gap-3 border-b border-border pb-5 last:border-0 last:pb-0 sm:border-0 sm:pb-0 lg:border-b lg:pb-5 lg:last:border-0 lg:last:pb-0"
                    >
                      {a.hero_image_url ? (
                        <div className="aspect-[16/10] overflow-hidden bg-muted">
                          <img
                            src={a.hero_image_url}
                            alt=""
                            width={800}
                            height={500}
                            loading={i === 0 ? "eager" : "lazy"}
                            decoding="async"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[16/10] bg-muted" aria-hidden />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <BadgePill type={a.badge_type} />
                          {a.region ? (
                            <span className="eyebrow text-muted-foreground">{a.region}</span>
                          ) : null}
                        </div>
                        <h2 className="headline-serif mt-1.5 text-xl leading-snug tracking-tight group-hover:text-crimson md:text-[1.35rem]">
                          {a.title}
                        </h2>
                        {stackSummary ? (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {stackSummary}
                          </p>
                        ) : null}
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          {timeAgo(a.published_at)}
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <HomeEmptyState message="More stories will appear here." />
              )}
            </aside>
          </div>
        </div>
      </section>

      <HomeSection id="featured" title="Featured Stories" href="/latest" hrefLabel="More stories →">
        {featuredStories.length ? (
          <>
            <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-5">
              {featuredStories.map((a) => (
                <ArticleCard key={a.id} article={a} size="sm" />
              ))}
            </div>
            <HomeScrollRail className="md:hidden">
              {featuredStories.map((a) => (
                <HomeRailItem key={a.id}>
                  <ArticleCard article={a} size="sm" />
                </HomeRailItem>
              ))}
            </HomeScrollRail>
          </>
        ) : (
          <HomeEmptyState message="No featured stories available." />
        )}
      </HomeSection>

      <HomeSection id="latest" title="Latest News" href="/latest" tone="muted">
        {latest.length ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <HomeEmptyState message="No recent stories yet." />
        )}
      </HomeSection>

      <HomeSection id="politics" eyebrow="Desk" title="Politics" href="/section/politics">
        {politics.length ? (
          <>
            <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-5">
              {politics.map((a) => (
                <ArticleCard key={a.id} article={a} size="sm" />
              ))}
            </div>
            <HomeScrollRail className="md:hidden">
              {politics.map((a) => (
                <HomeRailItem key={a.id}>
                  <ArticleCard article={a} size="sm" />
                </HomeRailItem>
              ))}
            </HomeScrollRail>
          </>
        ) : (
          <HomeEmptyState message="Politics coverage will appear here once published." />
        )}
      </HomeSection>

      <HomeSection id="epaper" eyebrow="Print desk" title="E-Paper" href="/epaper" tone="muted">
        {epaper.length ? (
          <>
            <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-4">
              {epaper.slice(0, 4).map((edition) => (
                <EpaperCard key={edition.id} edition={edition} />
              ))}
            </div>
            <HomeScrollRail className="md:hidden">
              {epaper.slice(0, 6).map((edition) => (
                <HomeRailItem key={edition.id} className="w-[70%] sm:w-[40%]">
                  <EpaperCard edition={edition} />
                </HomeRailItem>
              ))}
            </HomeScrollRail>
          </>
        ) : (
          <HomeEmptyState message="E-Paper editions will appear here after editors publish them in the CMS." />
        )}
      </HomeSection>

      <HomeSection id="videos" eyebrow="Watch" title="Videos" href="/video">
        {videos.length ? (
          <>
            <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-5">
              {videos.slice(0, 5).map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
            <HomeScrollRail className="md:hidden">
              {videos.slice(0, 8).map((video) => (
                <HomeRailItem key={video.id}>
                  <VideoCard video={video} />
                </HomeRailItem>
              ))}
            </HomeScrollRail>
          </>
        ) : (
          <HomeEmptyState message="No videos published yet." />
        )}
      </HomeSection>

      <HomeSection id="podcasts" eyebrow="Listen" title="Podcasts" href="/podcast" tone="muted">
        {podcasts.length ? (
          <>
            <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-4">
              {podcasts.slice(0, 4).map((episode) => (
                <PodcastCard key={episode.id} episode={episode} />
              ))}
            </div>
            <HomeScrollRail className="md:hidden">
              {podcasts.slice(0, 6).map((episode) => (
                <HomeRailItem key={episode.id}>
                  <PodcastCard episode={episode} />
                </HomeRailItem>
              ))}
            </HomeScrollRail>
          </>
        ) : (
          <HomeEmptyState message="Podcast episodes will appear here once published in the CMS." />
        )}
      </HomeSection>

      <HomeSection
        id="infographics"
        eyebrow="Visual briefings"
        title="Infographics"
        href="/infographics"
      >
        {infographics.length ? (
          <>
            <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-4">
              {infographics.slice(0, 4).map((item) => (
                <InfographicCard key={item.id} item={item} />
              ))}
            </div>
            <HomeScrollRail className="md:hidden">
              {infographics.slice(0, 6).map((item) => (
                <HomeRailItem key={item.id} className="w-[70%] sm:w-[40%]">
                  <InfographicCard item={item} />
                </HomeRailItem>
              ))}
            </HomeScrollRail>
          </>
        ) : (
          <HomeEmptyState message="Infographics will appear here once published in the CMS." />
        )}
      </HomeSection>

      <HomeSection id="explore" title="Explore" href="/latest" tone="muted">
        {explore.length ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">
            {explore.map((a) => (
              <ArticleCard key={a.id} article={a} size="sm" />
            ))}
          </div>
        ) : (
          <HomeEmptyState message="Nothing to explore yet." />
        )}
      </HomeSection>

      <section className="bg-navy text-navy-foreground" aria-labelledby="war-monitor-heading">
        <div className="mx-auto max-w-[1400px] px-4 py-10">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="eyebrow text-navy-foreground/60">Global Conflict Desk</div>
              <h2 id="war-monitor-heading" className="mt-1 font-serif text-3xl">
                War Monitor
              </h2>
            </div>
            <Link
              to="/section/$slug"
              params={{ slug: "war" }}
              className="text-xs font-semibold uppercase tracking-widest text-navy-foreground/70 hover:text-navy-foreground"
            >
              Full Coverage →
            </Link>
          </div>
          {data.war.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.war.map((w) => (
                <div
                  key={w.id}
                  className="border border-navy-foreground/15 bg-navy-foreground/[.03] p-5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${warBadge(w.status)}`}
                    >
                      {w.status === "active"
                        ? "Active"
                        : w.status === "ceasefire"
                          ? "Ceasefire"
                          : "Tension"}
                    </span>
                    <span className="text-[11px] text-navy-foreground/50">
                      {timeAgo(w.updated_at)}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-xl">{w.conflict_name}</h3>
                  <div className="mt-1 text-xs text-navy-foreground/60">
                    {(w.countries ?? []).join(" · ")}
                  </div>
                  <p className="mt-3 text-sm text-navy-foreground/80">{w.headline}</p>
                </div>
              ))}
            </div>
          ) : (
            <HomeEmptyState message="No active conflict briefings." />
          )}
        </div>
      </section>

      <section className="bg-background" aria-label="Missions">
        <div className="mx-auto max-w-[1400px] px-4 py-12">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="eyebrow text-muted-foreground">Voices from the Missions</div>
                  <h2 className="mt-1 font-serif text-3xl text-ink">Ambassadors</h2>
                </div>
                <Link
                  to="/section/$slug"
                  params={{ slug: "ambassadors" }}
                  className="text-xs font-semibold uppercase tracking-widest text-navy hover:text-crimson"
                >
                  All ambassadors →
                </Link>
              </div>
              <div className="space-y-6">
                {data.ambassadors
                  .filter((a) => a.featured)
                  .slice(0, 2)
                  .map((a) => (
                    <Link
                      to="/ambassador/$id"
                      params={{ id: a.id }}
                      key={a.id}
                      className="group flex gap-4 border-b border-border pb-6 last:border-0"
                    >
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-sm bg-muted">
                        {a.avatar_url ? (
                          <img
                            src={a.avatar_url}
                            alt={a.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-3xl">
                            {a.flag_emoji ?? "🌐"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="eyebrow text-muted-foreground">
                          {a.flag_emoji} {a.country}
                        </div>
                        <h3 className="mt-1 font-serif text-lg text-ink group-hover:text-crimson">
                          {a.name}
                        </h3>
                        <div className="text-xs text-muted-foreground">{a.position}</div>
                        {a.quote ? (
                          <blockquote className="mt-2 border-l-2 border-gold pl-3 font-serif text-sm italic text-ink/80">
                            &ldquo;{a.quote}&rdquo;
                          </blockquote>
                        ) : null}
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
            <div>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="eyebrow text-muted-foreground">Missions & Consulates</div>
                  <h2 className="mt-1 font-serif text-3xl text-ink">Embassy Watch</h2>
                </div>
                <Link
                  to="/section/$slug"
                  params={{ slug: "embassy-watch" }}
                  className="text-xs font-semibold uppercase tracking-widest text-navy hover:text-crimson"
                >
                  All missions →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.embassies.map((e) => (
                  <Link
                    to="/embassy/$id"
                    params={{ id: e.id }}
                    key={e.id}
                    className="group block border border-border p-4 transition-colors hover:border-navy"
                  >
                    <div className="flex items-center justify-between">
                      <span className="eyebrow text-muted-foreground">{e.country}</span>
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${embassyBadge(e.status)}`}
                      >
                        {e.status}
                      </span>
                    </div>
                    <p className="mt-2 font-serif text-sm text-ink group-hover:text-crimson">
                      {e.headline}
                    </p>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Updated {timeAgo(e.updated_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeNewsletterCta />
    </div>
  );
}
