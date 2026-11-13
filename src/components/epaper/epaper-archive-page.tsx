import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LayoutGrid, List, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  StatusBadge,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { CmsPagination } from "@/components/cms/pagination";
import { DataTable, DataTableCell, DataTableRow } from "@/components/cms/data-table";
import {
  FilterBar,
  FilterField,
  SegmentedControl,
  SegmentedItem,
} from "@/components/cms/filter-bar";
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
  deleteEpaperEditionFull,
  listEpaperEditionsAdmin,
  restoreEpaperEdition,
  type EpaperEditionRow,
} from "@/lib/epaper.functions";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function EpaperArchivePage() {
  const qc = useQueryClient();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<EpaperEditionRow | null>(null);
  const pageSize = 24;

  useEffect(() => setPage(1), [year, month]);

  const filters = {
    archived: "only" as const,
    year: year ? Number(year) : null,
    month: month ? Number(month) : null,
    page,
    pageSize,
  };

  const archiveQ = useQuery({
    queryKey: ["epaper-archive", filters],
    queryFn: () => listEpaperEditionsAdmin(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["epaper-archive"] });

  const restore = useMutation({
    mutationFn: (id: string) => restoreEpaperEdition({ data: { id } }),
    onSuccess: () => {
      toast.success("Edition restored to draft");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEpaperEditionFull({ data: { id } }),
    onSuccess: () => {
      toast.success("Edition permanently deleted");
      setPendingDelete(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = archiveQ.data?.rows ?? [];
  const total = archiveQ.data?.total ?? 0;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Archive"
        description="Archived editions are hidden from readers but kept for records."
      />

      <CmsPanel>
        <FilterBar
          onClear={() => {
            setYear("");
            setMonth("");
          }}
          trailing={
            <SegmentedControl className="ml-auto">
              <SegmentedItem active={view === "grid"} onClick={() => setView("grid")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </SegmentedItem>
              <SegmentedItem active={view === "list"} onClick={() => setView("list")}>
                <List className="h-3.5 w-3.5" /> List
              </SegmentedItem>
            </SegmentedControl>
          }
        >
          <FilterField label="Year">
            <select className={cmsInput} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Month">
            <select
              className={cmsInput}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={!year}
            >
              <option value="">All months</option>
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        {!archiveQ.isLoading && rows.length === 0 ? (
          <CmsEmptyState
            title="No archived editions"
            description="Editions you archive will appear here."
          />
        ) : view === "grid" ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {rows.map((edition) => (
              <div
                key={edition.id}
                className="overflow-hidden rounded-lg border border-border/70 bg-card"
              >
                <div className="aspect-[3/4] bg-muted">
                  {edition.cover_image_url ? (
                    <img
                      src={edition.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="truncate text-sm font-medium">{edition.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {edition.published_at
                      ? new Date(edition.published_at).toLocaleDateString()
                      : "—"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(cmsSecondaryButton, "h-8 flex-1 px-2 text-[11px]")}
                      onClick={() => restore.mutate(edition.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-cat-rose hover:bg-cat-rose/10"
                      aria-label="Delete permanently"
                      onClick={() => setPendingDelete(edition)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "edition", header: "Edition" },
              { key: "archived", header: "Archived" },
              { key: "actions", header: "", align: "right" },
            ]}
            footer={
              total > 0 ? (
                <CmsPagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                />
              ) : null
            }
          >
            {rows.map((edition) => (
              <DataTableRow key={edition.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/admin/epaper/$id"
                      params={{ id: edition.id }}
                      className="font-medium hover:text-primary"
                    >
                      {edition.title}
                    </Link>
                    <StatusBadge status="archived" />
                  </div>
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">
                  {edition.archived_at ? new Date(edition.archived_at).toLocaleDateString() : "—"}
                </DataTableCell>
                <DataTableCell align="right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      onClick={() => restore.mutate(edition.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold text-cat-rose hover:bg-cat-rose/10"
                      onClick={() => setPendingDelete(edition)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        )}
        {view === "grid" && total > 0 ? (
          <CmsPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        ) : null}
      </CmsPanel>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the edition, its PDF versions, and analytics for good. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
