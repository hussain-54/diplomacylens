import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  Copy,
  Download,
  Eye,
  FileText,
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
  archiveEpaperEdition,
  deleteEpaperEditionFull,
  duplicateEpaperEdition,
  listEpaperEditionsAdmin,
  type EpaperEditionRow,
  type EpaperStatus,
} from "@/lib/epaper.functions";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const STATUS_OPTIONS: Array<{ value: EpaperStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
  { value: "failed", label: "Failed" },
];

export function EpaperEditionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState<EpaperStatus | "all">("all");
  const [year, setYear] = useState("");
  const [language, setLanguage] = useState("");
  const [editionType, setEditionType] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pendingDelete, setPendingDelete] = useState<EpaperEditionRow | null>(null);

  useEffect(() => setPage(1), [debouncedSearch, status, year, language, editionType]);

  const filters = {
    search: debouncedSearch || undefined,
    status,
    year: year ? Number(year) : null,
    language: language || null,
    edition_type: editionType || null,
    archived: "exclude" as const,
    page,
    pageSize,
  };

  const editionsQ = useQuery({
    queryKey: ["epaper-editions-admin", filters],
    queryFn: () => listEpaperEditionsAdmin(filters),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["epaper-editions-admin"] });

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateEpaperEdition({ data: { id } }),
    onSuccess: () => {
      toast.success("Edition duplicated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveEpaperEdition({ data: { id } }),
    onSuccess: () => {
      toast.success("Edition archived");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEpaperEditionFull({ data: { id } }),
    onSuccess: () => {
      toast.success("Edition deleted");
      setPendingDelete(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = editionsQ.data?.rows ?? [];
  const total = editionsQ.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Editions"
        description="Every edition in the newsroom, filterable by status, year, language, and type."
        actions={
          <Link to="/admin/epaper/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create edition
          </Link>
        }
      />

      <CmsPanel>
        <FilterBar
          onClear={() => {
            setSearch("");
            setStatus("all");
            setYear("");
            setLanguage("");
            setEditionType("");
          }}
        >
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${cmsInput} pl-9`}
                placeholder="Title, issue, publisher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status">
            <select
              className={cmsInput}
              value={status}
              onChange={(e) => setStatus(e.target.value as EpaperStatus | "all")}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
          <FilterField label="Language">
            <input
              className={cmsInput}
              placeholder="en"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </FilterField>
          <FilterField label="Edition type">
            <select
              className={cmsInput}
              value={editionType}
              onChange={(e) => setEditionType(e.target.value)}
            >
              <option value="">All types</option>
              {["daily", "weekly", "special", "supplement"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        <DataTable
          columns={[
            { key: "edition", header: "Edition" },
            { key: "status", header: "Status" },
            { key: "language", header: "Language" },
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
          {!editionsQ.isLoading && rows.length === 0 ? (
            <DataTableEmpty
              colSpan={7}
              title="No editions match these filters"
              description="Try clearing filters or create a new edition."
            />
          ) : null}
          {rows.map((edition) => (
            <DataTableRow key={edition.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {edition.cover_image_url ? (
                      <img
                        src={edition.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to="/admin/epaper/$id"
                      params={{ id: edition.id }}
                      className="truncate font-medium hover:text-primary"
                    >
                      {edition.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {edition.issue_number ? `Issue ${edition.issue_number} · ` : ""}
                      {edition.edition_type ?? "daily"}
                    </div>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={edition.archived_at ? "archived" : edition.status} />
              </DataTableCell>
              <DataTableCell className="text-xs uppercase text-muted-foreground">
                {edition.language ?? "en"}
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {edition.published_at ? new Date(edition.published_at).toLocaleDateString() : "—"}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {edition.view_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {edition.download_count ?? 0}
              </DataTableCell>
              <DataTableCell align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      aria-label="Edition actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {edition.slug ? (
                      <DropdownMenuItem asChild>
                        <a href={`/epaper/${edition.slug}`} target="_blank" rel="noreferrer">
                          <Eye className="mr-2 h-3.5 w-3.5" /> View
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link to="/admin/epaper/$id" params={{ id: edition.id }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/epaper/flipbook" search={{ edition: edition.id }}>
                        <BookOpen className="mr-2 h-3.5 w-3.5" /> Flipbook
                      </Link>
                    </DropdownMenuItem>
                    {edition.pdf_url ? (
                      <DropdownMenuItem asChild>
                        <a href={edition.pdf_url} target="_blank" rel="noreferrer">
                          <FileText className="mr-2 h-3.5 w-3.5" /> Preview PDF
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    {edition.pdf_url && edition.allow_download ? (
                      <DropdownMenuItem asChild>
                        <a href={edition.pdf_url} download target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-3.5 w-3.5" /> Download
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => duplicate.mutate(edition.id)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!edition.archived_at ? (
                      <DropdownMenuItem onClick={() => archive.mutate(edition.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="text-cat-rose"
                      onClick={() => setPendingDelete(edition)}
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
              This permanently removes the edition, its PDF versions, and analytics. This cannot be
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
              {remove.isPending ? "Deleting…" : "Delete edition"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
