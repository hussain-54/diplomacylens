/** Central registry for footer navigation and placeholder page metadata. */

export type FooterSectionId =
  | "explore"
  | "company"
  | "editorial"
  | "legal"
  | "transparency"
  | "community"
  | "resources"
  | "business"
  | "support";

export type FooterPageDef = {
  /** URL path without leading slash, or absolute/external path starting with / or http */
  slug: string;
  title: string;
  section: FooterSectionId;
  sectionLabel: string;
  description: string;
  /** When false, do not generate a placeholder route (page already exists with real content). */
  placeholder?: boolean;
  /** Footer label override (defaults to title). */
  footerLabel?: string;
};

const sectionLabel = (id: FooterSectionId): string =>
  (
    ({
      explore: "Explore",
      company: "Company",
      editorial: "Editorial",
      legal: "Legal",
      transparency: "Transparency",
      community: "Community",
      resources: "Resources",
      business: "Business",
      support: "Support",
    }) as const
  )[id];

function page(
  slug: string,
  title: string,
  section: FooterSectionId,
  description: string,
  opts?: { placeholder?: boolean; footerLabel?: string },
): FooterPageDef {
  return {
    slug,
    title,
    section,
    sectionLabel: sectionLabel(section),
    description,
    placeholder: opts?.placeholder ?? true,
    footerLabel: opts?.footerLabel,
  };
}

/** All footer destinations — placeholders and live pages. */
export const FOOTER_PAGES: FooterPageDef[] = [
  // Explore (preserve existing browse links)
  page("", "Home", "explore", "Diplomacy Lens homepage.", {
    placeholder: false,
    footerLabel: "Home",
  }),
  page("latest", "Latest News", "explore", "The latest reporting from Diplomacy Lens.", {
    placeholder: false,
  }),
  page("breaking", "Breaking News", "explore", "Live breaking news and diplomatic alerts.", {
    placeholder: false,
  }),
  page("section/world", "World", "explore", "World affairs coverage.", { placeholder: false }),
  page("section/politics", "Politics", "explore", "Politics and policy coverage.", {
    placeholder: false,
  }),
  page("section/business", "Business", "explore", "Business and markets coverage.", {
    placeholder: false,
  }),
  page("section/opinion", "Opinion", "explore", "Opinion and analysis.", { placeholder: false }),
  page("video", "Videos", "explore", "Video reporting from Diplomacy Lens.", {
    placeholder: false,
  }),
  page("infographics", "Infographics", "explore", "Visual explainers and data journalism.", {
    placeholder: false,
  }),

  // Company
  page(
    "about",
    "About Diplomacy Lens",
    "company",
    "Learn who we are and how Diplomacy Lens covers global affairs.",
    { placeholder: false, footerLabel: "About Diplomacy Lens" },
  ),
  page(
    "mission",
    "Our Mission",
    "company",
    "The mission guiding Diplomacy Lens journalism and public service.",
  ),
  page(
    "vision",
    "Our Vision",
    "company",
    "Our long-term vision for independent international reporting.",
  ),
  page("team", "Our Team", "company", "Correspondents, editors, and producers across our desks."),
  page("leadership", "Leadership", "company", "Editorial and organizational leadership."),
  page("careers", "Careers", "company", "Open roles and opportunities at Diplomacy Lens."),
  page("contact", "Contact Us", "company", "Reach the Diplomacy Lens teams."),
  page("newsroom", "Newsroom", "company", "How our newsroom operates and publishes."),
  page("press-center", "Press Center", "company", "Press materials and media contacts."),
  page("partnerships", "Partnerships", "company", "Institutional and content partnerships."),

  // Editorial
  page(
    "editorial-policy",
    "Editorial Policy",
    "editorial",
    "Principles guiding Diplomacy Lens reporting and analysis.",
  ),
  page(
    "ethics",
    "Ethics & Standards",
    "editorial",
    "Ethical commitments and professional standards for our journalists.",
  ),
  page(
    "editorial-standards",
    "Editorial Standards",
    "editorial",
    "Our bar for accuracy, fairness, and independence.",
  ),
  page(
    "corrections",
    "Corrections Policy",
    "editorial",
    "How we correct the record when we get something wrong.",
  ),
  page(
    "fact-checking",
    "Fact-Checking Policy",
    "editorial",
    "How Diplomacy Lens verifies claims before and after publication.",
  ),
  page(
    "ai-usage",
    "AI Usage Policy",
    "editorial",
    "How artificial intelligence may support — never replace — our journalism.",
  ),
  page(
    "sources-methodology",
    "Sources & Methodology",
    "editorial",
    "How we source, attribute, and document our reporting.",
  ),
  page(
    "opinion-policy",
    "Opinion Policy",
    "editorial",
    "How opinion and analysis are labeled and edited.",
  ),
  page(
    "guest-contributor-guidelines",
    "Guest Contributor Guidelines",
    "editorial",
    "Standards for guest essays and outside contributors.",
  ),

  // Legal
  page(
    "terms",
    "Terms of Use",
    "legal",
    "Terms governing use of Diplomacy Lens websites and services.",
  ),
  page(
    "privacy",
    "Privacy Policy",
    "legal",
    "How Diplomacy Lens collects, uses, and protects reader information.",
  ),
  page(
    "cookies",
    "Cookie Policy",
    "legal",
    "How cookies and similar technologies support the Diplomacy Lens experience.",
  ),
  page(
    "copyright",
    "Copyright Policy",
    "legal",
    "Copyright ownership and permissions for Diplomacy Lens content.",
  ),
  page(
    "licensing",
    "Licensing & Syndication",
    "legal",
    "Licensing and syndication options for republishing our journalism.",
  ),
  page(
    "disclaimer",
    "Disclaimer",
    "legal",
    "Important disclaimers regarding Diplomacy Lens content and services.",
  ),
  page(
    "accessibility",
    "Accessibility Statement",
    "legal",
    "Our commitment to an accessible reading experience.",
  ),

  // Transparency
  page(
    "ownership",
    "Ownership & Funding",
    "transparency",
    "Who owns Diplomacy Lens and how the organization is funded.",
  ),
  page(
    "independence",
    "Independence Statement",
    "transparency",
    "Our commitment to editorial independence.",
  ),
  page(
    "diversity",
    "Diversity & Inclusion",
    "transparency",
    "How we approach diversity and inclusion in our newsroom and coverage.",
  ),
  page(
    "code-of-conduct",
    "Code of Conduct",
    "transparency",
    "Expected conduct for staff, contributors, and community spaces.",
  ),
  page(
    "conflict-of-interest",
    "Conflict of Interest Policy",
    "transparency",
    "How conflicts of interest are disclosed and managed.",
  ),

  // Community
  page(
    "community-guidelines",
    "Community Guidelines",
    "community",
    "Rules for comments, forums, and reader participation.",
  ),
  page("submit-story", "Submit a Story", "community", "How to pitch or submit a story tip."),
  page(
    "submit-press-release",
    "Submit a Press Release",
    "community",
    "How organizations can share press releases with our desk.",
  ),
  page(
    "report-error",
    "Report an Error",
    "community",
    "Tell us if you spot an error in our coverage.",
  ),
  page("feedback", "Feedback", "community", "Share feedback about Diplomacy Lens."),
  page(
    "contact-editorial",
    "Contact Editorial Team",
    "community",
    "Reach editors directly with tips, questions, or concerns.",
  ),

  // Resources
  page("podcast", "Podcasts", "resources", "Listen to Diplomacy Lens podcasts.", {
    placeholder: false,
  }),
  page("epaper", "E-Paper", "resources", "Read the Diplomacy Lens e-paper editions.", {
    placeholder: false,
  }),
  page("newsletter", "Newsletters", "resources", "Subscribe to Diplomacy Lens briefings.", {
    placeholder: false,
    footerLabel: "Newsletters",
  }),
  page("api/rss", "RSS Feeds", "resources", "Subscribe to Diplomacy Lens via RSS.", {
    placeholder: false,
    footerLabel: "RSS Feeds",
  }),
  page("sitemap", "Sitemap", "resources", "Key destinations across Diplomacy Lens."),
  page("archive", "Archive", "resources", "Browse the Diplomacy Lens archive."),

  // Business
  page(
    "advertise",
    "Advertise With Us",
    "business",
    "Reach an international policy and diplomacy audience.",
  ),
  page("media-kit", "Media Kit", "business", "Audience and brand materials for partners."),
  page(
    "sponsorships",
    "Sponsorships",
    "business",
    "Sponsorship opportunities with Diplomacy Lens.",
  ),
  page(
    "brand-partnerships",
    "Brand Partnerships",
    "business",
    "Collaborative brand partnerships that respect editorial independence.",
  ),

  // Support
  page("help", "Help Center", "support", "Help and support for readers and members."),
  page(
    "faq",
    "Frequently Asked Questions (FAQs)",
    "support",
    "Answers to common questions from readers and members.",
    { footerLabel: "Frequently Asked Questions (FAQs)" },
  ),
  page(
    "account-support",
    "Account Support",
    "support",
    "Help with accounts, subscriptions, and sign-in.",
  ),
];

export const FOOTER_SECTION_ORDER: FooterSectionId[] = [
  "explore",
  "company",
  "editorial",
  "legal",
  "transparency",
  "community",
  "resources",
  "business",
  "support",
];

export const FOOTER_SECTION_LABELS: Record<FooterSectionId, string> = {
  explore: "Explore",
  company: "Company",
  editorial: "Editorial",
  legal: "Legal",
  transparency: "Transparency",
  community: "Community",
  resources: "Resources",
  business: "Business",
  support: "Support",
};

export function getFooterLinksBySection() {
  return FOOTER_SECTION_ORDER.map((id) => ({
    id,
    label: FOOTER_SECTION_LABELS[id],
    links: FOOTER_PAGES.filter((p) => p.section === id).map((p) => ({
      href: p.slug === "" ? "/" : p.slug.startsWith("http") ? p.slug : `/${p.slug}`,
      label: p.footerLabel ?? p.title,
    })),
  }));
}

export function getPlaceholderPages() {
  return FOOTER_PAGES.filter((p) => p.placeholder !== false);
}

export function getFooterPageBySlug(slug: string) {
  return FOOTER_PAGES.find((p) => p.slug === slug);
}
