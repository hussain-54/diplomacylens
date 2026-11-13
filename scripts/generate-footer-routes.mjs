import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.join(__dirname, "../src/routes");

/** Placeholder route slugs (must match src/lib/footer-pages.ts). */
const PLACEHOLDER_SLUGS = [
  "mission",
  "vision",
  "team",
  "leadership",
  "careers",
  "contact",
  "newsroom",
  "press-center",
  "partnerships",
  "editorial-policy",
  "ethics",
  "editorial-standards",
  "corrections",
  "fact-checking",
  "ai-usage",
  "sources-methodology",
  "opinion-policy",
  "guest-contributor-guidelines",
  "terms",
  "privacy",
  "cookies",
  "copyright",
  "licensing",
  "disclaimer",
  "accessibility",
  "ownership",
  "independence",
  "diversity",
  "code-of-conduct",
  "conflict-of-interest",
  "community-guidelines",
  "submit-story",
  "submit-press-release",
  "report-error",
  "feedback",
  "contact-editorial",
  "sitemap",
  "archive",
  "advertise",
  "media-kit",
  "sponsorships",
  "brand-partnerships",
  "help",
  "faq",
  "account-support",
];

function template(slug) {
  const routePath = `/${slug}`;
  return `import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, placeholderContent } from "@/components/info-page";

const content = placeholderContent("${slug}");

export const Route = createFileRoute("${routePath}")({
  head: () => ({
    meta: [
      { title: \`\${content.title} — Diplomacy Lens\` },
      { name: "description", content: content.description },
      { property: "og:title", content: content.title },
      { property: "og:description", content: content.description },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: () => <InfoPage content={content} />,
});
`;
}

let created = 0;
let updated = 0;

for (const slug of PLACEHOLDER_SLUGS) {
  const file = path.join(routesDir, `${slug}.tsx`);
  const exists = fs.existsSync(file);
  fs.writeFileSync(file, template(slug), "utf8");
  if (exists) updated += 1;
  else created += 1;
}

console.log(JSON.stringify({ created, updated, total: PLACEHOLDER_SLUGS.length }));
