import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  FolderTree,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PenLine,
  Plus,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/admin.functions";
import { hasPermission, ROLE_LABELS, type Permission, type AppRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
  exact?: boolean;
  params?: Record<string, string>;
};

const NAV_ITEMS: NavItem[] = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
    exact: true,
  },
  {
    to: "/admin/articles",
    label: "Articles",
    icon: FileText,
    permission: "articles:view",
  },
  {
    to: "/admin/articles/$id",
    label: "New Article",
    icon: PenLine,
    permission: "articles:create",
    params: { id: "new" },
  },
  {
    to: "/admin/media",
    label: "Media Library",
    icon: ImagePlus,
    permission: "media:view",
  },
  {
    to: "/admin/categories",
    label: "Categories & Tags",
    icon: FolderTree,
    permission: "categories:manage",
  },
  {
    to: "/admin/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings:manage",
  },
];

const COLLAPSE_KEY = "client-cms-sidebar-collapsed";

function initialTheme() {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem("newsroom-theme");
  if (saved) return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function initialCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSE_KEY) === "1";
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to || pathname === `${item.to}/`;
  if (item.label === "New Article") {
    return pathname === "/admin/articles/new" || pathname.endsWith("/articles/new");
  }
  if (item.to === "/admin/categories") {
    return pathname.startsWith("/admin/categories") || pathname.startsWith("/admin/tags");
  }
  if (item.to === "/admin/articles") {
    return (
      pathname.startsWith("/admin/articles") &&
      pathname !== "/admin/articles/new" &&
      !pathname.endsWith("/articles/new")
    );
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => getMe(), staleTime: 60_000 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(initialTheme);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const roles = meQ.data?.roles ?? [];
  const canCreate = hasPermission(roles, "articles:create");

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(roles, item.permission)),
    [roles],
  );

  const pageName =
    [...visibleItems]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => isActive(location.pathname, item))?.label ?? "CMS";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("newsroom-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
  };

  const sidebarWidth = collapsed ? "w-[76px]" : "w-[260px]";

  const sidebar = (
    <aside
      className={cn("flex h-full flex-col border-r cms-transition", sidebarWidth)}
      style={{
        background: "var(--cms-sidebar)",
        borderColor: "var(--cms-sidebar-border)",
      }}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b",
          collapsed ? "justify-center px-2" : "gap-2 px-3",
        )}
        style={{ borderColor: "var(--cms-sidebar-border)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left cms-transition hover:bg-accent/80",
                collapsed && "justify-center px-1.5",
              )}
            >
              <img
                src="/images/diplomacy-lens-logo.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-lg bg-background object-contain"
              />
              {!collapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold tracking-tight">
                      Diplomacy Lens
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">Client CMS</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/admin">Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/" target="_blank" rel="noreferrer">
                Open public site
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut className="h-3.5 w-3.5" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {canCreate ? (
        <div className={cn("px-3 pt-3", collapsed && "px-2")}>
          <Link
            to="/admin/articles/$id"
            params={{ id: "new" }}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-sm cms-transition hover:opacity-95",
              collapsed && "px-0",
            )}
          >
            <Plus className="h-4 w-4" />
            {!collapsed ? "New article" : null}
          </Link>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4" aria-label="CMS navigation">
        {!collapsed ? (
          <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            Content
          </div>
        ) : null}
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(location.pathname, item);
            return (
              <li key={`${item.to}-${item.label}`}>
                <Link
                  to={item.to}
                  params={item.params}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium cms-transition",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className="border-t p-3"
        style={{ borderColor: "var(--cms-sidebar-border)" }}
      >
        <div className={cn("mb-2", collapsed && "hidden")}>
          <div className="truncate text-xs font-semibold">
            {meQ.data?.profile?.name || meQ.data?.profile?.byline_name || "Editor"}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {(roles as AppRole[]).map((r) => ROLE_LABELS[r] ?? r).join(" · ") || "Staff"}
          </div>
        </div>
        <div className={cn("flex gap-1", collapsed && "flex-col items-center")}>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-8 flex-1 items-center justify-center rounded-lg border border-border/70 text-xs text-muted-foreground hover:bg-accent lg:flex"
          >
            {collapsed ? "»" : "Collapse"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/70 px-2 text-xs text-muted-foreground hover:bg-accent",
              collapsed ? "w-full" : "flex-1",
            )}
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed ? "Logout" : null}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block">{sidebar}</div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative h-full w-[260px] max-w-[85vw] shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className={cn("cms-transition", collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]")}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">
                Client CMS
              </div>
              <div className="text-sm font-semibold tracking-tight">{pageName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDark((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 text-muted-foreground cms-transition hover:border-primary/30 hover:bg-accent hover:text-foreground"
            aria-label={dark ? "Use light mode" : "Use dark mode"}
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </header>
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1680px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
      <Toaster />
    </AdminShell>
  );
}
