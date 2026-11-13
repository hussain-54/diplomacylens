/** Canonical public fallback when an article has no linked publisher. */
export const DEFAULT_PUBLISHER_NAME = "Admin";

export type PublisherProfile = {
  name?: string | null;
  byline_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

type AuthorJoin = PublisherProfile | PublisherProfile[] | null | undefined;

function unwrapAuthor(author: AuthorJoin): PublisherProfile | null {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
}

/** Prefer byline, then display name. Never invent a person's name. */
export function displayNameFromProfile(
  profile: PublisherProfile | null | undefined,
  fallback = DEFAULT_PUBLISHER_NAME,
): string {
  const byline = profile?.byline_name?.trim();
  if (byline) return byline;
  const name = profile?.name?.trim();
  if (name) return name;
  return fallback;
}

/**
 * Resolve the byline shown on public pages and SEO.
 * Priority: live profile byline/name → stored publisher_name snapshot → Admin.
 * author_id keeps the publisher linked even when display names change.
 */
export function resolvePublisherName(input: {
  publisher_name?: string | null;
  author?: AuthorJoin;
  fallback?: string;
}): string {
  const fromProfile = displayNameFromProfile(unwrapAuthor(input.author), "");
  if (fromProfile) return fromProfile;
  const snapshot = input.publisher_name?.trim();
  if (snapshot) return snapshot;
  return input.fallback ?? DEFAULT_PUBLISHER_NAME;
}

export function resolvePublisherAvatar(author: AuthorJoin): string | null {
  return unwrapAuthor(author)?.avatar_url?.trim() || null;
}

export function resolvePublisherBio(author: AuthorJoin): string | null {
  return unwrapAuthor(author)?.bio?.trim() || null;
}

/** Supabase select fragment for publisher profile joins. */
export const PUBLISHER_PROFILE_SELECT = "name,byline_name,avatar_url,bio";
export const PUBLISHER_PROFILE_SELECT_MIN = "name,byline_name";
