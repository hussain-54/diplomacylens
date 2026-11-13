import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, placeholderContent } from "@/components/info-page";

const content = placeholderContent("conflict-of-interest");

export const Route = createFileRoute("/conflict-of-interest")({
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
