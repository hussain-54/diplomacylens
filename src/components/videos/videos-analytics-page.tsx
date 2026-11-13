import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, Eye, Share2 } from "lucide-react";
import { useState } from "react";
import {
  CmsAlert,
  CmsEmptyState,
  CmsPageHeader,
  CmsPageSkeleton,
  MetricCard,
  cmsInput,
} from "@/components/cms";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
import {
  ChartCard,
  BarMetricChart,
  DonutChart,
  LineTrendChart,
} from "@/components/dashboard/chart-card";
import { getVideoAnalyticsOverview } from "@/lib/video.functions";

const DAY_OPTIONS = [7, 30, 90];

export function VideosAnalyticsPage() {
  const [days, setDays] = useState(30);
  const overviewQ = useQuery({
    queryKey: ["videos-analytics-overview", days],
    queryFn: () => getVideoAnalyticsOverview(days),
  });

  if (overviewQ.isLoading) return <CmsPageSkeleton metrics={5} panels={4} />;

  const data = overviewQ.data;
  const deviceData = Object.entries(data?.deviceBreakdown ?? {}).map(([label, value]) => ({
    label,
    value,
  }));
  const watchHours = Math.round((data?.totals.watchSeconds ?? 0) / 3600);

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Video analytics"
        description="Viewer engagement across videos, playlists, and devices."
        actions={
          <select
            className={cmsInput}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
        }
      />

      {overviewQ.error ? <CmsAlert>{overviewQ.error.message}</CmsAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Views" value={data?.totals.views ?? 0} icon={Eye} />
        <MetricCard label="Downloads" value={data?.totals.downloads ?? 0} icon={Download} />
        <MetricCard label="Shares" value={data?.totals.shares ?? 0} icon={Share2} />
        <MetricCard label="Completions" value={data?.totals.completions ?? 0} icon={CheckCircle2} />
        <MetricCard label="Watch hours" value={watchHours} icon={Clock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Views over time"
          empty={(data?.series.length ?? 0) === 0}
          emptyTitle="No views yet"
          emptyDescription="Viewer events will populate this chart."
        >
          <LineTrendChart data={data?.series ?? []} dataKey="plays" xKey="date" />
        </ChartCard>
        <ChartCard
          title="Device breakdown"
          empty={deviceData.length === 0}
          emptyTitle="No device data"
          emptyDescription="Device information appears once viewers open videos."
        >
          <DonutChart data={deviceData} />
        </ChartCard>
        <ChartCard
          title="Downloads over time"
          empty={(data?.series.length ?? 0) === 0}
          emptyTitle="No downloads yet"
          emptyDescription="Download activity will appear here."
        >
          <LineTrendChart data={data?.series ?? []} dataKey="downloads" xKey="date" />
        </ChartCard>
        <ChartCard
          title="Top videos by views"
          empty={(data?.topVideos.length ?? 0) === 0}
          emptyTitle="No views yet"
          emptyDescription="Top videos appear once viewers engage."
        >
          <BarMetricChart
            data={(data?.topVideos ?? []).map((v) => ({
              label: v.title,
              value: v.view_count ?? 0,
            }))}
            layout="vertical"
          />
        </ChartCard>
      </div>

      <DataTable
        columns={[
          { key: "video", header: "Video" },
          { key: "views", header: "Views", align: "right" },
          { key: "completions", header: "Completions", align: "right" },
          { key: "watch", header: "Watch time", align: "right" },
        ]}
      >
        {(data?.topVideos.length ?? 0) === 0 ? (
          <DataTableEmpty
            colSpan={4}
            title="No videos with activity"
            description="Top videos appear once viewers engage."
          />
        ) : null}
        {(data?.topVideos ?? []).map((video) => (
          <DataTableRow key={video.id}>
            <DataTableCell className="font-medium">{video.title}</DataTableCell>
            <DataTableCell align="right" mono>
              {video.view_count ?? 0}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {video.completion_count ?? 0}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {Math.round(Number(video.watch_seconds_total ?? 0) / 60)}m
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {!overviewQ.isLoading && (data?.topVideos.length ?? 0) === 0 ? (
        <CmsEmptyState
          title="No analytics yet"
          description="Publish videos and share them with viewers to see engagement."
        />
      ) : null}
    </div>
  );
}
