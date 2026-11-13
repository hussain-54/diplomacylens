import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { HomepageRenderer } from "@/components/homepage/HomepageRenderer";
import { getHomeData, getSections } from "@/lib/content.functions";
import { getPublicFooter } from "@/lib/cms-site/footer";
import { DEFAULT_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/seo";

const publicFooterQO = queryOptions({
  queryKey: ["public-footer"],
  queryFn: getPublicFooter,
  staleTime: 60_000,
});

const sectionsQO = queryOptions({
  queryKey: ["sections"],
  queryFn: () => getSections(),
  staleTime: 60_000,
});

const originalHomeQO = queryOptions({
  queryKey: ["home-original"],
  queryFn: () => getHomeData(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const { queryClient } = context;
    await Promise.all([
      queryClient.ensureQueryData(originalHomeQO),
      queryClient.ensureQueryData(publicFooterQO),
      queryClient.ensureQueryData(sectionsQO),
    ]);
    return { legacy: true as const };
  },
  staleTime: 30_000,
  head: () => ({
    meta: [
      { title: `${SITE_NAME} — Global diplomacy and international affairs` },
      { name: "description", content: DEFAULT_DESCRIPTION },
      { name: "robots", content: "index,follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: SITE_NAME },
      { property: "og:description", content: DEFAULT_DESCRIPTION },
      { property: "og:url", content: siteUrl() },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl() }],
  }),
  component: Home,
});

function Home() {
  return <HomepageRenderer mode="live" />;
}
