import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, Headphones, Share2 } from "lucide-react";
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
import { formatDuration, getPodcastAnalyticsOverview } from "@/lib/podcast.functions";

const DAY_OPTIONS = [7, 30, 90];

export function PodcastsAnalyticsPage() {
  const [days, setDays] = useState(30);
  const overviewQ = useQuery({
    queryKey: ["podcasts-analytics-overview", days],
    queryFn: () => getPodcastAnalyticsOverview(days),
  });

  if (overviewQ.isLoading) return <CmsPageSkeleton metrics={5} panels={4} />;

  const data = overviewQ.data;
  const deviceData = Object.entries(data?.deviceBreakdown ?? {}).map(([label, value]) => ({
    label,
    value,
  }));
  const listenHours = Math.round((data?.totals.listenSeconds ?? 0) / 3600);

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Podcast analytics"
        description="Listener engagement across shows, episodes, and devices."
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
        <MetricCard label="Plays" value={data?.totals.plays ?? 0} icon={Headphones} />
        <MetricCard label="Downloads" value={data?.totals.downloads ?? 0} icon={Download} />
        <MetricCard label="Shares" value={data?.totals.shares ?? 0} icon={Share2} />
        <MetricCard label="Completions" value={data?.totals.completions ?? 0} icon={CheckCircle2} />
        <MetricCard label="Listen hours" value={listenHours} icon={Clock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Plays over time"
          empty={(data?.series.length ?? 0) === 0}
          emptyTitle="No plays yet"
          emptyDescription="Listener events will populate this chart."
        >
          <LineTrendChart data={data?.series ?? []} dataKey="plays" xKey="date" />
        </ChartCard>
        <ChartCard
          title="Device breakdown"
          empty={deviceData.length === 0}
          emptyTitle="No device data"
          emptyDescription="Device information appears once listeners open episodes."
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
          title="Top episodes by plays"
          empty={(data?.topEpisodes.length ?? 0) === 0}
          emptyTitle="No plays yet"
          emptyDescription="Top episodes appear once listeners engage."
        >
          <BarMetricChart
            data={(data?.topEpisodes ?? []).map((e) => ({
              label: e.title,
              value: e.play_count ?? 0,
            }))}
            layout="vertical"
          />
        </ChartCard>
      </div>

      <DataTable
        columns={[
          { key: "episode", header: "Episode" },
          { key: "avg", header: "Avg. listen time" },
          { key: "plays", header: "Plays", align: "right" },
          { key: "downloads", header: "Downloads", align: "right" },
          { key: "listeners", header: "Listeners", align: "right" },
        ]}
      >
        {(data?.topEpisodes.length ?? 0) === 0 ? (
          <DataTableEmpty
            colSpan={5}
            title="No episodes with activity"
            description="Top episodes appear once listeners engage."
          />
        ) : null}
        {(data?.topEpisodes ?? []).map((episode) => {
          const avgSeconds = episode.listener_count
            ? Math.round((episode.listen_seconds_total ?? 0) / episode.listener_count)
            : null;
          return (
            <DataTableRow key={episode.id}>
              <DataTableCell className="font-medium">{episode.title}</DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {avgSeconds ? formatDuration(avgSeconds) : "—"}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {episode.play_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {episode.download_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {episode.listener_count ?? 0}
              </DataTableCell>
            </DataTableRow>
          );
        })}
      </DataTable>

      {!overviewQ.isLoading && (data?.topEpisodes.length ?? 0) === 0 ? (
        <CmsEmptyState
          title="No analytics yet"
          description="Publish episodes and share them with listeners to see engagement."
        />
      ) : null}
    </div>
  );
}
