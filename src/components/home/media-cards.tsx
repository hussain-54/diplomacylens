import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileText, Play } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type EpaperEdition = {
  id: string;
  title: string;
  slug?: string | null;
  issue_number?: string | null;
  cover_image_url?: string | null;
  description?: string | null;
  pdf_url?: string | null;
  read_url?: string | null;
  published_at?: string | null;
};

export type PodcastEpisode = {
  id: string;
  title: string;
  slug?: string | null;
  host?: string | null;
  artwork_url?: string | null;
  audio_url?: string | null;
  external_url?: string | null;
  category?: string | null;
  duration?: string | null;
  published_at?: string | null;
};

export type InfographicItem = {
  id: string;
  title: string;
  slug?: string | null;
  category?: string | null;
  cover_image_url?: string | null;
  source_url?: string | null;
  published_at?: string | null;
};

export type HomeVideo = {
  id: string;
  title: string;
  slug?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
  duration?: string | null;
  published_at?: string | null;
};

function MediaLink({
  href,
  fallbackTo,
  className,
  children,
}: {
  href: string;
  fallbackTo: "/epaper" | "/video" | "/podcast" | "/infographics";
  className?: string;
  children: ReactNode;
}) {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={fallbackTo} className={className}>
      {children}
    </Link>
  );
}

export function EpaperCard({ edition }: { edition: EpaperEdition }) {
  const body = (
    <div className="overflow-hidden border border-border bg-background shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {edition.cover_image_url ? (
          <img
            src={edition.cover_image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <span className="font-serif text-sm font-semibold text-ink">{edition.title}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        {edition.issue_number ? (
          <div className="eyebrow text-crimson">Issue {edition.issue_number}</div>
        ) : null}
        <h3 className="font-serif text-lg text-ink transition-colors group-hover:text-crimson">
          {edition.title}
        </h3>
        {edition.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{edition.description}</p>
        ) : null}
        <div className="text-xs text-muted-foreground">{timeAgo(edition.published_at)}</div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="rounded-sm bg-navy px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-navy-foreground">
            Read edition
          </span>
          {edition.pdf_url ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <FileText className="h-3 w-3" /> PDF
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (edition.slug) {
    return (
      <Link to="/epaper/$slug" params={{ slug: edition.slug }} className="group block h-full">
        {body}
      </Link>
    );
  }

  const href = edition.read_url || edition.pdf_url || "/epaper";
  return (
    <MediaLink href={href} fallbackTo="/epaper" className="group block h-full">
      {body}
    </MediaLink>
  );
}

export function VideoCard({ video }: { video: HomeVideo }) {
  const body = (
    <div className="overflow-hidden transition-all duration-300 group-hover:-translate-y-1">
      <div className="relative aspect-video overflow-hidden bg-navy">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-crimson text-crimson-foreground shadow-lg transition-transform duration-300 group-hover:scale-110">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </div>
        {video.duration ? (
          <span className="absolute bottom-2 right-2 rounded-sm bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {video.duration}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        {video.category ? <div className="eyebrow text-crimson">{video.category}</div> : null}
        <h3 className="mt-1 font-serif text-base text-ink transition-colors group-hover:text-crimson">
          {video.title}
        </h3>
        <div className="mt-1 text-xs text-muted-foreground">{timeAgo(video.published_at)}</div>
      </div>
    </div>
  );

  if (video.slug) {
    return (
      <Link to="/video/$slug" params={{ slug: video.slug }} className="group block h-full">
        {body}
      </Link>
    );
  }

  const href = video.video_url || "/video";
  return (
    <MediaLink href={href} fallbackTo="/video" className="group block h-full">
      {body}
    </MediaLink>
  );
}

export function PodcastCard({ episode }: { episode: PodcastEpisode }) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden border border-border bg-background p-3",
        "transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg",
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-sm bg-muted">
        {episode.artwork_url ? (
          <img
            src={episode.artwork_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-navy text-navy-foreground">
            <Play className="h-8 w-8" />
          </div>
        )}
        <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-crimson text-crimson-foreground shadow transition-transform group-hover:scale-110">
          <Play className="h-4 w-4 fill-current" />
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        {episode.category ? <div className="eyebrow text-crimson">{episode.category}</div> : null}
        <h3 className="mt-1 font-serif text-lg text-ink transition-colors group-hover:text-crimson">
          {episode.title}
        </h3>
        {episode.host ? (
          <p className="mt-1 text-sm text-muted-foreground">Hosted by {episode.host}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-x-2 pt-2 text-xs text-muted-foreground">
          <time>{timeAgo(episode.published_at)}</time>
          {episode.duration ? (
            <>
              <span aria-hidden>·</span>
              <span>{episode.duration}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (episode.slug) {
    return (
      <Link to="/podcast/$slug" params={{ slug: episode.slug }} className="group block h-full">
        {body}
      </Link>
    );
  }

  const href = episode.external_url || episode.audio_url || "/podcast";
  return (
    <MediaLink href={href} fallbackTo="/podcast" className="group block h-full">
      {body}
    </MediaLink>
  );
}

export function InfographicCard({ item }: { item: InfographicItem }) {
  const body = (
    <div className="overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
      <div className="aspect-[3/4] overflow-hidden border border-border bg-muted">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : null}
      </div>
      <div className="mt-3">
        {item.category ? <div className="eyebrow text-crimson">{item.category}</div> : null}
        <h3 className="mt-1 font-serif text-base text-ink transition-colors group-hover:text-crimson">
          {item.title}
        </h3>
        <div className="mt-1 text-xs text-muted-foreground">{timeAgo(item.published_at)}</div>
      </div>
    </div>
  );

  if (item.slug) {
    return (
      <Link to="/infographics/$slug" params={{ slug: item.slug }} className="group block h-full">
        {body}
      </Link>
    );
  }

  const href = item.source_url || "/infographics";
  return (
    <MediaLink href={href} fallbackTo="/infographics" className="group block h-full">
      {body}
    </MediaLink>
  );
}
