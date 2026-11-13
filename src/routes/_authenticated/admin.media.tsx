import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Copy,
  Database,
  FileText,
  FolderOpen,
  ImagePlus,
  LayoutDashboard,
  List,
  Mic,
  Newspaper,
  PenLine,
  Search,
  Video,
} from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaFoldersPage, MediaLibraryPage } from "@/components/media";
import {
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  MetricCard,
  cmsSecondaryButton,
} from "@/components/cms";
import { getMediaStorageStats } from "@/lib/media.functions";
import { formatBytes } from "@/lib/dam";
import { requirePermissionRoute } from "@/lib/route-guards";
import { safeErrorMessage } from "@/lib/safe-error";
import { cn } from "@/lib/utils";

type MediaView =
  | "dashboard"
  | "images"
  | "videos"
  | "audio"
  | "documents"
  | "epaper-files"
  | "folders"
  | "search"
  | "metadata"
  | "image-editor"
  | "bulk"
  | "storage"
  // legacy aliases still supported
  | "library"
  | "upload"
  | "duplicates"
  | "activity"
  | "galleries"
  | "settings";

const VALID_VIEWS: MediaView[] = [
  "dashboard",
  "images",
  "videos",
  "audio",
  "documents",
  "epaper-files",
  "folders",
  "search",
  "metadata",
  "image-editor",
  "bulk",
  "storage",
  "library",
  "upload",
  "duplicates",
  "activity",
  "galleries",
  "settings",
];

export const Route = createFileRoute("/_authenticated/admin/media")({
  validateSearch: (search: Record<string, unknown>) => {
    const view = search.view;
    if (typeof view === "string" && VALID_VIEWS.includes(view as MediaView)) {
      return { view: view as MediaView };
    }
    return {} as { view?: MediaView };
  },
  beforeLoad: ({ context }) => requirePermissionRoute(context.roles, "media:view"),
  errorComponent: MediaRouteError,
  component: MediaAdminPage,
});

const TABS: Array<{ id: MediaView; label: string; icon: typeof ImagePlus }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "images", label: "Images", icon: ImagePlus },
  { id: "videos", label: "Videos", icon: Video },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "epaper-files", label: "ePaper Files", icon: Newspaper },
  { id: "folders", label: "Folders", icon: FolderOpen },
  { id: "search", label: "Search", icon: Search },
  { id: "metadata", label: "Metadata", icon: List },
  { id: "image-editor", label: "Image Editor", icon: PenLine },
  { id: "bulk", label: "Bulk Actions", icon: Copy },
  { id: "storage", label: "Storage", icon: Database },
];

function MediaRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="space-y-4 rounded-sm border border-destructive/30 bg-destructive/5 p-6">
      <h1 className="text-lg font-semibold text-foreground">Media page failed to load</h1>
      <p className="text-sm text-muted-foreground">{safeErrorMessage(error)}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-sm bg-navy px-3 py-1.5 text-sm text-navy-foreground"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
        <a href="/admin" className="rounded-sm border border-border px-3 py-1.5 text-sm">
          Back to admin
        </a>
      </div>
    </div>
  );
}

class MediaPanelBoundary extends Component<
  { children: ReactNode; label: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[media:${this.props.label}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">{this.props.label} crashed</p>
          <p className="mt-1 text-muted-foreground">{safeErrorMessage(this.state.error)}</p>
          <button
            type="button"
            className="mt-3 rounded-sm border border-border px-3 py-1.5 text-xs"
            onClick={() => this.setState({ error: null })}
          >
            Retry panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MediaStoragePage() {
  const q = useQuery({ queryKey: ["media-storage-stats"], queryFn: getMediaStorageStats });
  const used = q.data?.used_bytes ?? 0;
  const quota = q.data?.quota_bytes ?? 0;
  const available = q.data?.available_bytes ?? 0;
  const percent = q.data?.percent_used ?? 0;
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Storage Usage"
        description="Live totals from media_assets — no invented quotas."
      />
      {q.error ? <p className="text-sm text-destructive">{q.error.message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Used" value={formatBytes(used)} />
        <MetricCard label="Quota" value={quota ? formatBytes(quota) : "Not set"} />
        <MetricCard label="Available" value={quota ? formatBytes(available) : "—"} />
        <MetricCard label="Percent used" value={quota ? `${percent}%` : "—"} />
      </div>
      <CmsPanel title="Notes">
        <p className="p-4 text-sm text-muted-foreground">
          Quota is configured under Media Settings. Object storage is owned by the Supabase project.
        </p>
      </CmsPanel>
    </div>
  );
}

function MediaImageEditorDesk() {
  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Image Editor"
        description="Open an image from the library to crop, resize, or replace. Editor tools live on the asset detail sheet."
      />
      <CmsPanel title="How to edit">
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>1. Browse images below and open an asset.</p>
          <p>2. Use the Image Editor actions on the detail panel.</p>
          <Link to="/admin/media" search={{ view: "images" }} className={cmsSecondaryButton}>
            Open Images
          </Link>
        </div>
      </CmsPanel>
      <MediaLibraryPage initialType="image" />
    </div>
  );
}

function MediaAdminPage() {
  const navigate = Route.useNavigate();
  const { view: searchView } = Route.useSearch();
  const [view, setView] = useState<MediaView>(searchView ?? "dashboard");

  useEffect(() => {
    if (searchView) setView(searchView);
  }, [searchView]);

  const setMediaView = (next: MediaView) => {
    setView(next);
    void navigate({ search: next === "dashboard" ? {} : { view: next } });
  };

  let body: ReactNode;
  switch (view) {
    case "folders":
      body = (
        <MediaPanelBoundary label="Folders">
          <MediaFoldersPage />
        </MediaPanelBoundary>
      );
      break;
    case "storage":
      body = (
        <MediaPanelBoundary label="Storage">
          <MediaStoragePage />
        </MediaPanelBoundary>
      );
      break;
    case "image-editor":
      body = (
        <MediaPanelBoundary label="Image Editor">
          <MediaImageEditorDesk />
        </MediaPanelBoundary>
      );
      break;
    case "images":
      body = (
        <MediaPanelBoundary label="Images">
          <MediaLibraryPage initialType="image" />
        </MediaPanelBoundary>
      );
      break;
    case "videos":
      body = (
        <MediaPanelBoundary label="Videos">
          <MediaLibraryPage initialType="video" />
        </MediaPanelBoundary>
      );
      break;
    case "audio":
      body = (
        <MediaPanelBoundary label="Audio">
          <MediaLibraryPage initialType="audio" />
        </MediaPanelBoundary>
      );
      break;
    case "documents":
      body = (
        <MediaPanelBoundary label="Documents">
          <MediaLibraryPage initialType="document" />
        </MediaPanelBoundary>
      );
      break;
    case "epaper-files":
      body = (
        <MediaPanelBoundary label="ePaper Files">
          <div className="space-y-4">
            <CmsPageHeader
              title="ePaper Files"
              description="PDF/document assets used by ePaper. Edition publishing remains under Content → ePaper."
              actions={
                <Link to="/admin/epaper" className={cmsSecondaryButton}>
                  Open ePaper module
                </Link>
              }
            />
            <MediaLibraryPage initialType="document" />
          </div>
        </MediaPanelBoundary>
      );
      break;
    case "search":
      body = (
        <MediaPanelBoundary label="Search">
          <MediaLibraryPage initialFocusSearch />
        </MediaPanelBoundary>
      );
      break;
    case "metadata":
      body = (
        <MediaPanelBoundary label="Metadata">
          <div className="space-y-4">
            <CmsPageHeader
              title="Metadata"
              description="Edit alt text, captions, credits, tags, and categories from the asset detail sheet (list view)."
            />
            <MediaLibraryPage listMode="list" />
          </div>
        </MediaPanelBoundary>
      );
      break;
    case "bulk":
      body = (
        <MediaPanelBoundary label="Bulk Actions">
          <div className="space-y-4">
            <CmsPageHeader
              title="Bulk Actions"
              description="Select multiple assets in the library to move, tag, trash, or add to galleries."
            />
            <MediaLibraryPage listMode="list" />
          </div>
        </MediaPanelBoundary>
      );
      break;
    case "library":
    case "upload":
    case "duplicates":
    case "activity":
    case "galleries":
    case "settings":
    case "dashboard":
    default:
      body = (
        <MediaPanelBoundary label="Media Dashboard">
          {view === "library" ||
          view === "upload" ||
          view === "duplicates" ||
          view === "activity" ||
          view === "galleries" ||
          view === "settings" ? (
            <div className="space-y-4">
              <CmsEmptyState
                title="View moved"
                description="This legacy media tab now lives under the locked Media Library sections. Use Images, Folders, Bulk Actions, or Storage."
              />
              <MediaLibraryPage />
            </div>
          ) : (
            <div className="space-y-4">
              <CmsPageHeader
                title="Media Dashboard"
                description="Browse assets by type from the locked Media Library menu."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TABS.filter((t) => t.id !== "dashboard").map((tab) => (
                  <CmsPanel key={tab.id} title={tab.label}>
                    <div className="flex items-center justify-between gap-2 px-4 pb-4">
                      <tab.icon className="h-4 w-4 text-muted-foreground" />
                      <button
                        type="button"
                        className={cmsSecondaryButton}
                        onClick={() => setMediaView(tab.id)}
                      >
                        Open
                      </button>
                    </div>
                  </CmsPanel>
                ))}
              </div>
            </div>
          )}
        </MediaPanelBoundary>
      );
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Media sections" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id || (view === "library" && tab.id === "images");
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
              onClick={() => setMediaView(tab.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>
      {body}
    </div>
  );
}
