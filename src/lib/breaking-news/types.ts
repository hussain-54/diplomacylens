export type BreakingPriority = "critical" | "high" | "normal";
export type BreakingStatus = "draft" | "scheduled" | "published" | "expired" | "archived";
export type BreakingType = "simple" | "article" | "media";

export type BreakingNewsRow = {
  id: string;
  headline: string;
  description: string | null;
  category_id: string | null;
  article_id: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "audio" | null;
  breaking_type: BreakingType;
  priority: BreakingPriority;
  priority_rank: number;
  status: BreakingStatus;
  sort_order: number;
  starts_at: string | null;
  expires_at: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  show_on_ticker: boolean;
  show_on_homepage_alert: boolean;
  notification_enabled: boolean;
  notification_sent: boolean;
  notification_sent_at: string | null;
  notification_id: string | null;
  view_count: number;
  click_count: number;
  created_at: string;
  updated_at: string;
};

export type BreakingNewsSettings = {
  id: number;
  module_enabled: boolean;
  default_expiration_hours: number;
  default_priority: BreakingPriority;
  max_active_items: number;
  ticker_enabled: boolean;
  ticker_position: string;
  ticker_style: string;
  ticker_max_items: number;
  ticker_speed: string;
  ticker_show_timestamp: boolean;
  ticker_show_category: boolean;
  ticker_show_icon: boolean;
  ticker_source: string;
  homepage_alert_enabled: boolean;
  homepage_alert_max: number;
  homepage_alert_duration_seconds: number;
  homepage_alert_auto_dismiss: boolean;
  homepage_alert_manual_dismiss: boolean;
  homepage_alert_show_desktop: boolean;
  homepage_alert_show_mobile: boolean;
  push_enabled: boolean;
  push_default_on_publish: boolean;
  realtime_enabled: boolean;
  updated_at: string;
};

export const DEFAULT_BREAKING_SETTINGS: BreakingNewsSettings = {
  id: 1,
  module_enabled: true,
  default_expiration_hours: 24,
  default_priority: "normal",
  max_active_items: 10,
  ticker_enabled: true,
  ticker_position: "top",
  ticker_style: "scroll",
  ticker_max_items: 8,
  ticker_speed: "medium",
  ticker_show_timestamp: false,
  ticker_show_category: true,
  ticker_show_icon: true,
  ticker_source: "automatic",
  homepage_alert_enabled: true,
  homepage_alert_max: 1,
  homepage_alert_duration_seconds: 0,
  homepage_alert_auto_dismiss: false,
  homepage_alert_manual_dismiss: true,
  homepage_alert_show_desktop: true,
  homepage_alert_show_mobile: true,
  push_enabled: false,
  push_default_on_publish: false,
  realtime_enabled: true,
  updated_at: new Date().toISOString(),
};

export function priorityRank(priority: BreakingPriority): number {
  if (priority === "critical") return 1;
  if (priority === "high") return 2;
  return 3;
}
