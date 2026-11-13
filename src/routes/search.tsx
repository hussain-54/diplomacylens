import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { ArticleCard } from "@/components/article-card";
import { searchArticles } from "@/lib/content.functions";

type SearchParams = { q: string; page: number };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : "",
    page: Math.max(1, Number(search.page) || 1),
  }),
  head: ({ match }) => ({
    meta: [
      {
        title: match.search.q
          ? `Search: ${match.search.q} — Diplomacy Lens`
          : "Search — Diplomacy Lens",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [draft, setDraft] = useState(q);
  const results = useQuery({
    queryKey: ["search", q, page],
    queryFn: () => searchArticles({ data: { query: q, page } }),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
  });

  const total = results.data?.total ?? 0;
  const pageSize = results.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SiteShell>
      <div className="border-b border-border bg-secondary">
        <div className="mx-auto max-w-[1400px] px-4 py-10">
          <div className="eyebrow text-crimson">Search</div>
          <h1 className="mt-1 font-serif text-5xl text-ink">
            {q ? `Results for “${q}”` : "Search the archive"}
          </h1>
          <form
            className="mt-6 flex max-w-xl gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({ search: { q: draft.trim(), page: 1 } });
            }}
          >
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search headlines, summaries, topics…"
                aria-label="Search articles"
                className="h-11 w-full border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-navy"
              />
            </div>
            <button
              type="submit"
              className="h-11 shrink-0 bg-navy px-5 text-xs font-semibold uppercase tracking-widest text-navy-foreground hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] px-4 py-10">
        {!q.trim() ? (
          <p className="text-sm text-muted-foreground">
            Enter a keyword to search published coverage.
          </p>
        ) : results.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : results.isError ? (
          <p className="text-sm text-crimson">Search failed: {results.error.message}</p>
        ) : !results.data?.articles.length ? (
          <div className="py-10 text-center">
            <p className="font-serif text-2xl text-ink">No results for “{q}”</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different keyword, or browse the{" "}
              <Link to="/latest" className="text-crimson underline">
                latest coverage
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {total} result{total === 1 ? "" : "s"}
              {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
            </p>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {results.data.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav
                aria-label="Search result pages"
                className="mt-10 flex items-center justify-center gap-2"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => void navigate({ search: { q, page: page - 1 } })}
                  className="border border-input px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-accent disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => void navigate({ search: { q, page: page + 1 } })}
                  className="border border-input px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-accent disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </SiteShell>
  );
}
