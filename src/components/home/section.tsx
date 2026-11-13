import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HomeSection({
  id,
  eyebrow,
  title,
  href,
  hrefLabel = "View all →",
  children,
  className,
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "ink";
}) {
  const toneClass =
    tone === "muted"
      ? "border-t border-border bg-secondary"
      : tone === "ink"
        ? "border-t border-border bg-navy text-navy-foreground"
        : "border-t border-border bg-background";

  return (
    <section
      id={id}
      className={cn(toneClass, className)}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:py-12">
        <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
          <div>
            {eyebrow ? (
              <div
                className={cn(
                  "eyebrow",
                  tone === "ink" ? "text-navy-foreground/60" : "text-muted-foreground",
                )}
              >
                {eyebrow}
              </div>
            ) : null}
            <h2
              id={id ? `${id}-heading` : undefined}
              className={cn(
                "font-serif text-2xl md:text-3xl",
                eyebrow ? "mt-1" : "rule-top pt-3",
                tone === "ink" ? "text-navy-foreground" : "text-ink",
              )}
            >
              {title}
            </h2>
          </div>
          {href ? (
            <a
              href={href}
              className={cn(
                "shrink-0 text-xs font-semibold uppercase tracking-widest hover:text-crimson",
                tone === "ink" ? "text-navy-foreground/70" : "text-navy",
              )}
            >
              {hrefLabel}
            </a>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function HomeEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function HomeScrollRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HomeRailItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-[72%] shrink-0 snap-start sm:w-[45%] md:w-auto md:shrink", className)}>
      {children}
    </div>
  );
}
