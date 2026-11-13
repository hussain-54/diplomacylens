import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPageSkeleton,
  CmsPanel,
  MetricCard,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
import {
  getTipsDashboard,
  listNewsTips,
  listTipSources,
  setTipStatus,
  upsertNewsTip,
  upsertTipSource,
  type TipStatus,
} from "@/lib/cms-site/tips";

export function TipsDashboardPage() {
  const q = useQuery({ queryKey: ["tips-dashboard"], queryFn: getTipsDashboard });
  if (q.isLoading) return <CmsPageSkeleton metrics={6} panels={1} />;
  const d = q.data;
  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="News Tips"
        description="Intake and triage tips from the public and sources."
        actions={
          <Link to="/admin/tips/new" className={cmsButton}>
            + New Tip
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={d?.total ?? 0} />
        <MetricCard label="Unreviewed" value={d?.unreviewed ?? 0} />
        <MetricCard label="Under investigation" value={d?.investigation ?? 0} />
        <MetricCard label="Verified" value={d?.verified ?? 0} />
        <MetricCard label="Rejected" value={d?.rejected ?? 0} />
        <MetricCard label="Anonymous" value={d?.anonymous ?? 0} />
      </div>
    </div>
  );
}

export function TipsListPage({ status }: { status?: TipStatus | TipStatus[] }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["news-tips", status],
    queryFn: () => listNewsTips(status ? { status } : undefined),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TipStatus }) => setTipStatus(id, next),
    onSuccess: () => {
      toast.success("Tip updated");
      void qc.invalidateQueries({ queryKey: ["news-tips"] });
      void qc.invalidateQueries({ queryKey: ["tips-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title={Array.isArray(status) ? "Tips" : status ? `${status} tips` : "All Tips"}
        description="Real tip records from the database. Empty until migration is applied and tips are submitted."
        actions={
          <Link to="/admin/tips/new" className={cmsButton}>
            + New Tip
          </Link>
        }
      />
      <DataTable
        columns={[
          { key: "title", header: "Tip" },
          { key: "status", header: "Status" },
          { key: "source", header: "Source" },
          { key: "actions", header: "" },
        ]}
      >
        {!(q.data ?? []).length ? (
          <DataTableEmpty
            colSpan={4}
            title="No tips yet"
            description="Create a tip or wait for submissions. No mock data is shown."
          />
        ) : null}
        {(q.data ?? []).map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell>
              <div className="font-medium">{row.title}</div>
              {row.body ? (
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.body}</div>
              ) : null}
              {row.location ? (
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {row.location}
                </div>
              ) : null}
            </DataTableCell>
            <DataTableCell className="capitalize">{row.status}</DataTableCell>
            <DataTableCell>{row.is_anonymous ? "Anonymous" : row.source_name || "—"}</DataTableCell>
            <DataTableCell>
              <div className="flex flex-wrap gap-1">
                {(["unreviewed", "investigation", "verified", "rejected"] as TipStatus[]).map(
                  (next) => (
                    <button
                      key={next}
                      type="button"
                      className={cmsSecondaryButton}
                      disabled={setStatus.isPending || row.status === next}
                      onClick={() => setStatus.mutate({ id: row.id, next })}
                    >
                      {next}
                    </button>
                  ),
                )}
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}

export function TipCreatePage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceContact, setSourceContact] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [location, setLocation] = useState("");

  const save = useMutation({
    mutationFn: () =>
      upsertNewsTip({
        title,
        body,
        source_name: anonymous ? null : sourceName,
        source_contact: anonymous ? null : sourceContact,
        is_anonymous: anonymous,
        status: anonymous ? "anonymous" : "new",
        location,
      }),
    onSuccess: () => {
      toast.success("Tip saved");
      void qc.invalidateQueries({ queryKey: ["news-tips"] });
      void qc.invalidateQueries({ queryKey: ["tips-dashboard"] });
      setTitle("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="New Tip"
        description="Create a tip for editorial review."
        actions={
          <button
            type="button"
            className={cmsButton}
            disabled={!title.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            Save tip
          </button>
        }
      />
      <CmsPanel title="Tip details">
        <div className="grid gap-3 p-1 sm:grid-cols-2">
          <Field label="Title">
            <input className={cmsInput} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Location">
            <input
              className={cmsInput}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Details">
              <textarea
                className={cmsInput}
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            Anonymous tip
          </label>
          {!anonymous ? (
            <>
              <Field label="Source name">
                <input
                  className={cmsInput}
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                />
              </Field>
              <Field label="Source contact">
                <input
                  className={cmsInput}
                  value={sourceContact}
                  onChange={(e) => setSourceContact(e.target.value)}
                />
              </Field>
            </>
          ) : null}
        </div>
      </CmsPanel>
    </div>
  );
}

export function TipSourcesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tip-sources"], queryFn: listTipSources });
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [contact, setContact] = useState("");
  const save = useMutation({
    mutationFn: () => upsertTipSource({ name, organization: org, contact }),
    onSuccess: () => {
      toast.success("Source saved");
      void qc.invalidateQueries({ queryKey: ["tip-sources"] });
      setName("");
      setOrg("");
      setContact("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <CmsPageHeader title="Tip Sources" description="Known sources used across tip intake." />
      <CmsPanel title="Add source">
        <div className="grid gap-3 p-1 sm:grid-cols-4">
          <Field label="Name">
            <input className={cmsInput} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Organization">
            <input className={cmsInput} value={org} onChange={(e) => setOrg(e.target.value)} />
          </Field>
          <Field label="Contact">
            <input
              className={cmsInput}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className={cmsButton}
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              Add
            </button>
          </div>
        </div>
      </CmsPanel>
      {!q.data?.length ? (
        <CmsEmptyState
          title="No sources"
          description="Add known tip sources. Requires news_tip_sources migration."
        />
      ) : null}
      <ul className="space-y-2">
        {(q.data ?? []).map(
          (s: {
            id: string;
            name: string;
            organization?: string | null;
            contact?: string | null;
          }) => (
            <li key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <span className="font-medium">{s.name}</span>
              {s.organization ? (
                <span className="text-muted-foreground"> · {s.organization}</span>
              ) : null}
              {s.contact ? <span className="text-muted-foreground"> · {s.contact}</span> : null}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
