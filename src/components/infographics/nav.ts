import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  FolderKanban,
  LayoutDashboard,
  Library,
  PlusSquare,
  Settings2,
  Upload,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type InfographicsNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

export const INFOGRAPHICS_SIDEBAR_ITEMS: InfographicsNavItem[] = [
  {
    to: "/admin/infographics",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "infographics:view",
    exact: true,
  },
  {
    to: "/admin/infographics/library",
    label: "Library",
    icon: Library,
    permission: "infographics:view",
  },
  {
    to: "/admin/infographics/upload",
    label: "Upload",
    icon: Upload,
    permission: "infographics:manage",
  },
  {
    to: "/admin/infographics/create",
    label: "Create",
    icon: PlusSquare,
    permission: "infographics:manage",
  },
  {
    to: "/admin/infographics/collections",
    label: "Collections",
    icon: FolderKanban,
    permission: "infographics:view",
  },
  {
    to: "/admin/infographics/archive",
    label: "Archive",
    icon: Archive,
    permission: "infographics:view",
  },
  {
    to: "/admin/infographics/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "infographics:view",
  },
  {
    to: "/admin/infographics/settings",
    label: "Settings",
    icon: Settings2,
    permission: "infographics:manage",
  },
];

export const INFOGRAPHICS_PRIMARY_TABS: InfographicsNavItem[] = INFOGRAPHICS_SIDEBAR_ITEMS.filter(
  (item) => item.to !== "/admin/infographics/upload" && item.to !== "/admin/infographics/create",
);

export const INFOGRAPHICS_MORE_ITEMS: InfographicsNavItem[] = [];

export const INFOGRAPHICS_STATIC_SEGMENTS = new Set([
  "library",
  "create",
  "upload",
  "collections",
  "archive",
  "analytics",
  "settings",
]);

export function isInfographicsNavActive(pathname: string, item: InfographicsNavItem): boolean {
  if (item.exact) {
    return pathname === "/admin/infographics" || pathname === "/admin/infographics/";
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
