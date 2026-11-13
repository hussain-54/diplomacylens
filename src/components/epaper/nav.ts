import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Newspaper,
  PlusSquare,
  Upload,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type EpaperNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

export const EPAPER_SIDEBAR_ITEMS: EpaperNavItem[] = [
  {
    to: "/admin/epaper",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "epaper:view",
    exact: true,
  },
  {
    to: "/admin/epaper/editions",
    label: "Editions",
    icon: Newspaper,
    permission: "epaper:view",
  },
  {
    to: "/admin/epaper/upload",
    label: "Upload Edition",
    icon: Upload,
    permission: "epaper:manage",
  },
  {
    to: "/admin/epaper/create",
    label: "Create Edition",
    icon: PlusSquare,
    permission: "epaper:manage",
  },
  {
    to: "/admin/epaper/flipbook",
    label: "Flipbook Viewer",
    icon: BookOpen,
    permission: "epaper:view",
  },
  {
    to: "/admin/epaper/archive",
    label: "Archive",
    icon: Archive,
    permission: "epaper:view",
  },
  {
    to: "/admin/epaper/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "epaper:view",
  },
];

export const EPAPER_PRIMARY_TABS: EpaperNavItem[] = EPAPER_SIDEBAR_ITEMS.filter(
  (item) => item.to !== "/admin/epaper/upload" && item.to !== "/admin/epaper/create",
);

export const EPAPER_MORE_ITEMS: EpaperNavItem[] = [];

export const EPAPER_STATIC_SEGMENTS = new Set([
  "editions",
  "upload",
  "create",
  "flipbook",
  "archive",
  "analytics",
]);

export function isEpaperNavActive(pathname: string, item: EpaperNavItem): boolean {
  if (item.exact) {
    return pathname === "/admin/epaper" || pathname === "/admin/epaper/";
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
