import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Printer, Share2, Users } from "lucide-react";
import { useState } from "react";
import {
  CmsAlert,
  CmsEmptyState,
  CmsPageHeader,
  CmsPageSkeleton,
  MetricCard,
  StatusBadge,
  cmsInput,
} from "@/components/cms";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
import {
  BarMetricChart,
  ChartCard,
  DonutChart,
  LineTrendChart,
} from "@/components/dashboard/chart-card";
import { getEditionAnalytics, getEpaperAnalyticsOverview } from "@/lib/epaper.functions";

const DAY_OPTIONS = [7, 30, 90];

export function EpaperAnalyticsPage({ editionId }: { editionId?: string } = {}) {
  const [days, setDays] = useState(30);
  const overviewQ = useQuery({
    queryKey: ["epaper-analytics-overview", days],
    queryFn: () => getEpaperAnalyticsOverview(days),
  });
  const detailQ = useQuery({
    queryKey: ["epaper-analytics-edition", editionId, days],
    queryFn: () => getEditionAnalytics(editionId!, days),
    enabled: !!editionId,
  });

  if (overviewQ.isLoading) return <CmsPageSkeleton metrics={5} panels={4} />;

  const data = overviewQ.data;
  const deviceData = Object.entries(data?.deviceBreakdown ?? {}).map(([label, value]) => ({
    label,
    value,
  }));

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="ePaper analytics"
        description="Reader engagement across editions, pages, and devices."
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
        <MetricCard label="Prints" value={data?.totals.prints ?? 0} icon={Printer} />
        <MetricCard label="Page views" value={data?.totals.pageViews ?? 0} icon={Users} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Views & downloads over time"
          empty={(data?.series.length ?? 0) === 0}
          emptyTitle="No activity yet"
          emptyDescription="Reader events will populate this chart."
        >
          <LineTrendChart data={data?.series ?? []} dataKey="views" xKey="date" />
        </ChartCard>
        <ChartCard
          title="Device breakdown"
          empty={deviceData.length === 0}
          emptyTitle="No device data"
          emptyDescription="Device information appears once readers open editions."
        >
          <DonutChart data={deviceData} />
        </ChartCard>
        <ChartCard
          title="Most viewed pages"
          empty={(data?.topPages.length ?? 0) === 0}
          emptyTitle="No page views yet"
          emptyDescription="Page-level engagement appears once readers browse editions."
        >
          <BarMetricChart
            data={(data?.topPages ?? []).map((p) => ({ label: `Page ${p.page}`, value: p.count }))}
            layout="vertical"
          />
        </ChartCard>
        <ChartCard
          title="Downloads over time"
          empty={(data?.series.length ?? 0) === 0}
          emptyTitle="No downloads yet"
          emptyDescription="Download activity will appear here."
        >
          <LineTrendChart data={data?.series ?? []} dataKey="downloads" xKey="date" />
        </ChartCard>
      </div>

      <DataTable
        columns={[
          { key: "edition", header: "Edition" },
          { key: "status", header: "Status" },
          { key: "views", header: "Views", align: "right" },
          { key: "downloads", header: "Downloads", align: "right" },
          { key: "readers", header: "Readers", align: "right" },
        ]}
      >
        {(data?.topEditions.length ?? 0) === 0 ? (
          <DataTableEmpty
            colSpan={5}
            title="No editions with activity"
            description="Top editions appear once readers engage."
          />
        ) : null}
        {(data?.topEditions ?? []).map((edition) => (
          <DataTableRow key={edition.id}>
            <DataTableCell>
              {edition.slug ? (
                <Link
                  to="/admin/epaper/analytics"
                  search={{ edition: edition.id }}
                  className="font-medium hover:text-primary"
                >
                  {edition.title}
                </Link>
              ) : (
                edition.title
              )}
            </DataTableCell>
            <DataTableCell>
              <StatusBadge status={edition.status} />
            </DataTableCell>
            <DataTableCell align="right" mono>
              {edition.view_count ?? 0}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {edition.download_count ?? 0}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {edition.reader_count ?? 0}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {editionId ? (
        <ChartCard
          title={detailQ.data ? `Edition detail — ${detailQ.data.edition.title}` : "Edition detail"}
          loading={detailQ.isLoading}
          empty={(detailQ.data?.series.length ?? 0) === 0}
          emptyTitle="No activity for this edition"
          emptyDescription="Reader events for this edition will appear here."
        >
          {detailQ.data ? (
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <MetricCard label="Views" value={detailQ.data.kpis.views} />
                <MetricCard label="Readers" value={detailQ.data.kpis.readers} />
                <MetricCard label="Downloads" value={detailQ.data.kpis.downloads} />
                <MetricCard label="Avg. pages viewed" value={detailQ.data.kpis.avgPagesViewed} />
              </div>
              <LineTrendChart data={detailQ.data.series} dataKey="views" xKey="date" />
            </div>
          ) : null}
        </ChartCard>
      ) : null}

      {!editionId && !overviewQ.isLoading && (data?.topEditions.length ?? 0) === 0 ? (
        <CmsEmptyState
          title="No analytics yet"
          description="Publish editions and share them with readers to see engagement."
        />
      ) : null}
    </div>
  );
}
