import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure passthrough layout: /video renders VideoIndexRoute, /video/$slug renders
// VideoSlugRoute. Each child owns its own SiteShell wrapper, so this layout must
// not render any chrome of its own — only the Outlet, otherwise nested child
// routes (e.g. /video/$slug) would never mount.
export const Route = createFileRoute("/video")({
  component: () => <Outlet />,
});
