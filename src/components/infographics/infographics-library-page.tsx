import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Copy,
  Download,
  Eye,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CmsPageHeader,
  CmsPanel,
  StatusBadge,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { CmsPagination } from "@/components/cms/pagination";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
import { FilterBar, FilterField } from "@/components/cms/filter-bar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  archiveInfographic,
  deleteInfographicFull,
  duplicateInfographic,
  listInfographicsAdmin,
  type Infographic,
  type InfographicStatus,
} from "@/lib/infographics.functions";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const STATUS_OPTIONS: Array<{ value: InfographicStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const GRAPHIC_TYPES = [
  "static",
  "chart",
  "map",
  "timeline",
  "comparison",
  "data-viz",
  "interactive",
];

export function InfographicsLibraryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState<InfographicStatus | "all">("all");
  const [category, setCategory] = useState("");
  const [graphicType, setGraphicType] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pendingDelete, setPendingDelete] = useState<Infographic | null>(null);

  useEffect(() => setPage(1), [debouncedSearch, status, category, graphicType, year]);

  const filters = {
    search: debouncedSearch || undefined,
    status,
    category: category || null,
    graphic_type: graphicType || null,
    year: year ? Number(year) : null,
    archived: "exclude" as const,
    page,
    pageSize,
  };

  const libraryQ = useQuery({
    queryKey: ["infographics-library-admin", filters],
    queryFn: () => listInfographicsAdmin(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["infographics-library-admin"] });

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateInfographic({ data: { id } }),
    onSuccess: () => {
      toast.success("Infographic duplicated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveInfographic({ data: { id } }),
    onSuccess: () => {
      toast.success("Infographic archived");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteInfographicFull({ data: { id } }),
    onSuccess: () => {
      toast.success("Infographic deleted");
      setPendingDelete(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = libraryQ.data?.rows ?? [];
  const total = libraryQ.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Library"
        description="Every infographic, filterable by status, category, type, and year."
        actions={
          <Link to="/admin/infographics/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create infographic
          </Link>
        }
      />

      <CmsPanel>
        <FilterBar
          onClear={() => {
            setSearch("");
            setStatus("all");
            setCategory("");
            setGraphicType("");
            setYear("");
          }}
        >
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${cmsInput} pl-9`}
                placeholder="Title, author, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status">
            <select
              className={cmsInput}
              value={status}
              onChange={(e) => setStatus(e.target.value as InfographicStatus | "all")}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Category">
            <input
              className={cmsInput}
              placeholder="e.g. Sanctions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </FilterField>
          <FilterField label="Graphic type">
            <select
              className={cmsInput}
              value={graphicType}
              onChange={(e) => setGraphicType(e.target.value)}
            >
              <option value="">All types</option>
              {GRAPHIC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Year">
            <input
              type="number"
              className={cmsInput}
              placeholder="e.g. 2026"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={[
            { key: "infographic", header: "Infographic" },
            { key: "status", header: "Status" },
            { key: "type", header: "Type" },
            { key: "published", header: "Published" },
            { key: "views", header: "Views", align: "right" },
            { key: "downloads", header: "Downloads", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
          footer={
            total > 0 ? (
              <CmsPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            ) : null
          }
        >
          {!libraryQ.isLoading && rows.length === 0 ? (
            <DataTableEmpty
              colSpan={7}
              title="No infographics match these filters"
              description="Try clearing filters or create a new infographic."
            />
          ) : null}
          {rows.map((item) => (
            <DataTableRow key={item.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {item.cover_image_url ? (
                      <img
                        src={item.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to="/admin/infographics/$id"
                      params={{ id: item.id }}
                      className="truncate font-medium hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {item.category ?? "Uncategorized"}
                    </div>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={item.archived_at ? "archived" : item.status} />
              </DataTableCell>
              <DataTableCell className="text-xs capitalize text-muted-foreground">
                {item.graphic_type ?? "static"}
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {item.published_at ? new Date(item.published_at).toLocaleDateString() : "—"}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {item.view_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {item.download_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      aria-label="Infographic actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.slug ? (
                      <DropdownMenuItem asChild>
                        <a href={`/infographics/${item.slug}`} target="_blank" rel="noreferrer">
                          <Eye className="mr-2 h-3.5 w-3.5" /> View
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link to="/admin/infographics/$id" params={{ id: item.id }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    {item.asset_url && item.allow_download ? (
                      <DropdownMenuItem asChild>
                        <a href={item.asset_url} download target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-3.5 w-3.5" /> Download
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => duplicate.mutate(item.id)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!item.archived_at ? (
                      <DropdownMenuItem onClick={() => archive.mutate(item.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-cat-rose"
                      onClick={() => setPendingDelete(item)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      </CmsPanel>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the infographic, its asset, and analytics. This cannot be
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
              {remove.isPending ? "Deleting…" : "Delete infographic"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
