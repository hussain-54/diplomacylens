-- Podcasts + Infographics CMS upgrade (mirrors ePaper pattern).
-- Builds on 20260805120000_homepage_media_modules.sql and epaper RBAC patterns.

-- ─────────────────────────────────────────────────────────────────────────────
-- PODCAST SHOWS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.podcast_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  subtitle text,
  description text,
  short_description text,
  cover_image_url text,
  cover_asset_id uuid,
  host text,
  co_hosts text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  language text DEFAULT 'en',
  region text,
  website_url text,
  youtube_url text,
  x_url text,
  facebook_url text,
  instagram_url text,
  linkedin_url text,
  rss_feed_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'unlisted')),
  is_featured boolean NOT NULL DEFAULT false,
  seo_title text,
  seo_description text,
  og_image_url text,
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  play_count integer NOT NULL DEFAULT 0,
  episode_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS podcast_shows_status_idx
  ON public.podcast_shows (status, published_at DESC);
CREATE INDEX IF NOT EXISTS podcast_shows_slug_idx
  ON public.podcast_shows (slug);

-- ─────────────────────────────────────────────────────────────────────────────
-- PODCAST EPISODES (extend existing)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES public.podcast_shows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS season_number integer,
  ADD COLUMN IF NOT EXISTS episode_number integer,
  ADD COLUMN IF NOT EXISTS guests text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS references_text text,
  ADD COLUMN IF NOT EXISTS transcript_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_asset_id uuid,
  ADD COLUMN IF NOT EXISTS artwork_asset_id uuid,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_embed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS play_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listener_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listen_seconds_total bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.podcast_episodes
SET slug = lower(regexp_replace(coalesce(nullif(trim(title), ''), 'episode') || '-' || substr(id::text, 1, 8), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR trim(slug) = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'podcast_episodes_slug_key') THEN
    ALTER TABLE public.podcast_episodes ADD CONSTRAINT podcast_episodes_slug_key UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE public.podcast_episodes DROP CONSTRAINT IF EXISTS podcast_episodes_status_check;
ALTER TABLE public.podcast_episodes
  ADD CONSTRAINT podcast_episodes_status_check
  CHECK (status IN ('draft', 'review', 'processing', 'scheduled', 'published', 'archived', 'failed'));

ALTER TABLE public.podcast_episodes DROP CONSTRAINT IF EXISTS podcast_episodes_visibility_check;
ALTER TABLE public.podcast_episodes
  ADD CONSTRAINT podcast_episodes_visibility_check
  CHECK (visibility IN ('public', 'private', 'unlisted'));

CREATE INDEX IF NOT EXISTS podcast_episodes_status_idx
  ON public.podcast_episodes (status, published_at DESC);
CREATE INDEX IF NOT EXISTS podcast_episodes_show_idx
  ON public.podcast_episodes (show_id, episode_number);

-- Playlists / series
CREATE TABLE IF NOT EXISTS public.podcast_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid REFERENCES public.podcast_shows(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text UNIQUE,
  description text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.podcast_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.podcast_playlists(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, episode_id)
);

CREATE TABLE IF NOT EXISTS public.podcast_episode_articles (
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  PRIMARY KEY (episode_id, article_id)
);

CREATE TABLE IF NOT EXISTS public.podcast_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  show_id uuid REFERENCES public.podcast_shows(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'episode_opened',
      'play_started',
      'play_paused',
      'play_completed',
      'seek',
      'downloaded',
      'shared',
      'listen_progress'
    )),
  position_seconds integer,
  duration_seconds integer,
  session_key text,
  referrer text,
  user_agent text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS podcast_events_episode_idx
  ON public.podcast_events (episode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS podcast_events_type_idx
  ON public.podcast_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.podcast_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_audio_bytes bigint NOT NULL DEFAULT 209715200,
  allow_download_default boolean NOT NULL DEFAULT true,
  allow_embed_default boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.podcast_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- INFOGRAPHICS (extend existing)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.infographics
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS graphic_type text DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS asset_url text,
  ADD COLUMN IF NOT EXISTS asset_path text,
  ADD COLUMN IF NOT EXISTS asset_asset_id uuid,
  ADD COLUMN IF NOT EXISTS cover_asset_id uuid,
  ADD COLUMN IF NOT EXISTS file_format text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS methodology text,
  ADD COLUMN IF NOT EXISTS data_date text,
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.infographics
SET slug = lower(regexp_replace(coalesce(nullif(trim(title), ''), 'infographic') || '-' || substr(id::text, 1, 8), '[^a-z0-9]+', '-', 'g')),
    asset_url = coalesce(asset_url, source_url, cover_image_url)
WHERE slug IS NULL OR trim(slug) = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infographics_slug_key') THEN
    ALTER TABLE public.infographics ADD CONSTRAINT infographics_slug_key UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE public.infographics DROP CONSTRAINT IF EXISTS infographics_status_check;
ALTER TABLE public.infographics
  ADD CONSTRAINT infographics_status_check
  CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived'));

ALTER TABLE public.infographics DROP CONSTRAINT IF EXISTS infographics_visibility_check;
ALTER TABLE public.infographics
  ADD CONSTRAINT infographics_visibility_check
  CHECK (visibility IN ('public', 'private', 'unlisted'));

CREATE INDEX IF NOT EXISTS infographics_status_idx
  ON public.infographics (status, published_at DESC);
CREATE INDEX IF NOT EXISTS infographics_slug_idx
  ON public.infographics (slug);

CREATE TABLE IF NOT EXISTS public.infographic_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  description text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  is_featured boolean NOT NULL DEFAULT false,
  featured_item_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.infographic_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.infographic_collections(id) ON DELETE CASCADE,
  infographic_id uuid NOT NULL REFERENCES public.infographics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, infographic_id)
);

CREATE TABLE IF NOT EXISTS public.infographic_articles (
  infographic_id uuid NOT NULL REFERENCES public.infographics(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  PRIMARY KEY (infographic_id, article_id)
);

CREATE TABLE IF NOT EXISTS public.infographic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infographic_id uuid NOT NULL REFERENCES public.infographics(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'infographic_opened',
      'infographic_zoomed',
      'infographic_fullscreen',
      'infographic_downloaded',
      'infographic_shared'
    )),
  session_key text,
  referrer text,
  user_agent text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS infographic_events_item_idx
  ON public.infographic_events (infographic_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.infographic_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_asset_bytes bigint NOT NULL DEFAULT 52428800,
  allow_download_default boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.infographic_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.podcast_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_episode_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infographic_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infographic_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infographic_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infographic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infographic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "podcasts public read" ON public.podcast_episodes;
CREATE POLICY "podcasts public read" ON public.podcast_episodes
  FOR SELECT USING (
    (
      status = 'published'
      OR (status = 'scheduled' AND published_at <= now())
    )
    AND visibility IN ('public', 'unlisted')
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS "podcasts staff read all" ON public.podcast_episodes;
CREATE POLICY "podcasts staff read all" ON public.podcast_episodes
  FOR SELECT TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:view')
    OR app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "podcasts staff write" ON public.podcast_episodes;
CREATE POLICY "podcasts staff write" ON public.podcast_episodes
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "podcast_shows public read" ON public.podcast_shows;
CREATE POLICY "podcast_shows public read" ON public.podcast_shows
  FOR SELECT USING (
    status = 'published'
    AND visibility IN ('public', 'unlisted')
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS "podcast_shows staff" ON public.podcast_shows;
CREATE POLICY "podcast_shows staff" ON public.podcast_shows
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:view')
    OR app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "podcast_playlists public read" ON public.podcast_playlists;
CREATE POLICY "podcast_playlists public read" ON public.podcast_playlists
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "podcast_playlists staff" ON public.podcast_playlists;
CREATE POLICY "podcast_playlists staff" ON public.podcast_playlists
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:view')
    OR app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "podcast_playlist_items public read" ON public.podcast_playlist_items;
CREATE POLICY "podcast_playlist_items public read" ON public.podcast_playlist_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "podcast_playlist_items staff" ON public.podcast_playlist_items;
CREATE POLICY "podcast_playlist_items staff" ON public.podcast_playlist_items
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "podcast_episode_articles public read" ON public.podcast_episode_articles;
CREATE POLICY "podcast_episode_articles public read" ON public.podcast_episode_articles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "podcast_episode_articles staff" ON public.podcast_episode_articles;
CREATE POLICY "podcast_episode_articles staff" ON public.podcast_episode_articles
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS podcast_events_insert ON public.podcast_events;
CREATE POLICY podcast_events_insert ON public.podcast_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS podcast_events_staff_read ON public.podcast_events;
CREATE POLICY podcast_events_staff_read ON public.podcast_events
  FOR SELECT TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:view')
    OR app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS podcast_settings_staff ON public.podcast_settings;
CREATE POLICY podcast_settings_staff ON public.podcast_settings
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'podcasts:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "infographics public read" ON public.infographics;
CREATE POLICY "infographics public read" ON public.infographics
  FOR SELECT USING (
    (
      status = 'published'
      OR (status = 'scheduled' AND published_at <= now())
    )
    AND visibility IN ('public', 'unlisted')
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS "infographics staff read all" ON public.infographics;
CREATE POLICY "infographics staff read all" ON public.infographics
  FOR SELECT TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:view')
    OR app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "infographics staff write" ON public.infographics;
CREATE POLICY "infographics staff write" ON public.infographics
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "infographic_collections public read" ON public.infographic_collections;
CREATE POLICY "infographic_collections public read" ON public.infographic_collections
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "infographic_collections staff" ON public.infographic_collections;
CREATE POLICY "infographic_collections staff" ON public.infographic_collections
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:view')
    OR app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "infographic_collection_items public read" ON public.infographic_collection_items;
CREATE POLICY "infographic_collection_items public read" ON public.infographic_collection_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "infographic_collection_items staff" ON public.infographic_collection_items;
CREATE POLICY "infographic_collection_items staff" ON public.infographic_collection_items
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "infographic_articles public read" ON public.infographic_articles;
CREATE POLICY "infographic_articles public read" ON public.infographic_articles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "infographic_articles staff" ON public.infographic_articles;
CREATE POLICY "infographic_articles staff" ON public.infographic_articles
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS infographic_events_insert ON public.infographic_events;
CREATE POLICY infographic_events_insert ON public.infographic_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS infographic_events_staff_read ON public.infographic_events;
CREATE POLICY infographic_events_staff_read ON public.infographic_events
  FOR SELECT TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:view')
    OR app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS infographic_settings_staff ON public.infographic_settings;
CREATE POLICY infographic_settings_staff ON public.infographic_settings
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'infographics:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

GRANT SELECT ON public.podcast_shows, public.podcast_playlists, public.podcast_playlist_items,
  public.podcast_episode_articles, public.infographic_collections, public.infographic_collection_items,
  public.infographic_articles TO anon, authenticated;
GRANT SELECT, INSERT ON public.podcast_events, public.infographic_events TO anon, authenticated;
GRANT SELECT ON public.podcast_settings, public.infographic_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.podcast_shows, public.podcast_playlists, public.podcast_playlist_items,
  public.podcast_episode_articles, public.podcast_settings, public.infographic_collections,
  public.infographic_collection_items, public.infographic_articles, public.infographic_settings
  TO authenticated;
GRANT ALL ON public.podcast_shows, public.podcast_playlists, public.podcast_playlist_items,
  public.podcast_episode_articles, public.podcast_events, public.podcast_settings,
  public.infographic_collections, public.infographic_collection_items, public.infographic_articles,
  public.infographic_events, public.infographic_settings TO service_role;

-- Counter triggers
CREATE OR REPLACE FUNCTION public.podcast_bump_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'play_started' THEN
    UPDATE public.podcast_episodes
    SET play_count = coalesce(play_count, 0) + 1, updated_at = now()
    WHERE id = NEW.episode_id;
    IF NEW.session_key IS NOT NULL AND (
      SELECT count(*)::int FROM public.podcast_events e
      WHERE e.episode_id = NEW.episode_id AND e.session_key = NEW.session_key AND e.event_type = 'play_started'
    ) = 1 THEN
      UPDATE public.podcast_episodes
      SET listener_count = coalesce(listener_count, 0) + 1, updated_at = now()
      WHERE id = NEW.episode_id;
    END IF;
  ELSIF NEW.event_type = 'downloaded' THEN
    UPDATE public.podcast_episodes
    SET download_count = coalesce(download_count, 0) + 1, updated_at = now()
    WHERE id = NEW.episode_id;
  ELSIF NEW.event_type = 'listen_progress' AND NEW.position_seconds IS NOT NULL AND NEW.position_seconds > 0 THEN
    UPDATE public.podcast_episodes
    SET listen_seconds_total = coalesce(listen_seconds_total, 0) + NEW.position_seconds, updated_at = now()
    WHERE id = NEW.episode_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS podcast_events_bump ON public.podcast_events;
CREATE TRIGGER podcast_events_bump
  AFTER INSERT ON public.podcast_events
  FOR EACH ROW EXECUTE FUNCTION public.podcast_bump_counters();

CREATE OR REPLACE FUNCTION public.infographic_bump_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'infographic_opened' THEN
    UPDATE public.infographics
    SET view_count = coalesce(view_count, 0) + 1, updated_at = now()
    WHERE id = NEW.infographic_id;
  ELSIF NEW.event_type = 'infographic_downloaded' THEN
    UPDATE public.infographics
    SET download_count = coalesce(download_count, 0) + 1, updated_at = now()
    WHERE id = NEW.infographic_id;
  ELSIF NEW.event_type = 'infographic_shared' THEN
    UPDATE public.infographics
    SET share_count = coalesce(share_count, 0) + 1, updated_at = now()
    WHERE id = NEW.infographic_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS infographic_events_bump ON public.infographic_events;
CREATE TRIGGER infographic_events_bump
  AFTER INSERT ON public.infographic_events
  FOR EACH ROW EXECUTE FUNCTION public.infographic_bump_counters();

CREATE OR REPLACE FUNCTION public.publish_due_podcast_episodes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE public.podcast_episodes
  SET status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  WHERE status = 'scheduled'
    AND (scheduled_for <= now() OR published_at <= now())
    AND archived_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_due_infographics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE public.infographics
  SET status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  WHERE status = 'scheduled'
    AND (scheduled_for <= now() OR published_at <= now())
    AND archived_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_podcast_episodes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_due_infographics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_podcast_episodes() TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_due_infographics() TO service_role;

-- Extend has_permission (includes epaper from prior migration)
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
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION app_hidden.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_hidden.has_permission(uuid, text)
TO authenticated, service_role;
