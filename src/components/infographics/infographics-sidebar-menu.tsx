import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown, ImagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { INFOGRAPHICS_SIDEBAR_ITEMS, isInfographicsNavActive } from "@/components/infographics/nav";
import { canManageInfographics, canViewInfographics } from "@/lib/infographics.functions";
import type { AppRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const EXPAND_KEY = "newsroom-infographics-nav-expanded";

function initialExpanded() {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem(EXPAND_KEY);
  if (saved === null) return true;
  return saved === "1";
}

export function InfographicsSidebarMenu({
  collapsed,
  roles,
}: {
  collapsed: boolean;
  roles: AppRole[] | string[];
}) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(initialExpanded);
  const inInfographics = location.pathname.startsWith("/admin/infographics");

  const items = useMemo(
    () =>
      INFOGRAPHICS_SIDEBAR_ITEMS.filter((item) => {
        if (item.permission === "infographics:manage") return canManageInfographics(roles);
        return canViewInfographics(roles);
      }),
    [roles],
  );

  useEffect(() => {
    window.localStorage.setItem(EXPAND_KEY, expanded ? "1" : "0");
  }, [expanded]);

  if (collapsed) {
    const link = (
      <Link
        to="/admin/infographics"
        className={cn(
          "relative flex h-9 items-center justify-center rounded-lg cms-transition",
          inInfographics
            ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--cms-glow),0_6px_16px_var(--cms-glow)]"
            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground",
        )}
        aria-label="Infographics"
      >
        <ImagePlus className="h-4 w-4" />
      </Link>
    );
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">Infographics</TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium cms-transition",
          inInfographics
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-accent/80",
        )}
      >
        <ImagePlus className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Infographics</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-border/60 pl-2">
          {items.map((item) => {
            const active = isInfographicsNavActive(location.pathname, item);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium cms-transition",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
