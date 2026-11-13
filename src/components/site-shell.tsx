import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Menu, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useLiveVisitors } from "@/hooks/useLiveVisitors";
import { getSections } from "@/lib/content.functions";
import { getPublicFooter } from "@/lib/cms-site/footer";
import { SmartWidgetSlot } from "@/components/smart-widgets/public-renderer";
import { MobileBottomNav } from "@/components/site/mobile-bottom-nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { section: "pakistan", label: "Pakistan" },
  { section: "politics", label: "Politics" },
  { section: "world", label: "World" },
  { section: "war", label: "War" },
  { section: "embassy-watch", label: "Embassy Watch" },
  { section: "business", label: "Business" },
  { section: "sports", label: "Sports" },
  { section: "entertainment", label: "Entertainment" },
] as const;

const UTILITY_LINKS = [
  { to: "/newsletter", label: "Newsletter" },
  { to: "/podcast", label: "Podcast" },
  { to: "/epaper", label: "E-Paper" },
  { to: "/about", label: "About" },
] as const;

type NavItem = { key: string; href: string; label: string; exact?: boolean };

function usePublicNavItems(): NavItem[] {
  // Exact Global Diplomacy Lens section nav (labels/order are product-defined).
  return NAV.map((item) =>
    "to" in item
      ? { key: item.to, href: item.to, label: item.label, exact: item.to === "/" }
      : { key: item.section, href: `/section/${item.section}`, label: item.label },
  );
}

function BrandMark({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md";
  /** Kept for call-site compatibility; logo artwork is self-colored. */
  tone?: "default" | "onDark";
  className?: string;
}) {
  // Wide original mark (~4.65:1). Cap width on mobile so menu/search stay clear.
  const height =
    size === "xs" ? "h-8 max-h-10" : size === "sm" ? "h-9 sm:h-10" : "h-12 sm:h-14 md:h-[4.25rem]";
  const maxWidth =
    size === "xs" ? "max-w-[min(100%,17.5rem)]" : size === "sm" ? "max-w-[22rem]" : "max-w-[36rem]";
  return (
    <Link
      to="/"
      className={cn("inline-flex max-w-full items-center", className)}
      aria-label="Global Diplomacy Lens home"
    >
      <img
        src="/images/global-diplomacy-lens-logo.png"
        alt="Global Diplomacy Lens"
        width={1024}
        height={220}
        decoding="async"
        className={cn("h-auto w-auto object-contain object-left", height, maxWidth)}
      />
    </Link>
  );
}

function TopStrip() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    setNow(fmt());
    const t = setInterval(() => setNow(fmt()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border-b border-border bg-background text-foreground">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-3 py-1.5 text-xs md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
          <span className="live-dot eyebrow shrink-0 text-crimson">Live</span>
          <span className="hidden truncate text-muted-foreground md:inline">{now}</span>
          <span className="hidden text-muted-foreground lg:inline">· Global Diplomatic Bureau</span>
          <SmartWidgetSlot
            pageType="global"
            slotKey="top_bar"
            className="hidden min-w-0 flex-1 md:block"
          />
        </div>
        <div className="hidden items-center gap-4 text-muted-foreground md:flex">
          {UTILITY_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (loading) return <div className={cn(compact ? "h-10 w-full" : "h-8 w-20")} />;
  if (!user) {
    return (
      <Link
        to="/newsletter"
        className={cn(
          "rounded-sm bg-crimson font-semibold uppercase tracking-wider text-crimson-foreground hover:opacity-90",
          compact
            ? "flex h-10 w-full items-center justify-center px-3 text-xs"
            : "px-3 py-1.5 text-xs",
        )}
      >
        Subscribe
      </Link>
    );
  }
  return (
    <div className={cn("flex items-center gap-2", compact && "w-full")}>
      <Link
        to="/admin"
        className={cn(
          "rounded-sm bg-navy font-semibold uppercase tracking-wider text-navy-foreground hover:opacity-90",
          compact
            ? "flex h-10 w-full items-center justify-center px-3 text-xs"
            : "px-3 py-1.5 text-xs",
        )}
      >
        Newsroom
      </Link>
      {!compact ? (
        <button
          type="button"
          onClick={async () => {
            await queryClient.cancelQueries();
            queryClient.clear();
            await supabase.auth.signOut();
            navigate({ to: "/", replace: true });
          }}
          className="rounded-sm border border-input px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-accent"
        >
          Sign out
        </button>
      ) : null}
    </div>
  );
}

function MastheadSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <form
      className={className}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = query.trim();
        if (!q) return;
        void navigate({ to: "/search", search: { q, page: 1 } });
        setQuery("");
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search news, ambassadors, embassies…"
        aria-label="Search articles"
        className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-navy"
      />
    </form>
  );
}

function MobileSearchSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="h-auto border-b p-4 pt-10">
        <SheetHeader className="sr-only">
          <SheetTitle>Search</SheetTitle>
        </SheetHeader>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const q = query.trim();
            if (!q) return;
            onOpenChange(false);
            void navigate({ to: "/search", search: { q, page: 1 } });
            setQuery("");
          }}
        >
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Diplomacy Lens…"
            aria-label="Search articles"
            className="min-w-0 flex-1 rounded-sm border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-navy"
          />
          <button
            type="submit"
            className="rounded-sm bg-navy px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-navy-foreground"
          >
            Go
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function MobileMenuDrawer({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: NavItem[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[min(100%,20rem)] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="sr-only">Site menu</SheetTitle>
          <BrandMark size="sm" />
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Mobile">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.key}>
                  <a
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "block rounded-sm px-3 py-3 text-sm font-semibold uppercase tracking-wider",
                      active ? "bg-secondary text-crimson" : "text-foreground hover:bg-secondary",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-border px-3 pt-4">
            <p className="eyebrow mb-2 text-muted-foreground">More</p>
            <ul className="space-y-1">
              {UTILITY_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => onOpenChange(false)}
                    className="block py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <div className="border-t border-border p-4">
          {user ? (
            <div className="flex flex-col gap-2">
              <Link
                to="/admin"
                onClick={() => onOpenChange(false)}
                className="rounded-sm bg-navy px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-navy-foreground"
              >
                Newsroom
              </Link>
              <button
                type="button"
                className="rounded-sm border border-input px-3 py-2.5 text-xs font-semibold uppercase tracking-wider"
                onClick={async () => {
                  onOpenChange(false);
                  await queryClient.cancelQueries();
                  queryClient.clear();
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/newsletter"
              onClick={() => onOpenChange(false)}
              className="block rounded-sm bg-crimson px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-crimson-foreground"
            >
              Subscribe
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Masthead({
  onOpenMenu,
  onOpenSearch,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <div className="border-b border-border bg-background">
      {/* Mobile masthead — two rows so logo never competes with Subscribe */}
      <div className="mx-auto max-w-[1400px] px-3 py-2.5 md:hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 justify-center overflow-hidden px-1">
            <BrandMark size="xs" className="justify-center" />
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2">
          <AccountMenu compact />
        </div>
      </div>

      {/* Desktop masthead */}
      <div className="mx-auto hidden max-w-[1400px] items-center justify-between gap-4 px-4 py-5 md:flex">
        <BrandMark />
        <MastheadSearch className="max-w-md flex-1" />
        <AccountMenu />
      </div>
    </div>
  );
}

function MainNav({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Desktop/tablet only — mobile uses the hamburger drawer + bottom nav.
  return (
    <nav className="sticky top-0 z-40 hidden border-b-2 border-ink bg-background/95 backdrop-blur md:block">
      <div className="mx-auto max-w-[1400px] overflow-x-auto px-4 scrollbar-none">
        <ul className="flex items-center gap-1 whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.key}>
                <a
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-9 items-center px-3 py-1.5",
                    active ? "text-crimson" : "text-foreground hover:text-crimson",
                  )}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

const sectionsQO = queryOptions({
  queryKey: ["sections"],
  queryFn: () => getSections(),
  staleTime: 60_000,
});
const footerQO = queryOptions({
  queryKey: ["public-footer"],
  queryFn: getPublicFooter,
  staleTime: 60_000,
});

function Footer() {
  const { data: sections = [] } = useQuery(sectionsQO);
  const { data: footer } = useQuery(footerQO);
  const year = new Date().getFullYear();
  const linkGroups = footer?.groups ?? [];
  const social = footer?.social_links?.length
    ? footer.social_links
    : [
        { href: "https://www.facebook.com/", label: "Facebook" },
        { href: "https://x.com/", label: "X" },
        { href: "https://www.linkedin.com/", label: "LinkedIn" },
        { href: "https://www.instagram.com/", label: "Instagram" },
        { href: "https://www.youtube.com/", label: "YouTube" },
        { href: "https://t.me/", label: "Telegram" },
      ];

  const bottomLegal = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/cookies", label: "Cookies" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/sitemap", label: "Sitemap" },
  ];

  const newsletterEnabled = footer?.newsletter_enabled ?? true;
  const newsletterHeading = footer?.newsletter_heading ?? "Newsletter";
  const newsletterBlurb =
    footer?.newsletter_blurb ?? "Briefings from the global bureau desk, delivered each morning.";
  const copyright = footer?.copyright ?? `© ${year} Diplomacy Lens. All rights reserved.`;

  return (
    <footer
      className="mt-10 border-t border-border bg-navy text-navy-foreground md:mt-16"
      role="contentinfo"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:py-14">
        <SmartWidgetSlot pageType="global" slotKey="footer" className="mb-8" />
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="max-w-sm shrink-0">
            <BrandMark size="sm" tone="onDark" />
            <p className="mt-4 text-sm leading-relaxed text-navy-foreground/70">
              Independent journalism delivering trusted global affairs, diplomacy, policy analysis,
              and geopolitical intelligence from around the world.
            </p>
            <div className="mt-6">
              <h4 className="eyebrow mb-3 text-navy-foreground/50">Follow us</h4>
              <ul className="flex flex-wrap gap-2" aria-label="Social media">
                {social.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-sm border border-navy-foreground/15 px-3 text-xs font-semibold uppercase tracking-wider text-navy-foreground/80 transition-colors hover:border-crimson hover:bg-crimson hover:text-crimson-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {newsletterEnabled ? (
              <div className="mt-8">
                <h4 className="eyebrow mb-2 text-navy-foreground/50">{newsletterHeading}</h4>
                <p className="text-sm text-navy-foreground/70">{newsletterBlurb}</p>
                <Link
                  to="/newsletter"
                  className="mt-4 inline-flex rounded-sm bg-crimson px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-crimson-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-navy focus-visible:ring-crimson"
                >
                  Subscribe
                </Link>
              </div>
            ) : null}
          </div>

          <nav aria-label="Footer" className="min-w-0 flex-1">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {linkGroups.map((group) => (
                <div key={group.id}>
                  <h4 className="eyebrow mb-3 text-navy-foreground/50">{group.label}</h4>
                  <ul className="space-y-2 text-sm">
                    {group.links.map((item) => (
                      <li key={`${group.id}-${item.href}`}>
                        <a
                          href={item.href}
                          className="text-navy-foreground/80 transition-colors hover:text-navy-foreground focus-visible:outline-none focus-visible:underline"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                    {group.id === "explore"
                      ? sections.slice(0, 4).map((s) => (
                          <li key={s.id}>
                            <Link
                              to="/section/$slug"
                              params={{ slug: s.slug }}
                              className="text-navy-foreground/80 transition-colors hover:text-navy-foreground focus-visible:outline-none focus-visible:underline"
                            >
                              {s.name}
                            </Link>
                          </li>
                        ))
                      : null}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </div>

      <div className="border-t border-navy-foreground/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-5 text-xs text-navy-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright.includes("©") ? copyright : `© ${year} ${copyright}`}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal">
            {bottomLegal.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="transition-colors hover:text-navy-foreground focus-visible:outline-none focus-visible:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  useLiveVisitors(true);
  const navItems = usePublicNavItems();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const openMenu = () => setMenuOpen(true);
    window.addEventListener("dl:open-mobile-menu", openMenu);
    return () => window.removeEventListener("dl:open-mobile-menu", openMenu);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopStrip />
      <Masthead onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
      <MainNav items={navItems} />
      <main className="pb-mobile-nav">{children}</main>
      <Footer />
      <MobileBottomNav />
      <MobileMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} items={navItems} />
      <MobileSearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
