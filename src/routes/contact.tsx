import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, placeholderContent } from "@/components/info-page";

const content = placeholderContent("contact");

export const Route = createFileRoute("/contact")({
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
