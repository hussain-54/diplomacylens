import { Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { getFooterPageBySlug, type FooterPageDef } from "@/lib/footer-pages";

export type InfoPageContent = {
  title: string;
  eyebrow: string;
  description: string;
  /** @deprecated Prefer placeholder coming-soon layout; kept for compatibility. */
  body?: string[];
  section?: string;
  href?: string;
};

export function toInfoContent(page: FooterPageDef): InfoPageContent {
  return {
    title: page.title,
    eyebrow: page.sectionLabel,
    description: page.description,
    section: page.sectionLabel,
    href: `/${page.slug}`,
  };
}

export function InfoPage({ content }: { content: InfoPageContent }) {
  const section = content.section ?? content.eyebrow;

  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="transition-colors hover:text-crimson">
            Home
          </Link>
          <span aria-hidden>/</span>
          <span>{section}</span>
          <span aria-hidden>/</span>
          <span className="font-medium text-foreground" aria-current="page">
            {content.title}
          </span>
        </nav>

        <p className="eyebrow text-crimson">{section}</p>
        <h1 className="mt-2 font-serif text-4xl font-bold text-ink md:text-5xl">{content.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{content.description}</p>

        <div
          className="mt-10 rounded-sm border border-border bg-muted/40 px-6 py-10 text-center"
          role="status"
        >
          <p className="font-serif text-2xl text-ink">Content Coming Soon</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is reserved for future Diplomacy Lens content.
          </p>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Return to{" "}
          <Link to="/" className="text-navy underline transition-colors hover:text-crimson">
            the homepage
          </Link>
          .
        </p>
      </section>
    </SiteShell>
  );
}

/** Resolve placeholder content by URL slug (without leading slash). */
export function placeholderContent(slug: string): InfoPageContent {
  const page = getFooterPageBySlug(slug);
  if (!page) {
    throw new Error(`Missing footer page definition for slug: ${slug}`);
  }
  return toInfoContent(page);
}

/** @deprecated Use footer-pages registry; retained for any lingering imports. */
export const INFO_PAGES: Record<string, InfoPageContent> = Object.fromEntries(
  [
    "privacy",
    "terms",
    "cookies",
    "corrections",
    "editorial-policy",
    "editorial-standards",
    "ethics",
    "leadership",
    "team",
    "careers",
    "advertise",
    "contact",
    "faq",
    "accessibility",
    "sitemap",
  ].map((slug) => {
    const page = getFooterPageBySlug(slug);
    return [slug, page ? toInfoContent(page) : { title: slug, eyebrow: "Info", description: "" }];
  }),
);
