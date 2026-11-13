-- Stories, Topics, Social omnichannel foundation for Diplomacy Lens newsroom.
-- Reuses existing articles/media/breaking_news; does not duplicate content bodies.

-- ============ Permissions (extends prior CASE with stories/topics/social) ============
CREATE OR REPLACE FUNCTION app_hidden.has_permission(
  _user_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'super_admin'
    ) THEN true
    WHEN _permission IN ('dashboard:view', 'media:view') THEN EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    )
    WHEN _permission IN (
      'articles:view', 'articles:create', 'articles:edit_own'
    ) THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor',
          'reporter', 'contributor', 'translator'
        ])
    )
    WHEN _permission IN ('articles:edit_all', 'articles:publish', 'articles:delete') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission = 'articles:review' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor', 'fact_checker'
        ])
    )
    WHEN _permission IN ('categories:manage', 'tags:manage') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    WHEN _permission = 'staff:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    WHEN _permission = 'media:upload' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor',
          'reporter', 'photographer', 'videographer'
        ])
    )
    WHEN _permission = 'media:manage_all' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    WHEN _permission IN ('comments:moderate', 'analytics:view') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission = 'newsroom:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    WHEN _permission = 'videos:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'videographer'
        ])
    )
    WHEN _permission = 'epaper:view' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor',
          'reporter', 'videographer'
        ])
    )
    WHEN _permission = 'epaper:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'videographer'
        ])
    )
    WHEN _permission = 'podcasts:view' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor',
          'reporter', 'videographer'
        ])
    )
    WHEN _permission = 'podcasts:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'videographer'
        ])
    )
    WHEN _permission = 'infographics:view' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor',
          'reporter', 'photographer', 'videographer'
        ])
    )
    WHEN _permission = 'infographics:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'photographer', 'videographer'
        ])
    )
    WHEN _permission = 'settings:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    WHEN _permission = 'homepage:view' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission = 'homepage:edit' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission = 'homepage:publish' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor'
        ])
    )
    WHEN _permission = 'breaking_news:view' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor', 'reporter'
        ])
    )
    WHEN _permission = 'breaking_news:edit' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor', 'reporter'
        ])
    )
    WHEN _permission = 'breaking_news:publish' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission IN ('stories:view', 'stories:edit', 'topics:view', 'topics:edit') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor', 'reporter'
        ])
    )
    WHEN _permission IN ('stories:publish', 'topics:publish') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission IN ('social:view', 'social:edit') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor', 'reporter'
        ])
    )
    WHEN _permission = 'social:publish' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission = 'social:manage_channels' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    ELSE false
  END;
$$;

-- ============ Stories ============
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  summary text,
  hero_image_url text,
  category_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  primary_author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  featured boolean NOT NULL DEFAULT false,
  start_date date,
  seo_title text,
  seo_description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stories_status_idx ON public.stories (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS stories_slug_idx ON public.stories (slug);

CREATE TABLE IF NOT EXISTS public.story_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  content_type text NOT NULL
    CHECK (content_type IN ('article', 'video', 'podcast', 'infographic', 'epaper', 'breaking_news')),
  content_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS story_items_story_pos_idx ON public.story_items (story_id, position);

CREATE TABLE IF NOT EXISTS public.story_contributors (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, profile_id)
);

-- ============ Topics ============
CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  accent_color text,
  category_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  parent_topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  seo_title text,
  seo_description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS topics_status_idx ON public.topics (status, name);

CREATE TABLE IF NOT EXISTS public.content_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  content_type text NOT NULL
    CHECK (content_type IN ('article', 'story', 'video', 'podcast', 'infographic', 'epaper', 'breaking_news')),
  content_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS content_topics_content_idx ON public.content_topics (content_type, content_id);
CREATE INDEX IF NOT EXISTS content_topics_topic_idx ON public.content_topics (topic_id);

CREATE TABLE IF NOT EXISTS public.story_topics (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, topic_id)
);

-- Optional direct story link on articles for fast editor assignment
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS articles_story_id_idx ON public.articles (story_id);

-- ============ Social / Omnichannel ============
CREATE TABLE IF NOT EXISTS public.social_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL
    CHECK (platform IN ('facebook', 'x', 'linkedin', 'instagram', 'youtube', 'telegram', 'whatsapp', 'other')),
  account_name text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error')),
  connected_at timestamptz,
  last_sync_at timestamptz,
  external_account_id text,
  -- credentials live server-side only; never select from anon
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date date,
  end_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_key text NOT NULL UNIQUE,
  description text,
  text_structure text,
  hashtag_rules text,
  cta text,
  media_format text,
  platforms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text
    CHECK (source_type IS NULL OR source_type IN (
      'article', 'video', 'podcast', 'infographic', 'story', 'breaking_news', 'manual'
    )),
  source_id uuid,
  campaign_id uuid REFERENCES public.social_campaigns(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.social_templates(id) ON DELETE SET NULL,
  title text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
    )),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_status_idx ON public.social_posts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_source_idx ON public.social_posts (source_type, source_id);

CREATE TABLE IF NOT EXISTS public.social_post_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.social_channels(id) ON DELETE SET NULL,
  platform text NOT NULL
    CHECK (platform IN ('facebook', 'x', 'linkedin', 'instagram', 'youtube', 'telegram', 'whatsapp', 'other')),
  content text,
  hashtags text,
  cta text,
  link text,
  media_url text,
  media_asset_id uuid,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
    )),
  scheduled_at timestamptz,
  published_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  external_post_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_post_channels_schedule_idx
  ON public.social_post_channels (status, scheduled_at);
CREATE INDEX IF NOT EXISTS social_post_channels_post_idx
  ON public.social_post_channels (social_post_id);

-- Seed default templates (idempotent)
INSERT INTO public.social_templates (name, template_key, description, text_structure, cta, platforms)
VALUES
  ('Breaking News', 'breaking_news', 'Urgent alert format', E'🔴 BREAKING:\n{headline}\n\n{link}', 'Read more', ARRAY['x','facebook','telegram']),
  ('Article Promotion', 'article_promotion', 'Promote a published article', E'{title}\n\n{deck}\n\n{link}', 'Read the full story', ARRAY['facebook','x','linkedin']),
  ('Video Promotion', 'video_promotion', 'Promote a video', E'Watch: {title}\n{link}', 'Watch now', ARRAY['facebook','x','youtube','instagram']),
  ('Podcast Promotion', 'podcast_promotion', 'Promote a podcast episode', E'Listen: {title}\n{link}', 'Listen now', ARRAY['x','linkedin','facebook']),
  ('Infographic Promotion', 'infographic_promotion', 'Promote an infographic', E'{title}\n{link}', 'View graphic', ARRAY['instagram','x','linkedin']),
  ('Daily Briefing', 'daily_briefing', 'End-of-day roundup', E'Daily Briefing\n{summary}\n{link}', 'Catch up', ARRAY['facebook','linkedin','x'])
ON CONFLICT (template_key) DO NOTHING;

-- ============ RLS ============
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_channels ENABLE ROW LEVEL SECURITY;

-- Stories public read (active)
DROP POLICY IF EXISTS "stories public read" ON public.stories;
CREATE POLICY "stories public read" ON public.stories
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "stories staff read" ON public.stories;
CREATE POLICY "stories staff read" ON public.stories
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'stories:view'));

DROP POLICY IF EXISTS "stories staff write" ON public.stories;
CREATE POLICY "stories staff write" ON public.stories
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'stories:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'stories:edit'));

DROP POLICY IF EXISTS "story_items public read" ON public.story_items;
CREATE POLICY "story_items public read" ON public.story_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.status = 'active'));

DROP POLICY IF EXISTS "story_items staff" ON public.story_items;
CREATE POLICY "story_items staff" ON public.story_items
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'stories:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'stories:edit'));

DROP POLICY IF EXISTS "story_contributors staff" ON public.story_contributors;
CREATE POLICY "story_contributors staff" ON public.story_contributors
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'stories:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'stories:edit'));

DROP POLICY IF EXISTS "story_contributors public read" ON public.story_contributors;
CREATE POLICY "story_contributors public read" ON public.story_contributors
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.status = 'active'));

-- Topics
DROP POLICY IF EXISTS "topics public read" ON public.topics;
CREATE POLICY "topics public read" ON public.topics
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "topics staff read" ON public.topics;
CREATE POLICY "topics staff read" ON public.topics
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'topics:view'));

DROP POLICY IF EXISTS "topics staff write" ON public.topics;
CREATE POLICY "topics staff write" ON public.topics
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'topics:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'topics:edit'));

DROP POLICY IF EXISTS "content_topics public read" ON public.content_topics;
CREATE POLICY "content_topics public read" ON public.content_topics
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "content_topics staff" ON public.content_topics;
CREATE POLICY "content_topics staff" ON public.content_topics
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'topics:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'topics:edit'));

DROP POLICY IF EXISTS "story_topics public read" ON public.story_topics;
CREATE POLICY "story_topics public read" ON public.story_topics
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "story_topics staff" ON public.story_topics;
CREATE POLICY "story_topics staff" ON public.story_topics
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'stories:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'stories:edit'));

-- Social (staff only; no public credentials)
DROP POLICY IF EXISTS "social_channels staff" ON public.social_channels;
CREATE POLICY "social_channels staff" ON public.social_channels
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'social:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'social:manage_channels'));

DROP POLICY IF EXISTS "social_campaigns staff" ON public.social_campaigns;
CREATE POLICY "social_campaigns staff" ON public.social_campaigns
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'social:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'social:edit'));

DROP POLICY IF EXISTS "social_templates staff read" ON public.social_templates;
CREATE POLICY "social_templates staff read" ON public.social_templates
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'social:view'));

DROP POLICY IF EXISTS "social_templates staff write" ON public.social_templates;
CREATE POLICY "social_templates staff write" ON public.social_templates
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'social:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'social:edit'));

DROP POLICY IF EXISTS "social_posts staff" ON public.social_posts;
CREATE POLICY "social_posts staff" ON public.social_posts
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'social:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'social:edit'));

DROP POLICY IF EXISTS "social_post_channels staff" ON public.social_post_channels;
CREATE POLICY "social_post_channels staff" ON public.social_post_channels
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'social:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'social:edit'));

GRANT SELECT ON public.stories, public.story_items, public.story_contributors,
  public.topics, public.content_topics, public.story_topics TO anon, authenticated;
GRANT ALL ON public.stories, public.story_items, public.story_contributors,
  public.topics, public.content_topics, public.story_topics,
  public.social_channels, public.social_campaigns, public.social_templates,
  public.social_posts, public.social_post_channels TO authenticated;
GRANT ALL ON public.stories, public.story_items, public.story_contributors,
  public.topics, public.content_topics, public.story_topics,
  public.social_channels, public.social_campaigns, public.social_templates,
  public.social_posts, public.social_post_channels TO service_role;
