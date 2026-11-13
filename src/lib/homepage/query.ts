import { queryOptions } from "@tanstack/react-query";

export type HomepageRenderMode = "live" | "draft" | { versionId: string };

export type HomepageRenderData = {
  sections: never[];
  content: null;
  legacy: true;
};

export const HOMEPAGE_STALE_MS = 30_000;
export const HOMEPAGE_GC_MS = 5 * 60_000;

export function homepageQueryKey(mode: HomepageRenderMode) {
  return ["homepage-render", mode] as const;
}

/** Client build always uses OriginalHomepage (legacy). */
export async function loadHomepage(
  _mode: HomepageRenderMode = "live",
): Promise<HomepageRenderData> {
  return { sections: [], content: null, legacy: true };
}

export function homepageQueryOptions(mode: HomepageRenderMode = "live") {
  return queryOptions({
    queryKey: homepageQueryKey(mode),
    queryFn: () => loadHomepage(mode),
    staleTime: HOMEPAGE_STALE_MS,
    gcTime: HOMEPAGE_GC_MS,
  });
}

export function isHomepageContentPopulated(): boolean {
  return false;
}
