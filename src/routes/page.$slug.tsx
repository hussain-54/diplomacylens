import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { ArticleBody } from "@/components/article-body";
import { getCmsPageBySlug } from "@/lib/cms-site/pages";

export const Route = createFileRoute("/page/$slug")({
  component: PublicCmsPage,
});

function PublicCmsPage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-cms-page", slug],
    queryFn: () => getCmsPageBySlug(slug),
  });

  if (q.isLoading) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Loading…</section>
      </SiteShell>
    );
  }

  if (!q.data) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-serif text-3xl font-bold text-ink">Page not found</h1>
          <p className="mt-3 text-muted-foreground">This CMS page is unpublished or missing.</p>
          <Link to="/" className="mt-6 inline-block text-navy underline hover:text-crimson">
            Return home
          </Link>
        </section>
      </SiteShell>
    );
  }

  const page = q.data;
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="transition-colors hover:text-crimson">
            Home
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-foreground" aria-current="page">
            {page.title}
          </span>
        </nav>
        <h1 className="font-serif text-4xl font-bold text-ink md:text-5xl">{page.title}</h1>
        {page.seo_description ? (
          <p className="mt-4 text-lg text-muted-foreground">{page.seo_description}</p>
        ) : null}
        <ArticleBody body={page.body} />
      </article>
    </SiteShell>
  );
}
