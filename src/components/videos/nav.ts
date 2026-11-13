import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Film,
  LayoutDashboard,
  ListVideo,
  PlusSquare,
  Settings2,
  Upload,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type VideoNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

export const VIDEOS_SIDEBAR_ITEMS: VideoNavItem[] = [
  {
    to: "/admin/videos",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "videos:manage",
    exact: true,
  },
  {
    to: "/admin/videos/library",
    label: "Library",
    icon: Film,
    permission: "videos:manage",
  },
  {
    to: "/admin/videos/create",
    label: "Create Video",
    icon: PlusSquare,
    permission: "videos:manage",
  },
  {
    to: "/admin/videos/upload",
    label: "Upload Video",
    icon: Upload,
    permission: "videos:manage",
  },
  {
    to: "/admin/videos/playlists",
    label: "Playlists",
    icon: ListVideo,
    permission: "videos:manage",
  },
  {
    to: "/admin/videos/archive",
    label: "Archive",
    icon: Archive,
    permission: "videos:manage",
  },
  {
    to: "/admin/videos/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "videos:manage",
  },
  {
    to: "/admin/videos/settings",
    label: "Settings",
    icon: Settings2,
    permission: "videos:manage",
  },
];

export const VIDEOS_PRIMARY_TABS: VideoNavItem[] = VIDEOS_SIDEBAR_ITEMS.filter(
  (item) => item.to !== "/admin/videos/upload" && item.to !== "/admin/videos/create",
);

export const VIDEOS_MORE_ITEMS: VideoNavItem[] = [];

export const VIDEOS_STATIC_SEGMENTS = new Set([
  "library",
  "create",
  "upload",
  "playlists",
  "archive",
  "analytics",
  "settings",
]);

export function isVideosNavActive(pathname: string, item: VideoNavItem): boolean {
  if (item.exact) {
    return pathname === "/admin/videos" || pathname === "/admin/videos/";
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
