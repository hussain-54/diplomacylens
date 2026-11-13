import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  LayoutDashboard,
  ListMusic,
  Mic,
  PlusSquare,
  Radio,
  Settings2,
  Upload,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type PodcastNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

export const PODCASTS_SIDEBAR_ITEMS: PodcastNavItem[] = [
  {
    to: "/admin/podcasts",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "podcasts:view",
    exact: true,
  },
  {
    to: "/admin/podcasts/episodes",
    label: "Episodes",
    icon: Mic,
    permission: "podcasts:view",
  },
  {
    to: "/admin/podcasts/shows",
    label: "Shows",
    icon: Radio,
    permission: "podcasts:view",
  },
  {
    to: "/admin/podcasts/create",
    label: "Create Episode",
    icon: PlusSquare,
    permission: "podcasts:manage",
  },
  {
    to: "/admin/podcasts/upload",
    label: "Upload Episode",
    icon: Upload,
    permission: "podcasts:manage",
  },
  {
    to: "/admin/podcasts/playlists",
    label: "Playlists",
    icon: ListMusic,
    permission: "podcasts:view",
  },
  {
    to: "/admin/podcasts/archive",
    label: "Archive",
    icon: Archive,
    permission: "podcasts:view",
  },
  {
    to: "/admin/podcasts/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "podcasts:view",
  },
  {
    to: "/admin/podcasts/settings",
    label: "Settings",
    icon: Settings2,
    permission: "podcasts:manage",
  },
];

export const PODCASTS_PRIMARY_TABS: PodcastNavItem[] = PODCASTS_SIDEBAR_ITEMS.filter(
  (item) => item.to !== "/admin/podcasts/upload" && item.to !== "/admin/podcasts/create",
);

export const PODCASTS_MORE_ITEMS: PodcastNavItem[] = [];

export const PODCASTS_STATIC_SEGMENTS = new Set([
  "episodes",
  "shows",
  "create",
  "upload",
  "playlists",
  "archive",
  "analytics",
  "settings",
]);

export function isPodcastsNavActive(pathname: string, item: PodcastNavItem): boolean {
  if (item.exact) {
    return pathname === "/admin/podcasts" || pathname === "/admin/podcasts/";
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
