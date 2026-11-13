import { SiteShell } from "@/components/site-shell";
import { OriginalHomepage } from "@/components/home/original-homepage";
import { cn } from "@/lib/utils";

export type HomepageRenderMode = "live" | "draft" | { versionId: string };

/**
 * Client homepage — always the magazine OriginalHomepage composition.
 * Homepage Builder admin is not included in this build.
 */
export function HomepageRenderer({
  mode: _mode = "live",
  wrapShell = true,
  className,
}: {
  mode?: HomepageRenderMode;
  wrapShell?: boolean;
  className?: string;
}) {
  const body = <OriginalHomepage className={cn(className)} />;
  if (!wrapShell) return body;
  return <SiteShell>{body}</SiteShell>;
}
