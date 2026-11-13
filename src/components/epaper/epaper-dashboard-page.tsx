import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  BookOpen,
  Copy,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsPageHeader,
  CmsPageSkeleton,
  CmsPanel,
  MetricCard,
  StatusBadge,
  cmsButton,
  cmsSecondaryButton,
} from "@/components/cms";
import {
  DataTable,
  DataTableCell,
  DataTableEmpty,
  DataTableRow,
} from "@/components/cms/data-table";
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
  getEpaperDashboard,
  type EpaperEditionRow,
} from "@/lib/epaper.functions";

export function EpaperDashboardPage() {
  const qc = useQueryClient();
  const snapshot = useQuery({
    queryKey: ["epaper-dashboard"],
    queryFn: getEpaperDashboard,
    staleTime: 20_000,
  });
  const [pendingDelete, setPendingDelete] = useState<EpaperEditionRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["epaper-dashboard"] });

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

  if (snapshot.isLoading) return <CmsPageSkeleton metrics={8} panels={2} />;

  const kpis = snapshot.data?.kpis;
  const recent = snapshot.data?.recent ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow="Content · ePaper"
        title="ePaper dashboard"
        description="Live edition counts, engagement, and recent publishing activity."
      />

      {snapshot.error ? <CmsAlert>{snapshot.error.message}</CmsAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Editions" value={kpis?.total ?? 0} icon={Newspaper} />
        <MetricCard label="Published" value={kpis?.published ?? 0} icon={BookOpen} />
        <MetricCard label="Draft" value={kpis?.draft ?? 0} icon={FileText} />
        <MetricCard label="Scheduled" value={kpis?.scheduled ?? 0} icon={BarChart3} />
        <MetricCard label="Archived" value={kpis?.archived ?? 0} icon={Archive} />
        <MetricCard label="Total Views" value={kpis?.totalViews ?? 0} icon={Eye} />
        <MetricCard label="Total Downloads" value={kpis?.totalDownloads ?? 0} icon={Download} />
        <MetricCard label="Unique Readers" value={kpis?.totalReaders ?? 0} icon={Users} />
      </div>

      <CmsPanel title="Quick actions">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/admin/epaper/upload" className={cmsSecondaryButton}>
            <Upload className="h-4 w-4" /> Upload edition
          </Link>
          <Link to="/admin/epaper/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create edition
          </Link>
          <Link to="/admin/epaper/archive" className={cmsSecondaryButton}>
            <Archive className="h-4 w-4" /> View archive
          </Link>
          <Link to="/admin/epaper/analytics" className={cmsSecondaryButton}>
            <BarChart3 className="h-4 w-4" /> View analytics
          </Link>
        </div>
      </CmsPanel>

      <CmsPanel
        title="Recent editions"
        action={
          <Link
            to="/admin/epaper/editions"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </Link>
        }
      >
        <DataTable
          columns={[
            { key: "edition", header: "Edition" },
            { key: "status", header: "Status" },
            { key: "type", header: "Type" },
            { key: "published", header: "Published" },
            { key: "views", header: "Views", align: "right" },
            { key: "actions", header: "", align: "right" },
          ]}
        >
          {recent.length === 0 ? (
            <DataTableEmpty
              colSpan={6}
              title="No editions yet"
              description="Upload a PDF or create an edition to get started."
              action={
                <Link to="/admin/epaper/upload" className={cmsButton}>
                  <Upload className="h-4 w-4" /> Upload edition
                </Link>
              }
            />
          ) : null}
          {recent.map((edition) => (
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
                      {edition.issue_number
                        ? `Issue ${edition.issue_number}`
                        : edition.edition_type}
                    </div>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={edition.archived_at ? "archived" : edition.status} />
              </DataTableCell>
              <DataTableCell className="text-xs capitalize text-muted-foreground">
                {edition.edition_type ?? "—"}
              </DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {edition.published_at ? new Date(edition.published_at).toLocaleDateString() : "—"}
              </DataTableCell>
              <DataTableCell align="right" mono>
                {edition.view_count ?? 0}
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
