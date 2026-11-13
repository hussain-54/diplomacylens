/**
 * Locked Diplomacy Lens CMS sidebar architecture.
 * Section names, order, and module names are FINAL — do not rename.
 * Sub-items map to existing routes where possible; new routes only when missing.
 */
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  DatabaseBackup,
  Eye,
  FileText,
  FlaskConical,
  FolderTree,
  Gauge,
  GitBranch,
  Globe,
  Home,
  ImagePlus,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  Link2,
  List,
  Megaphone,
  MessageSquareText,
  Mic,
  Newspaper,
  PanelBottom,
  PenLine,
  Puzzle,
  Search,
  Settings,
  Share2,
  Shield,
  Users,
  Video,
  Waypoints,
  Workflow,
  Zap,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type LockedNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
  /** Optional search params for deep-links (e.g. comments tabs). */
  search?: Record<string, string>;
};

/** EDITORIAL → Workflow (reuses article queues) */
export const WORKFLOW_NAV: LockedNavItem[] = [
  {
    to: "/admin/workflow",
    label: "Workflow Dashboard",
    icon: LayoutDashboard,
    permission: "articles:view",
    exact: true,
  },
  { to: "/admin/articles/drafts", label: "Drafts", icon: FileText, permission: "articles:view" },
  {
    to: "/admin/articles/review",
    label: "In Review",
    icon: ClipboardCheck,
    permission: "articles:view",
  },
  {
    to: "/admin/workflow/revision-required",
    label: "Revision Required",
    icon: GitBranch,
    permission: "articles:review",
  },
  {
    to: "/admin/articles/approved",
    label: "Approved",
    icon: ClipboardCheck,
    permission: "articles:review",
  },
  {
    to: "/admin/articles/scheduled",
    label: "Scheduled",
    icon: CalendarDays,
    permission: "articles:view",
  },
  { to: "/admin/articles/published", label: "Published", icon: Globe, permission: "articles:view" },
  {
    to: "/admin/workflow/rejected",
    label: "Rejected",
    icon: Archive,
    permission: "articles:review",
  },
  {
    to: "/admin/workflow/rules",
    label: "Workflow Rules",
    icon: Settings,
    permission: "articles:review",
  },
  {
    to: "/admin/articles/review",
    label: "Approval Queue",
    icon: List,
    permission: "articles:review",
  },
];

/** EDITORIAL → Newsroom Operations */
export const NEWSROOM_OPS_NAV: LockedNavItem[] = [
  {
    to: "/admin/newsroom-ops",
    label: "Newsroom Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
    exact: true,
  },
  {
    to: "/admin/newsroom-ops/assignments",
    label: "Assignment Desk",
    icon: Briefcase,
    permission: "articles:view",
  },
  { to: "/admin/stories/all", label: "Story Queue", icon: Waypoints, permission: "stories:view" },
  {
    to: "/admin/breaking-news",
    label: "Breaking News Desk",
    icon: Megaphone,
    permission: "breaking_news:view",
  },
  {
    to: "/admin/breaking-news/active",
    label: "Live Coverage",
    icon: Megaphone,
    permission: "breaking_news:view",
  },
  {
    to: "/admin/newsroom-ops/reporter-assignments",
    label: "Reporter Assignments",
    icon: Users,
    permission: "staff:manage",
  },
  {
    to: "/admin/newsroom-ops/editor-desk",
    label: "Editor Desk",
    icon: PenLine,
    permission: "articles:review",
  },
  {
    to: "/admin/stories/coverage",
    label: "Priority Stories",
    icon: Waypoints,
    permission: "stories:view",
  },
  {
    to: "/admin/breaking-news/push",
    label: "Editorial Alerts",
    icon: Bell,
    permission: "breaking_news:publish",
  },
];

/** EDITORIAL → News Tips */
export const NEWS_TIPS_NAV: LockedNavItem[] = [
  {
    to: "/admin/tips",
    label: "Tips Dashboard",
    icon: LayoutDashboard,
    permission: "articles:view",
    exact: true,
  },
  { to: "/admin/tips/new", label: "New Tips", icon: Lightbulb, permission: "articles:view" },
  {
    to: "/admin/tips/unreviewed",
    label: "Unreviewed",
    icon: ClipboardCheck,
    permission: "articles:view",
  },
  {
    to: "/admin/tips/investigation",
    label: "Under Investigation",
    icon: Search,
    permission: "articles:review",
  },
  {
    to: "/admin/tips/verified",
    label: "Verified",
    icon: ClipboardCheck,
    permission: "articles:review",
  },
  { to: "/admin/tips/rejected", label: "Rejected", icon: Archive, permission: "articles:review" },
  {
    to: "/admin/tips/anonymous",
    label: "Anonymous Tips",
    icon: Users,
    permission: "articles:review",
  },
  { to: "/admin/tips/sources", label: "Tip Sources", icon: List, permission: "articles:review" },
];

/** EDITORIAL → Editorial Calendar */
export const EDITORIAL_CALENDAR_NAV: LockedNavItem[] = [
  {
    to: "/admin/editorial-calendar",
    label: "Calendar",
    icon: CalendarDays,
    permission: "articles:view",
    exact: true,
  },
  {
    to: "/admin/editorial-calendar/day",
    label: "Daily View",
    icon: CalendarDays,
    permission: "articles:view",
  },
  {
    to: "/admin/editorial-calendar/week",
    label: "Weekly View",
    icon: CalendarDays,
    permission: "articles:view",
  },
  {
    to: "/admin/editorial-calendar/month",
    label: "Monthly View",
    icon: CalendarDays,
    permission: "articles:view",
  },
  {
    to: "/admin/articles/scheduled",
    label: "Scheduled Stories",
    icon: CalendarDays,
    permission: "articles:view",
  },
  { to: "/admin/social/campaigns", label: "Campaigns", icon: Share2, permission: "social:view" },
  {
    to: "/admin/editorial-calendar/events",
    label: "Events",
    icon: CalendarDays,
    permission: "articles:view",
  },
  {
    to: "/admin/editorial-calendar/deadlines",
    label: "Editorial Deadlines",
    icon: CalendarDays,
    permission: "articles:review",
  },
];

/** CONTENT → Articles / Newsroom children */
export const ARTICLES_LOCKED_NAV: LockedNavItem[] = [
  { to: "/admin/articles/all", label: "All Articles", icon: FileText, permission: "articles:view" },
  { to: "/admin/articles/drafts", label: "Drafts", icon: FileText, permission: "articles:view" },
  {
    to: "/admin/articles/review",
    label: "Pending Review",
    icon: ClipboardCheck,
    permission: "articles:view",
  },
  {
    to: "/admin/articles/scheduled",
    label: "Scheduled",
    icon: CalendarDays,
    permission: "articles:view",
  },
  { to: "/admin/articles/published", label: "Published", icon: Globe, permission: "articles:view" },
  {
    to: "/admin/breaking-news",
    label: "Breaking News",
    icon: Megaphone,
    permission: "breaking_news:view",
  },
  {
    to: "/admin/articles/featured",
    label: "Featured",
    icon: FileText,
    permission: "articles:view",
  },
  { to: "/admin/articles/updates", label: "Updates", icon: FileText, permission: "articles:view" },
  { to: "/admin/articles/archived", label: "Archived", icon: Archive, permission: "articles:view" },
  {
    to: "/admin/articles/revisions",
    label: "Revisions",
    icon: GitBranch,
    permission: "articles:view",
  },
];

/** CONTENT → Story / Topic Management */
export const STORY_TOPIC_LOCKED_NAV: LockedNavItem[] = [
  { to: "/admin/stories/all", label: "Stories", icon: List, permission: "stories:view" },
  { to: "/admin/topics", label: "Topics", icon: Waypoints, permission: "topics:view", exact: true },
  {
    to: "/admin/stories/clusters",
    label: "Story Clusters",
    icon: Waypoints,
    permission: "stories:view",
  },
  {
    to: "/admin/stories/related",
    label: "Related Stories",
    icon: Link2,
    permission: "stories:view",
  },
  {
    to: "/admin/stories/timeline",
    label: "Story Timeline",
    icon: GitBranch,
    permission: "stories:view",
  },
  {
    to: "/admin/stories/follow-ups",
    label: "Follow-up Stories",
    icon: List,
    permission: "stories:view",
  },
  {
    to: "/admin/topics/trending",
    label: "Trending Topics",
    icon: Gauge,
    permission: "topics:view",
  },
  {
    to: "/admin/stories/analytics",
    label: "Topic Analytics",
    icon: BarChart3,
    permission: "topics:view",
  },
];

/** CONTENT → Social / Post Content */
export const SOCIAL_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/social",
    label: "Social Dashboard",
    icon: LayoutDashboard,
    permission: "social:view",
    exact: true,
  },
  { to: "/admin/social/create", label: "Create Post", icon: Share2, permission: "social:edit" },
  {
    to: "/admin/social/posts",
    label: "Draft Posts",
    icon: FileText,
    permission: "social:view",
    search: { status: "draft" },
  },
  {
    to: "/admin/social/queue",
    label: "Scheduled Posts",
    icon: CalendarDays,
    permission: "social:view",
  },
  {
    to: "/admin/social/posts",
    label: "Published Posts",
    icon: Globe,
    permission: "social:view",
    search: { status: "published" },
  },
  { to: "/admin/social/campaigns", label: "Campaigns", icon: Share2, permission: "social:view" },
  {
    to: "/admin/social/templates",
    label: "Social Templates",
    icon: LayoutTemplate,
    permission: "social:view",
  },
  {
    to: "/admin/social/analytics",
    label: "Social Analytics",
    icon: BarChart3,
    permission: "social:view",
  },
];

/** CONTENT → Comments */
export const COMMENTS_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/comments",
    label: "Moderation Dashboard",
    icon: LayoutDashboard,
    permission: "comments:moderate",
    exact: true,
  },
  {
    to: "/admin/comments",
    label: "All Comments",
    icon: MessageSquareText,
    permission: "comments:moderate",
    search: { tab: "approved" },
  },
  {
    to: "/admin/comments",
    label: "Pending",
    icon: ClipboardCheck,
    permission: "comments:moderate",
    search: { tab: "pending" },
  },
  {
    to: "/admin/comments",
    label: "Approved",
    icon: ClipboardCheck,
    permission: "comments:moderate",
    search: { tab: "approved" },
  },
  {
    to: "/admin/comments",
    label: "Reported",
    icon: Bell,
    permission: "comments:moderate",
    search: { tab: "reported" },
  },
  {
    to: "/admin/comments",
    label: "Spam",
    icon: Archive,
    permission: "comments:moderate",
    search: { tab: "spam" },
  },
  {
    to: "/admin/comments",
    label: "Blocked Users",
    icon: Users,
    permission: "comments:moderate",
    search: { tab: "blocked" },
  },
  {
    to: "/admin/comments",
    label: "Moderation Rules",
    icon: Settings,
    permission: "comments:moderate",
    search: { tab: "rules" },
  },
  {
    to: "/admin/comments",
    label: "Comment Analytics",
    icon: BarChart3,
    permission: "comments:moderate",
    search: { tab: "analytics" },
  },
];

/** MANAGEMENT → Categories & Tags */
export const TAXONOMY_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/categories",
    label: "Categories",
    icon: FolderTree,
    permission: "categories:manage",
    exact: true,
  },
  {
    to: "/admin/categories/subcategories",
    label: "Subcategories",
    icon: FolderTree,
    permission: "categories:manage",
  },
  { to: "/admin/tags", label: "Tags", icon: FileText, permission: "tags:manage" },
  { to: "/admin/topics", label: "Topics", icon: Waypoints, permission: "topics:view" },
  {
    to: "/admin/taxonomy/locations",
    label: "Locations",
    icon: Globe,
    permission: "categories:manage",
  },
  {
    to: "/admin/taxonomy/content-types",
    label: "Content Types",
    icon: List,
    permission: "categories:manage",
  },
  {
    to: "/admin/taxonomy/settings",
    label: "Taxonomy Settings",
    icon: Settings,
    permission: "categories:manage",
  },
];

/** MANAGEMENT → Authors */
export const AUTHORS_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/authors",
    label: "Authors",
    icon: PenLine,
    permission: "staff:manage",
    exact: true,
  },
  {
    to: "/admin/authors/contributors",
    label: "Contributors",
    icon: Users,
    permission: "staff:manage",
  },
  { to: "/admin/authors/guests", label: "Guest Authors", icon: Users, permission: "staff:manage" },
  {
    to: "/admin/authors/profiles",
    label: "Author Profiles",
    icon: Users,
    permission: "staff:manage",
  },
  {
    to: "/admin/authors/bylines",
    label: "Byline Management",
    icon: PenLine,
    permission: "staff:manage",
  },
  {
    to: "/admin/authors/analytics",
    label: "Author Analytics",
    icon: BarChart3,
    permission: "analytics:view",
  },
];

/** SITE → Homepage */
export const HOMEPAGE_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/homepage",
    label: "Homepage Builder",
    icon: LayoutTemplate,
    permission: "homepage:view",
    exact: true,
  },
  {
    to: "/admin/homepage",
    label: "Hero Section",
    icon: LayoutTemplate,
    permission: "homepage:edit",
    search: { focus: "hero" },
  },
  {
    to: "/admin/breaking-news/alert",
    label: "Breaking News",
    icon: Megaphone,
    permission: "breaking_news:view",
  },
  {
    to: "/admin/homepage",
    label: "Featured Stories",
    icon: FileText,
    permission: "homepage:edit",
    search: { focus: "featured" },
  },
  {
    to: "/admin/homepage",
    label: "Latest News",
    icon: Newspaper,
    permission: "homepage:edit",
    search: { focus: "latest" },
  },
  {
    to: "/admin/homepage",
    label: "Category Sections",
    icon: FolderTree,
    permission: "homepage:edit",
    search: { focus: "category" },
  },
  {
    to: "/admin/homepage",
    label: "Video Section",
    icon: Video,
    permission: "homepage:edit",
    search: { focus: "video" },
  },
  {
    to: "/admin/homepage",
    label: "Podcast Section",
    icon: Mic,
    permission: "homepage:edit",
    search: { focus: "podcast" },
  },
  {
    to: "/admin/homepage",
    label: "Trending Section",
    icon: Gauge,
    permission: "homepage:edit",
    search: { focus: "trending" },
  },
  {
    to: "/admin/homepage/preview",
    label: "Homepage Preview",
    icon: Globe,
    permission: "homepage:view",
  },
];

/** SITE → Smart Widgets */
export const SMART_WIDGETS_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/smart-widgets",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "smart_widgets:view",
    exact: true,
  },
  {
    to: "/admin/smart-widgets/library",
    label: "Widget Library",
    icon: FileText,
    permission: "smart_widgets:view",
  },
  {
    to: "/admin/smart-widgets/placements",
    label: "Placements & Slots",
    icon: Link2,
    permission: "smart_widgets:manage",
  },
  {
    to: "/admin/smart-widgets/slots",
    label: "Widget Slots",
    icon: LayoutTemplate,
    permission: "smart_widgets:view",
  },
  {
    to: "/admin/smart-widgets/rules",
    label: "Rules & Automation",
    icon: Workflow,
    permission: "smart_widgets:manage",
  },
  {
    to: "/admin/smart-widgets/alerts",
    label: "Alerts",
    icon: Bell,
    permission: "smart_widgets:manage",
  },
  {
    to: "/admin/smart-widgets/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "smart_widgets:analytics",
  },
  {
    to: "/admin/smart-widgets/settings",
    label: "Settings",
    icon: Settings,
    permission: "smart_widgets:configure",
  },
];

/** SITE → Pages */
export const PAGES_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/pages",
    label: "All Pages",
    icon: FileText,
    permission: "settings:manage",
    exact: true,
  },
  {
    to: "/admin/pages/create",
    label: "Create Page",
    icon: FileText,
    permission: "settings:manage",
  },
  { to: "/admin/pages/drafts", label: "Drafts", icon: FileText, permission: "settings:manage" },
  { to: "/admin/pages/published", label: "Published", icon: Globe, permission: "settings:manage" },
  {
    to: "/admin/pages/scheduled",
    label: "Scheduled",
    icon: CalendarDays,
    permission: "settings:manage",
  },
  {
    to: "/admin/pages/templates",
    label: "Page Templates",
    icon: LayoutTemplate,
    permission: "settings:manage",
  },
  {
    to: "/admin/pages/revisions",
    label: "Revisions",
    icon: GitBranch,
    permission: "settings:manage",
  },
];

/** SITE → Navigation */
export const MENUS_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/menus",
    label: "Main Menu",
    icon: Link2,
    permission: "settings:manage",
    exact: true,
  },
  { to: "/admin/menus/header", label: "Header Menu", icon: Link2, permission: "settings:manage" },
  {
    to: "/admin/menus/footer",
    label: "Footer Menu",
    icon: PanelBottom,
    permission: "settings:manage",
  },
  { to: "/admin/menus/mobile", label: "Mobile Menu", icon: Link2, permission: "settings:manage" },
  {
    to: "/admin/menus/category",
    label: "Category Menu",
    icon: FolderTree,
    permission: "settings:manage",
  },
  {
    to: "/admin/menus/mega",
    label: "Mega Menu",
    icon: LayoutTemplate,
    permission: "settings:manage",
  },
  {
    to: "/admin/menus/builder",
    label: "Menu Builder",
    icon: LayoutTemplate,
    permission: "settings:manage",
  },
];

/** SITE → Footer */
export const FOOTER_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/footer",
    label: "Footer Builder",
    icon: PanelBottom,
    permission: "settings:manage",
    exact: true,
  },
  {
    to: "/admin/footer/columns",
    label: "Footer Columns",
    icon: PanelBottom,
    permission: "settings:manage",
  },
  { to: "/admin/footer/links", label: "Footer Links", icon: Link2, permission: "settings:manage" },
  {
    to: "/admin/footer/social",
    label: "Social Links",
    icon: Share2,
    permission: "settings:manage",
  },
  {
    to: "/admin/footer/newsletter",
    label: "Newsletter Block",
    icon: Newspaper,
    permission: "settings:manage",
  },
  {
    to: "/admin/footer/copyright",
    label: "Copyright",
    icon: FileText,
    permission: "settings:manage",
  },
  {
    to: "/admin/footer/preview",
    label: "Footer Preview",
    icon: Globe,
    permission: "settings:manage",
  },
];

/** SYSTEM → Security */
export const SECURITY_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/security",
    label: "Security Dashboard",
    icon: Shield,
    permission: "settings:manage",
    exact: true,
  },
  {
    to: "/admin/security/authentication",
    label: "Authentication",
    icon: Shield,
    permission: "settings:manage",
  },
  { to: "/admin/security/mfa", label: "2FA / MFA", icon: Shield, permission: "settings:manage" },
  {
    to: "/admin/security/login-protection",
    label: "Login Protection",
    icon: Shield,
    permission: "settings:manage",
  },
  {
    to: "/admin/security/sessions",
    label: "Session Management",
    icon: Users,
    permission: "settings:manage",
  },
  {
    to: "/admin/security/devices",
    label: "Device Management",
    icon: Shield,
    permission: "settings:manage",
  },
  {
    to: "/admin/security/ip-rules",
    label: "IP / Access Rules",
    icon: Shield,
    permission: "settings:manage",
  },
  { to: "/admin/security/captcha", label: "CAPTCHA", icon: Shield, permission: "settings:manage" },
  { to: "/admin/security/api", label: "API Security", icon: Shield, permission: "settings:manage" },
  {
    to: "/admin/security/encryption",
    label: "Encryption",
    icon: Shield,
    permission: "settings:manage",
  },
  {
    to: "/admin/security/policies",
    label: "Security Policies",
    icon: Settings,
    permission: "settings:manage",
  },
  {
    to: "/admin/security/threats",
    label: "Threat Monitoring",
    icon: Bell,
    permission: "settings:manage",
  },
  {
    to: "/admin/security/events",
    label: "Security Events",
    icon: List,
    permission: "settings:manage",
  },
];

/** SYSTEM → Performance */
export const PERFORMANCE_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/performance",
    label: "Performance Dashboard",
    icon: Zap,
    permission: "settings:manage",
    exact: true,
  },
  {
    to: "/admin/performance/cache",
    label: "Cache Management",
    icon: DatabaseBackup,
    permission: "settings:manage",
  },
  { to: "/admin/performance/cdn", label: "CDN", icon: Globe, permission: "settings:manage" },
  {
    to: "/admin/performance/images",
    label: "Image Optimization",
    icon: ImagePlus,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/database",
    label: "Database Optimization",
    icon: DatabaseBackup,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/queues",
    label: "Queue Management",
    icon: List,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/cron",
    label: "Cron Jobs",
    icon: CalendarDays,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/jobs",
    label: "Background Jobs",
    icon: List,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/page-speed",
    label: "Page Speed",
    icon: Gauge,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/cwv",
    label: "Core Web Vitals",
    icon: Gauge,
    permission: "settings:manage",
  },
  {
    to: "/admin/performance/monitoring",
    label: "Performance Monitoring",
    icon: BarChart3,
    permission: "settings:manage",
  },
];

/** SYSTEM → Backup / DR */
export const BACKUP_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/backup",
    label: "Backup Dashboard",
    icon: DatabaseBackup,
    permission: "settings:manage",
    exact: true,
  },
  {
    to: "/admin/backup/database",
    label: "Database Backup",
    icon: DatabaseBackup,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/files",
    label: "Files Backup",
    icon: Archive,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/media",
    label: "Media Backup",
    icon: ImagePlus,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/config",
    label: "Configuration Backup",
    icon: Settings,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/automated",
    label: "Automated Backup",
    icon: CalendarDays,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/schedule",
    label: "Backup Schedule",
    icon: CalendarDays,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/retention",
    label: "Retention Policy",
    icon: Settings,
    permission: "settings:manage",
  },
  { to: "/admin/backup/cloud", label: "Cloud Backup", icon: Globe, permission: "settings:manage" },
  {
    to: "/admin/backup/encryption",
    label: "Backup Encryption",
    icon: Shield,
    permission: "settings:manage",
  },
  { to: "/admin/backup/restore", label: "Restore", icon: Archive, permission: "settings:manage" },
  {
    to: "/admin/backup/dr",
    label: "Disaster Recovery",
    icon: DatabaseBackup,
    permission: "settings:manage",
  },
  { to: "/admin/backup/failover", label: "Failover", icon: Zap, permission: "settings:manage" },
  {
    to: "/admin/backup/recovery-points",
    label: "Recovery Points",
    icon: List,
    permission: "settings:manage",
  },
  {
    to: "/admin/backup/dr-testing",
    label: "DR Testing",
    icon: FlaskConical,
    permission: "settings:manage",
  },
];

/** SYSTEM → QA / UAT */
export const QA_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/qa",
    label: "QA Dashboard",
    icon: FlaskConical,
    permission: "settings:manage",
    exact: true,
  },
  { to: "/admin/qa/cases", label: "Test Cases", icon: List, permission: "settings:manage" },
  { to: "/admin/qa/suites", label: "Test Suites", icon: List, permission: "settings:manage" },
  {
    to: "/admin/qa/functional",
    label: "Functional Testing",
    icon: ClipboardCheck,
    permission: "settings:manage",
  },
  {
    to: "/admin/qa/ui",
    label: "UI / UX Testing",
    icon: LayoutTemplate,
    permission: "settings:manage",
  },
  { to: "/admin/qa/api", label: "API Testing", icon: Link2, permission: "settings:manage" },
  {
    to: "/admin/qa/security",
    label: "Security Testing",
    icon: Shield,
    permission: "settings:manage",
  },
  {
    to: "/admin/qa/performance",
    label: "Performance Testing",
    icon: Zap,
    permission: "settings:manage",
  },
  {
    to: "/admin/qa/browsers",
    label: "Cross-Browser Testing",
    icon: Globe,
    permission: "settings:manage",
  },
  { to: "/admin/qa/mobile", label: "Mobile Testing", icon: Gauge, permission: "settings:manage" },
  {
    to: "/admin/qa/regression",
    label: "Regression Testing",
    icon: GitBranch,
    permission: "settings:manage",
  },
  { to: "/admin/qa/bugs", label: "Bug Management", icon: List, permission: "settings:manage" },
  {
    to: "/admin/qa/uat-env",
    label: "UAT Environment",
    icon: FlaskConical,
    permission: "settings:manage",
  },
  {
    to: "/admin/qa/uat",
    label: "UAT Testing",
    icon: ClipboardCheck,
    permission: "settings:manage",
  },
  {
    to: "/admin/qa/uat-approval",
    label: "UAT Approval",
    icon: ClipboardCheck,
    permission: "settings:manage",
  },
  {
    to: "/admin/qa/sign-off",
    label: "Release Sign-off",
    icon: CheckCircle2,
    permission: "settings:manage",
  },
];

export const LOCKED_TOP_ICONS = {
  workflow: Workflow,
  newsroomOps: Briefcase,
  tips: Lightbulb,
  calendar: CalendarDays,
  dashboard: LayoutDashboard,
  articles: Newspaper,
  stories: Waypoints,
  epaper: Newspaper,
  video: Video,
  podcast: Mic,
  infographics: ImagePlus,
  social: Share2,
  comments: MessageSquareText,
  media: ImagePlus,
  taxonomy: FolderTree,
  authors: PenLine,
  analytics: BarChart3,
  homepage: Home,
  pages: FileText,
  menus: Link2,
  footer: PanelBottom,
  staff: Users,
  settings: Settings,
  security: Shield,
  performance: Zap,
  backup: DatabaseBackup,
  qa: FlaskConical,
} as const;

/** MANAGEMENT → Analytics / Reports */
export const ANALYTICS_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/analytics",
    label: "Analytics Dashboard",
    icon: BarChart3,
    permission: "analytics:view",
    exact: true,
  },
  {
    to: "/admin/analytics/content",
    label: "Content Analytics",
    icon: FileText,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/traffic",
    label: "Traffic Analytics",
    icon: Eye,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/audience",
    label: "Audience Analytics",
    icon: Eye,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/articles",
    label: "Article Performance",
    icon: Newspaper,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/video",
    label: "Video Performance",
    icon: Video,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/podcast",
    label: "Podcast Performance",
    icon: Mic,
    permission: "analytics:view",
  },
  {
    to: "/admin/social/analytics",
    label: "Social Performance",
    icon: Share2,
    permission: "social:view",
  },
  {
    to: "/admin/analytics/seo",
    label: "SEO Performance",
    icon: Search,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/revenue",
    label: "Revenue Reports",
    icon: BarChart3,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/custom",
    label: "Custom Reports",
    icon: LayoutTemplate,
    permission: "analytics:view",
  },
  {
    to: "/admin/analytics/export",
    label: "Export Reports",
    icon: Archive,
    permission: "analytics:view",
  },
];

/** MANAGEMENT → Media Library */
export const MEDIA_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/media",
    label: "Media Dashboard",
    icon: LayoutDashboard,
    permission: "media:view",
    exact: true,
  },
  {
    to: "/admin/media",
    label: "Images",
    icon: ImagePlus,
    permission: "media:view",
    search: { view: "images" },
  },
  {
    to: "/admin/media",
    label: "Videos",
    icon: Video,
    permission: "media:view",
    search: { view: "videos" },
  },
  {
    to: "/admin/media",
    label: "Audio",
    icon: Mic,
    permission: "media:view",
    search: { view: "audio" },
  },
  {
    to: "/admin/media",
    label: "Documents",
    icon: FileText,
    permission: "media:view",
    search: { view: "documents" },
  },
  {
    to: "/admin/media",
    label: "ePaper Files",
    icon: Newspaper,
    permission: "media:view",
    search: { view: "epaper-files" },
  },
  {
    to: "/admin/media",
    label: "Folders",
    icon: FolderTree,
    permission: "media:view",
    search: { view: "folders" },
  },
  {
    to: "/admin/media",
    label: "Search",
    icon: Search,
    permission: "media:view",
    search: { view: "search" },
  },
  {
    to: "/admin/media",
    label: "Metadata",
    icon: List,
    permission: "media:view",
    search: { view: "metadata" },
  },
  {
    to: "/admin/media",
    label: "Image Editor",
    icon: ImagePlus,
    permission: "media:upload",
    search: { view: "image-editor" },
  },
  {
    to: "/admin/media",
    label: "Bulk Actions",
    icon: Copy,
    permission: "media:manage_all",
    search: { view: "bulk" },
  },
  {
    to: "/admin/media",
    label: "Storage Usage",
    icon: DatabaseBackup,
    permission: "media:view",
    search: { view: "storage" },
  },
];

/** SYSTEM → Settings */
export const SETTINGS_LOCKED_NAV: LockedNavItem[] = [
  {
    to: "/admin/settings",
    label: "General",
    icon: Settings,
    permission: "settings:manage",
    exact: true,
    search: { section: "general" },
  },
  {
    to: "/admin/settings",
    label: "SEO Defaults",
    icon: Search,
    permission: "settings:manage",
    search: { section: "seo" },
  },
  {
    to: "/admin/settings",
    label: "Integrations",
    icon: Link2,
    permission: "settings:manage",
    search: { section: "integrations" },
  },
  {
    to: "/admin/settings",
    label: "Security",
    icon: Shield,
    permission: "settings:manage",
    search: { section: "security" },
  },
  {
    to: "/admin/settings",
    label: "Notifications",
    icon: Bell,
    permission: "settings:manage",
    search: { section: "notifications" },
  },
  {
    to: "/admin/settings",
    label: "Publishing",
    icon: Globe,
    permission: "settings:manage",
    search: { section: "publishing" },
  },
  {
    to: "/admin/settings",
    label: "Media",
    icon: ImagePlus,
    permission: "settings:manage",
    search: { section: "media" },
  },
  {
    to: "/admin/settings",
    label: "Omnichannel",
    icon: Share2,
    permission: "settings:manage",
    search: { section: "omnichannel" },
  },
  {
    to: "/admin/settings",
    label: "AI & Automation",
    icon: Zap,
    permission: "settings:manage",
    search: { section: "ai" },
  },
  {
    to: "/admin/settings",
    label: "Email & Communication",
    icon: Newspaper,
    permission: "settings:manage",
    search: { section: "email" },
  },
  {
    to: "/admin/settings",
    label: "Advertising",
    icon: Megaphone,
    permission: "settings:manage",
    search: { section: "advertising" },
  },
  {
    to: "/admin/settings",
    label: "Privacy & Compliance",
    icon: Shield,
    permission: "settings:manage",
    search: { section: "privacy" },
  },
  {
    to: "/admin/settings",
    label: "Advanced",
    icon: Settings,
    permission: "settings:manage",
    search: { section: "advanced" },
  },
];
