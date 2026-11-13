import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  Copy,
  Download,
  Eye,
  FolderKanban,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
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
  archiveInfographic,
  deleteInfographicFull,
  duplicateInfographic,
  getInfographicsDashboard,
  type Infographic,
} from "@/lib/infographics.functions";

export function InfographicsDashboardPage() {
  const qc = useQueryClient();
  const snapshot = useQuery({
    queryKey: ["infographics-dashboard"],
    queryFn: getInfographicsDashboard,
    staleTime: 20_000,
  });
  const [pendingDelete, setPendingDelete] = useState<Infographic | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["infographics-dashboard"] });

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

  if (snapshot.isLoading) return <CmsPageSkeleton metrics={8} panels={2} />;

  const kpis = snapshot.data?.kpis;
  const recent = snapshot.data?.recent ?? [];

  return (
    <div className="space-y-6">
      <CmsPageHeader
        eyebrow="Content · Infographics"
        title="Infographics dashboard"
        description="Live counts, engagement, and recent publishing activity for visual briefings."
      />

      {snapshot.error ? <CmsAlert>{snapshot.error.message}</CmsAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Infographics" value={kpis?.total ?? 0} icon={ImagePlus} />
        <MetricCard label="Published" value={kpis?.published ?? 0} icon={Eye} />
        <MetricCard label="Draft" value={kpis?.draft ?? 0} icon={Pencil} />
        <MetricCard label="Scheduled" value={kpis?.scheduled ?? 0} icon={BarChart3} />
        <MetricCard label="Featured" value={kpis?.featured ?? 0} icon={Sparkles} />
        <MetricCard label="Total Views" value={kpis?.totalViews ?? 0} icon={Eye} />
        <MetricCard label="Total Downloads" value={kpis?.totalDownloads ?? 0} icon={Download} />
        <MetricCard label="Added This Month" value={kpis?.thisMonth ?? 0} icon={Plus} />
      </div>

      <CmsPanel title="Quick actions">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/admin/infographics/upload" className={cmsSecondaryButton}>
            <Upload className="h-4 w-4" /> Upload infographic
          </Link>
          <Link to="/admin/infographics/create" className={cmsButton}>
            <Plus className="h-4 w-4" /> Create infographic
          </Link>
          <Link to="/admin/infographics/collections" className={cmsSecondaryButton}>
            <FolderKanban className="h-4 w-4" /> Manage collections
          </Link>
          <Link to="/admin/infographics/analytics" className={cmsSecondaryButton}>
            <BarChart3 className="h-4 w-4" /> View analytics
          </Link>
        </div>
      </CmsPanel>

      <CmsPanel
        title="Recent infographics"
        action={
          <Link
            to="/admin/infographics/library"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </Link>
        }
      >
        <DataTable
          columns={[
            { key: "infographic", header: "Infographic" },
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
              title="No infographics yet"
              description="Upload an image or PDF, or create one manually to get started."
              action={
                <Link to="/admin/infographics/upload" className={cmsButton}>
                  <Upload className="h-4 w-4" /> Upload infographic
                </Link>
              }
            />
          ) : null}
          {recent.map((item) => (
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
                    {item.asset_url ? (
                      <DropdownMenuItem asChild>
                        <a href={item.asset_url} target="_blank" rel="noreferrer">
                          <ImagePlus className="mr-2 h-3.5 w-3.5" /> Preview asset
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
