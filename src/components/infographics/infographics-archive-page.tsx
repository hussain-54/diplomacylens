import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LayoutGrid, List, RotateCcw, Trash2 } from "lucide-react";
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
  deleteInfographicFull,
  listInfographicsAdmin,
  restoreInfographic,
  type Infographic,
} from "@/lib/infographics.functions";
import { cn } from "@/lib/utils";

export function InfographicsArchivePage() {
  const qc = useQueryClient();
  const [year, setYear] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Infographic | null>(null);
  const pageSize = 24;

  useEffect(() => setPage(1), [year]);

  const filters = {
    archived: "only" as const,
    year: year ? Number(year) : null,
    page,
    pageSize,
  };

  const archiveQ = useQuery({
    queryKey: ["infographics-archive", filters],
    queryFn: () => listInfographicsAdmin(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["infographics-archive"] });

  const restore = useMutation({
    mutationFn: (id: string) => restoreInfographic({ data: { id } }),
    onSuccess: () => {
      toast.success("Infographic restored to draft");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteInfographicFull({ data: { id } }),
    onSuccess: () => {
      toast.success("Infographic permanently deleted");
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
        description="Archived infographics are hidden from readers but kept for records."
      />

      <CmsPanel>
        <FilterBar
          onClear={() => setYear("")}
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
        </FilterBar>

        {!archiveQ.isLoading && rows.length === 0 ? (
          <CmsEmptyState
            title="No archived infographics"
            description="Infographics you archive will appear here."
          />
        ) : view === "grid" ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {rows.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-lg border border-border/70 bg-card"
              >
                <div className="aspect-square bg-muted">
                  {item.cover_image_url ? (
                    <img src={item.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.published_at ? new Date(item.published_at).toLocaleDateString() : "—"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(cmsSecondaryButton, "h-8 flex-1 px-2 text-[11px]")}
                      onClick={() => restore.mutate(item.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-cat-rose hover:bg-cat-rose/10"
                      aria-label="Delete permanently"
                      onClick={() => setPendingDelete(item)}
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
              { key: "infographic", header: "Infographic" },
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
            {rows.map((item) => (
              <DataTableRow key={item.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/admin/infographics/$id"
                      params={{ id: item.id }}
                      className="font-medium hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    <StatusBadge status="archived" />
                  </div>
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">
                  {item.archived_at ? new Date(item.archived_at).toLocaleDateString() : "—"}
                </DataTableCell>
                <DataTableCell align="right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      onClick={() => restore.mutate(item.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold text-cat-rose hover:bg-cat-rose/10"
                      onClick={() => setPendingDelete(item)}
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
              This removes the infographic, its asset, and analytics for good. This cannot be
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
