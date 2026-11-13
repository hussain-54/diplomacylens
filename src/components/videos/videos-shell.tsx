import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  VIDEOS_MORE_ITEMS,
  VIDEOS_PRIMARY_TABS,
  VIDEOS_STATIC_SEGMENTS,
  isVideosNavActive,
} from "@/components/videos/nav";
import { cmsButton, cmsSecondaryButton } from "@/components/cms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMe } from "@/lib/admin.functions";
import { canManageVideos, canViewVideos } from "@/lib/video.functions";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function VideosLayout() {
  return (
    <VideosShell>
      <Outlet />
    </VideosShell>
  );
}

function VideosShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 60_000 });
  const roles = me.data?.roles;
  const canManage = canManageVideos(roles);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathParts = location.pathname.split("/").filter(Boolean);
  const maybeId = pathParts[2];
  const inEditWorkflow =
    pathParts[0] === "admin" &&
    pathParts[1] === "videos" &&
    maybeId &&
    !VIDEOS_STATIC_SEGMENTS.has(maybeId);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const primary = useMemo(
    () =>
      VIDEOS_PRIMARY_TABS.filter(
        (item) =>
          hasPermission(roles, item.permission) ||
          (item.permission === "videos:manage" && canViewVideos(roles)),
      ),
    [roles],
  );
  const more = useMemo(
    () =>
      VIDEOS_MORE_ITEMS.filter(
        (item) =>
          hasPermission(roles, item.permission) ||
          (item.permission === "videos:manage" && canViewVideos(roles)),
      ),
    [roles],
  );
  const moreActive = more.some((item) => isVideosNavActive(location.pathname, item));

  if (inEditWorkflow) {
    return <div className="space-y-6">{children}</div>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              Videos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Produce, publish, and analyze video journalism — clips, dispatches, and playlists.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage ? (
              <>
                <Link to="/admin/videos/upload" className={cmsSecondaryButton}>
                  <Upload className="h-4 w-4" /> Upload Video
                </Link>
                <Link to="/admin/videos/create" className={cmsButton}>
                  <Plus className="h-4 w-4" /> Create Video
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <nav
          className={cn(
            "flex flex-wrap items-center gap-1 border-b border-border/60 pb-px",
            mobileOpen ? "flex" : "hidden lg:flex",
          )}
          aria-label="Videos"
        >
          {primary.map((item) => {
            const active = isVideosNavActive(location.pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 bg-foreground" aria-hidden />
                ) : null}
              </Link>
            );
          })}
          {more.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex items-center gap-1 px-3 py-2.5 text-sm font-medium",
                    moreActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  More <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {more.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </nav>
      </header>
      {children}
    </div>
  );
}
