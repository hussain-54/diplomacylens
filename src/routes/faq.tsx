import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, placeholderContent } from "@/components/info-page";

const content = placeholderContent("faq");

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `${content.title} — Diplomacy Lens` },
      { name: "description", content: content.description },
      { property: "og:title", content: content.title },
      { property: "og:description", content: content.description },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: () => <InfoPage content={content} />,
});
