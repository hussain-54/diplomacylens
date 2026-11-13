import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBreakingNews, getBreakingNewsSettings } from "@/lib/breaking-news/functions";

/** Enough for ticker (≤8) + homepage alert; keep payload small. */
export const BREAKING_NEWS_FETCH_LIMIT = 10;

/**
 * Shared Realtime channel — SiteShell ticker + homepage alert both call this hook.
 * Reusing one topic without a singleton throws:
 * "cannot add postgres_changes callbacks … after subscribe()"
 */
let sharedChannel: RealtimeChannel | null = null;
let sharedRefCount = 0;
let sharedQueryClient: QueryClient | null = null;
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBreakingNewsInvalidate() {
  // Debounce: impression/view_count writes must not refetch-storm the homepage.
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    invalidateTimer = null;
    void sharedQueryClient?.invalidateQueries({ queryKey: ["breaking-news-active"] });
    void sharedQueryClient?.invalidateQueries({ queryKey: ["ticker"] });
  }, 2500);
}

function acquireBreakingNewsRealtime(qc: QueryClient) {
  sharedQueryClient = qc;
  sharedRefCount += 1;
  if (!sharedChannel) {
    try {
      sharedChannel = supabase
        .channel("public-breaking-news")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "breaking_news" },
          scheduleBreakingNewsInvalidate,
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "breaking_news" },
          scheduleBreakingNewsInvalidate,
        )
        .on(
          "postgres_changes",
          // Status/schedule edits — not high-churn counter bumps.
          { event: "UPDATE", schema: "public", table: "breaking_news" },
          scheduleBreakingNewsInvalidate,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "breaking_news_settings" },
          () => {
            void sharedQueryClient?.invalidateQueries({ queryKey: ["breaking-news-settings"] });
          },
        )
        .subscribe();
    } catch (error) {
      console.error("Breaking news realtime subscribe failed", error);
      sharedChannel = null;
      sharedRefCount = Math.max(0, sharedRefCount - 1);
      return () => undefined;
    }
  }
  return () => {
    sharedRefCount = Math.max(0, sharedRefCount - 1);
    if (sharedRefCount === 0 && sharedChannel) {
      if (invalidateTimer) {
        clearTimeout(invalidateTimer);
        invalidateTimer = null;
      }
      void supabase.removeChannel(sharedChannel);
      sharedChannel = null;
    }
  };
}

export function useActiveBreakingNews(limit = BREAKING_NEWS_FETCH_LIMIT) {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["breaking-news-settings"],
    queryFn: getBreakingNewsSettings,
    staleTime: 60_000,
  });
  const moduleEnabled = settingsQ.data?.module_enabled !== false;
  const realtimeEnabled = settingsQ.data?.realtime_enabled !== false;

  // Stable key so ticker + alert share one cache entry (no duplicate fetches).
  const q = useQuery({
    queryKey: ["breaking-news-active", BREAKING_NEWS_FETCH_LIMIT],
    queryFn: () => getActiveBreakingNews(BREAKING_NEWS_FETCH_LIMIT),
    // Fetch in parallel with settings; hide results if module disabled.
    enabled: moduleEnabled || settingsQ.isLoading || settingsQ.isPending,
    staleTime: 30_000,
    // Poll only when realtime is off — otherwise realtime + polling double the work.
    refetchInterval: moduleEnabled && !realtimeEnabled ? 60_000 : false,
  });

  useEffect(() => {
    if (!moduleEnabled || !realtimeEnabled) return;
    return acquireBreakingNewsRealtime(qc);
  }, [qc, moduleEnabled, realtimeEnabled]);

  return {
    settings: settingsQ.data,
    items: moduleEnabled ? (q.data ?? []).slice(0, limit) : [],
    isLoading: settingsQ.isLoading || (moduleEnabled && q.isLoading),
  };
}
