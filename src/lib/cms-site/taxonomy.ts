import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";
import { listAdminArticles } from "@/lib/admin.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** Distinct article regions used as location taxonomy (no second source of truth). */
export async function listTaxonomyLocations() {
  try {
    const articles = await listAdminArticles();
    const counts = new Map<string, number>();
    for (const a of articles) {
      const region = (a as { region?: string | null }).region?.trim();
      if (!region) continue;
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, articleCount]) => ({ name, articleCount }))
      .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/schema cache|PGRST|permission/i.test(msg)) return [];
    throw e;
  }
}

/** Content types present in articles / media tables (counts only). */
export async function listTaxonomyContentTypes() {
  const types: Array<{ key: string; label: string; count: number }> = [];
  const count = async (table: string, label: string, key: string) => {
    const { count: c, error } = await db().from(table).select("id", { count: "exact", head: true });
    if (error) {
      if (/schema cache|PGRST|relation/i.test(error.message)) {
        types.push({ key, label, count: 0 });
        return;
      }
      throw toAppError(error);
    }
    types.push({ key, label, count: c ?? 0 });
  };
  await Promise.all([
    count("articles", "Articles", "article"),
    count("videos", "Videos", "video"),
    count("podcast_episodes", "Podcast episodes", "podcast"),
    count("infographics", "Infographics", "infographic"),
    count("epaper_editions", "ePaper editions", "epaper"),
    count("stories", "Stories", "story"),
    count("topics", "Topics", "topic"),
  ]);
  return types;
}
