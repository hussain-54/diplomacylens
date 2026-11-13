import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Newspaper, Radio, Video, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    to: "/latest",
    label: "Latest",
    icon: Newspaper,
    match: (p: string) => p.startsWith("/latest") || p.startsWith("/popular"),
  },
  {
    to: "/breaking",
    label: "Breaking",
    icon: Radio,
    match: (p: string) => p.startsWith("/breaking"),
  },
  {
    to: "/video",
    label: "Videos",
    icon: Video,
    match: (p: string) => p.startsWith("/video"),
  },
] as const;

/**
 * Fixed mobile bottom nav — hidden from md and up.
 * Menu opens the site drawer via a custom event so SiteShell owns the sheet state.
 */
export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold uppercase tracking-wider",
                  active ? "text-crimson" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            aria-label="Open menu"
            onClick={() => window.dispatchEvent(new CustomEvent("dl:open-mobile-menu"))}
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
