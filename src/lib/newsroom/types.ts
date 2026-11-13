export type StoryStatus = "draft" | "active" | "paused" | "archived";
export type StoryContentType =
  "article" | "video" | "podcast" | "infographic" | "epaper" | "breaking_news";

export type StoryRow = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  summary: string | null;
  hero_image_url: string | null;
  category_id: string | null;
  primary_author_id: string | null;
  status: StoryStatus;
  featured: boolean;
  start_date: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type StoryItemRow = {
  id: string;
  story_id: string;
  content_type: StoryContentType;
  content_id: string;
  position: number;
  label: string | null;
  created_at: string;
};

export type TopicStatus = "active" | "inactive" | "archived";

export type TopicRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  accent_color: string | null;
  category_id: string | null;
  parent_topic_id: string | null;
  status: TopicStatus;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPlatform =
  "facebook" | "x" | "linkedin" | "instagram" | "youtube" | "telegram" | "whatsapp" | "other";
export type SocialPostStatus =
  "draft" | "pending_approval" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";

export type SocialPostRow = {
  id: string;
  source_type: string | null;
  source_id: string | null;
  campaign_id: string | null;
  template_id: string | null;
  title: string | null;
  status: SocialPostStatus;
  created_at: string;
  updated_at: string;
};

export type SocialPostChannelRow = {
  id: string;
  social_post_id: string;
  channel_id: string | null;
  platform: SocialPlatform;
  content: string | null;
  hashtags: string | null;
  cta: string | null;
  link: string | null;
  media_url: string | null;
  status: SocialPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  timezone: string;
  external_post_id: string | null;
  error_message: string | null;
};

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string; charLimit?: number }[] = [
  { id: "x", label: "X", charLimit: 280 },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn", charLimit: 3000 },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "telegram", label: "Telegram" },
];
