import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Share2 } from "lucide-react";
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
  BarMetricChart,
  ChartCard,
  DonutChart,
  LineTrendChart,
} from "@/components/dashboard/chart-card";
import { getInfographicAnalyticsOverview } from "@/lib/infographics.functions";

const DAY_OPTIONS = [7, 30, 90];

export function InfographicsAnalyticsPage() {
  const [days, setDays] = useState(30);
  const overviewQ = useQuery({
    queryKey: ["infographics-analytics-overview", days],
    queryFn: () => getInfographicAnalyticsOverview(days),
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
        title="Infographics analytics"
        description="Reader engagement across infographics and devices."
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

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Views" value={data?.totals.views ?? 0} icon={Eye} />
        <MetricCard label="Downloads" value={data?.totals.downloads ?? 0} icon={Download} />
        <MetricCard label="Shares" value={data?.totals.shares ?? 0} icon={Share2} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Views over time"
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
          emptyDescription="Device information appears once readers open infographics."
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
          title="Shares over time"
          empty={(data?.series.length ?? 0) === 0}
          emptyTitle="No shares yet"
          emptyDescription="Share activity will appear here."
        >
          <BarMetricChart
            data={(data?.series ?? []).map((s) => ({ label: s.date, value: s.shares }))}
          />
        </ChartCard>
      </div>

      <DataTable
        columns={[
          { key: "infographic", header: "Infographic" },
          { key: "category", header: "Category" },
          { key: "views", header: "Views", align: "right" },
          { key: "downloads", header: "Downloads", align: "right" },
          { key: "shares", header: "Shares", align: "right" },
        ]}
      >
        {(data?.topInfographics.length ?? 0) === 0 ? (
          <DataTableEmpty
            colSpan={5}
            title="No infographics with activity"
            description="Top infographics appear once readers engage."
          />
        ) : null}
        {(data?.topInfographics ?? []).map((item) => (
          <DataTableRow key={item.id}>
            <DataTableCell>
              {item.slug ? (
                <Link
                  to="/admin/infographics/$id"
                  params={{ id: item.id }}
                  className="font-medium hover:text-primary"
                >
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </DataTableCell>
            <DataTableCell className="text-xs text-muted-foreground">
              {item.category ?? "—"}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {item.view_count ?? 0}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {item.download_count ?? 0}
            </DataTableCell>
            <DataTableCell align="right" mono>
              {item.share_count ?? 0}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {!overviewQ.isLoading && (data?.topInfographics.length ?? 0) === 0 ? (
        <CmsEmptyState
          title="No analytics yet"
          description="Publish infographics and share them with readers to see engagement."
        />
      ) : null}
    </div>
  );
}
