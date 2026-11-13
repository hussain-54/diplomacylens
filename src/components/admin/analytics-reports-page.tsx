import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Eye, FileText } from "lucide-react";
import { CmsPageHeader, CmsPanel, CmsStat, cmsSecondaryButton } from "@/components/cms-ui";
import { getAnalyticsOverview } from "@/lib/admin.functions";

export type AnalyticsFocus =
  | "overview"
  | "audience"
  | "content"
  | "sections"
  | "comments"
  | "traffic"
  | "articles"
  | "video"
  | "podcast"
  | "seo"
  | "revenue"
  | "custom"
  | "export";

const TITLES: Record<AnalyticsFocus, { title: string; description: string }> = {
  overview: {
    title: "Analytics Dashboard",
    description: "A rolling 30-day view of audience activity and newsroom output.",
  },
  audience: {
    title: "Audience Analytics",
    description: "Article view trends from article_daily_metrics — no invented traffic.",
  },
  content: {
    title: "Content Analytics",
    description: "Articles created in the last 30 days by workflow status.",
  },
  sections: {
    title: "By Category",
    description: "Output volume by category/section for the rolling period.",
  },
  comments: {
    title: "Comment Reports",
    description: "Comment activity counts from live moderation data.",
  },
  traffic: {
    title: "Traffic Analytics",
    description:
      "Article view traffic from article_daily_metrics. GA4 session data is not connected.",
  },
  articles: {
    title: "Article Performance",
    description: "Top articles ranked by recorded views.",
  },
  video: {
    title: "Video Performance",
    description: "Connect video event aggregation for watch metrics. No invented play counts.",
  },
  podcast: {
    title: "Podcast Performance",
    description:
      "Connect podcast event aggregation for listen metrics. No invented download counts.",
  },
  seo: {
    title: "SEO Performance",
    description: "Search Console is not connected. No invented ranking or click data.",
  },
  revenue: {
    title: "Revenue Reports",
    description: "Ad revenue providers are not connected. No fabricated revenue figures.",
  },
  custom: {
    title: "Custom Reports",
    description: "Build reports from existing analytics modules. External BI is not wired.",
  },
  export: {
    title: "Export Reports",
    description:
      "Export live overview metrics. Provider CSV exports require connected analytics APIs.",
  },
};

function HonestEmpty({ detail }: { detail: string }) {
  return (
    <CmsPanel title="Status">
      <p className="p-5 text-sm text-muted-foreground">{detail}</p>
    </CmsPanel>
  );
}

export function AnalyticsReportsPage({ focus = "overview" }: { focus?: AnalyticsFocus }) {
  const analytics = useQuery({ queryKey: ["cms-analytics"], queryFn: getAnalyticsOverview });
  const data = analytics.data;
  const totalViews = (data?.metrics ?? []).reduce((sum, item) => sum + item.views, 0);
  const published = (data?.articles ?? []).filter(
    (article) => article.status === "published",
  ).length;
  const drafts = (data?.articles ?? []).filter((article) => article.status === "draft").length;
  const review = (data?.articles ?? []).filter((article) => article.status === "review").length;
  const scheduled = (data?.articles ?? []).filter(
    (article) => article.status === "scheduled",
  ).length;
  const pendingComments = (data?.comments ?? []).filter(
    (comment) => comment.status === "pending",
  ).length;
  const approvedComments = (data?.comments ?? []).filter(
    (comment) => comment.status === "approved",
  ).length;
  const spamComments = (data?.comments ?? []).filter((comment) => comment.status === "spam").length;

  const daily = new Map<string, number>();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    daily.set(date.toISOString().slice(0, 10), 0);
  }
  for (const metric of data?.metrics ?? []) {
    daily.set(metric.metric_date, (daily.get(metric.metric_date) ?? 0) + metric.views);
  }
  const dailyRows = [...daily.entries()];
  const maxDaily = Math.max(...dailyRows.map(([, views]) => views), 1);

  const storyTotals = new Map<string, { title: string; views: number }>();
  for (const metric of data?.metrics ?? []) {
    const article = Array.isArray(metric.articles) ? metric.articles[0] : metric.articles;
    const current = storyTotals.get(metric.article_id) ?? {
      title: article?.title ?? "Unknown article",
      views: 0,
    };
    current.views += metric.views;
    storyTotals.set(metric.article_id, current);
  }
  const topStories = [...storyTotals.values()].sort((a, b) => b.views - a.views).slice(0, 8);

  const sectionCounts = new Map<string, number>();
  for (const article of data?.articles ?? []) {
    const section = Array.isArray(article.sections) ? article.sections[0] : article.sections;
    const name = section?.name ?? "Unassigned";
    sectionCounts.set(name, (sectionCounts.get(name) ?? 0) + 1);
  }
  const maxSection = Math.max(...sectionCounts.values(), 1);

  const meta = TITLES[focus];
  const showAudience = focus === "overview" || focus === "audience" || focus === "traffic";
  const showContent = focus === "overview" || focus === "content";
  const showSections = focus === "overview" || focus === "sections";
  const showTop =
    focus === "overview" || focus === "audience" || focus === "articles" || focus === "traffic";
  const showComments = focus === "overview" || focus === "comments";
  const isProviderDesk =
    focus === "video" ||
    focus === "podcast" ||
    focus === "seo" ||
    focus === "revenue" ||
    focus === "custom" ||
    focus === "export";

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow="Performance intelligence"
        title={meta.title}
        description={meta.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/authors/analytics" className={cmsSecondaryButton}>
              Author reports
            </Link>
            <Link to="/admin/social/analytics" className={cmsSecondaryButton}>
              Social reports
            </Link>
            <Link to="/admin/videos/analytics" className={cmsSecondaryButton}>
              Video desk
            </Link>
            <Link to="/admin/podcasts/analytics" className={cmsSecondaryButton}>
              Podcast desk
            </Link>
          </div>
        }
      />

      {analytics.error && (
        <div className="border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson">
          {analytics.error.message}
        </div>
      )}

      {focus === "video" ? (
        <HonestEmpty detail="Use Video → Analytics for module events when available. External platform engagement APIs are not connected." />
      ) : null}
      {focus === "podcast" ? (
        <HonestEmpty detail="Use Podcast → Analytics for module events when available. External download providers are not connected." />
      ) : null}
      {focus === "seo" ? (
        <HonestEmpty detail="Wire Google Search Console credentials before expecting query/click charts. SEO defaults live under Settings → SEO." />
      ) : null}
      {focus === "revenue" ? (
        <HonestEmpty detail="Ad Manager network code can be stored under Settings → Advertising. Live revenue requires a connected billing provider." />
      ) : null}
      {focus === "custom" ? (
        <HonestEmpty detail="Combine Content, Audience, and Social reports. A custom report builder is not connected to an external BI tool." />
      ) : null}
      {focus === "export" ? (
        <CmsPanel title="Export">
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">
              Download a JSON snapshot of the live overview (article counts + view totals). Not a
              fabricated spreadsheet.
            </p>
            <button
              type="button"
              className={cmsSecondaryButton}
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      {
                        exported_at: new Date().toISOString(),
                        total_views: totalViews,
                        published,
                        drafts,
                        review,
                        scheduled,
                        comments: data?.comments.length ?? 0,
                        top_stories: topStories,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `diplomacy-lens-analytics-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download JSON snapshot
            </button>
          </div>
        </CmsPanel>
      ) : null}

      {!isProviderDesk ? (
        <>
          {focus === "overview" ||
          focus === "content" ||
          focus === "articles" ||
          focus === "traffic" ||
          focus === "audience" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CmsStat
                label="Article views"
                value={totalViews.toLocaleString()}
                detail="Rolling 30 days"
                trend="neutral"
              />
              <CmsStat label="Published" value={published} detail="Stories released" trend="up" />
              {focus === "content" ? (
                <>
                  <CmsStat label="Drafts" value={drafts} detail="Created in period" />
                  <CmsStat label="In review" value={review} detail="Awaiting editors" />
                  <CmsStat label="Scheduled" value={scheduled} detail="Queued to publish" />
                </>
              ) : (
                <>
                  <CmsStat
                    label="Comments"
                    value={data?.comments.length ?? 0}
                    detail={`${pendingComments} awaiting review`}
                  />
                  <CmsStat
                    label="Avg. views / story"
                    value={published ? Math.round(totalViews / published).toLocaleString() : "0"}
                    detail="Published this period"
                  />
                </>
              )}
            </div>
          ) : null}

          {showComments && focus === "comments" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CmsStat
                label="Total comments"
                value={data?.comments.length ?? 0}
                detail="Last 30 days"
              />
              <CmsStat label="Pending" value={pendingComments} detail="Awaiting moderation" />
              <CmsStat label="Approved" value={approvedComments} detail="Published thread" />
              <CmsStat label="Spam" value={spamComments} detail="Marked spam" />
            </div>
          ) : null}

          {showAudience || showSections ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
              {showAudience ? (
                <CmsPanel title="Audience trend" description="Daily article views · last 30 days">
                  <div className="p-5">
                    <div className="flex h-64 items-end gap-1 border-b border-l border-border px-2 pt-4">
                      {dailyRows.map(([date, views], index) => (
                        <div
                          key={date}
                          className="group relative flex h-full min-w-0 flex-1 items-end"
                        >
                          <div
                            className="w-full bg-foreground/80 transition-colors group-hover:bg-cat-blue"
                            style={{
                              height: `${Math.max((views / maxDaily) * 100, views ? 3 : 0)}%`,
                            }}
                          />
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap border border-border bg-popover px-2 py-1 text-[10px] text-popover-foreground group-hover:block">
                            {new Date(`${date}T00:00:00Z`).toLocaleDateString()} ·{" "}
                            {views.toLocaleString()} views
                          </div>
                          {index % 7 === 0 && (
                            <span className="absolute top-full mt-2 text-[9px] text-muted-foreground">
                              {new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CmsPanel>
              ) : (
                <div />
              )}

              {showSections ? (
                <CmsPanel title="Output by category" description="Stories created in this period">
                  <div className="space-y-4 p-5">
                    {![...sectionCounts.entries()].length ? (
                      <p className="text-sm text-muted-foreground">
                        No articles in this period yet.
                      </p>
                    ) : null}
                    {[...sectionCounts.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <div key={name}>
                          <div className="mb-1.5 flex justify-between text-xs">
                            <span className="font-medium text-foreground">{name}</span>
                            <span className="tabular-nums text-muted-foreground">{count}</span>
                          </div>
                          <div className="h-1.5 bg-muted">
                            <div
                              className="h-full bg-cat-blue"
                              style={{ width: `${(count / maxSection) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </CmsPanel>
              ) : null}
            </div>
          ) : null}

          {showTop ? (
            <CmsPanel
              title="Top stories"
              description="Ranked by article views in the selected period"
            >
              {!topStories.length ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Analytics will populate as readers open published articles.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {topStories.map((story, index) => (
                    <div
                      key={`${story.title}-${index}`}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <span className="w-7 text-right font-mono text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {story.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" /> {story.views.toLocaleString()}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CmsPanel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
