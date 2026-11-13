-- Videos CMS upgrade (parity with podcasts/epaper modules).
-- Builds on base videos table from early migrations.

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS video_asset_id uuid,
  ADD COLUMN IF NOT EXISTS thumbnail_asset_id uuid,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_seconds_total bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.videos
SET slug = lower(regexp_replace(coalesce(nullif(trim(title), ''), 'video') || '-' || substr(id::text, 1, 8), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR trim(slug) = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'videos_slug_key') THEN
    ALTER TABLE public.videos ADD CONSTRAINT videos_slug_key UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos
  ADD CONSTRAINT videos_status_check
  CHECK (status IN ('draft', 'review', 'processing', 'scheduled', 'published', 'archived', 'failed'));

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_visibility_check;
ALTER TABLE public.videos
  ADD CONSTRAINT videos_visibility_check
  CHECK (visibility IN ('public', 'private', 'unlisted'));

CREATE INDEX IF NOT EXISTS videos_status_idx ON public.videos (status, published_at DESC);
CREATE INDEX IF NOT EXISTS videos_slug_idx ON public.videos (slug);

CREATE TABLE IF NOT EXISTS public.video_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS public.video_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.video_playlists(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, video_id)
);

CREATE TABLE IF NOT EXISTS public.video_captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  label text,
  format text NOT NULL DEFAULT 'vtt' CHECK (format IN ('vtt', 'srt')),
  file_url text NOT NULL,
  file_path text,
  asset_id uuid,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'video_opened',
      'play_started',
      'play_paused',
      'play_completed',
      'seek',
      'downloaded',
      'shared',
      'watch_progress'
    )),
  position_seconds integer,
  duration_seconds integer,
  session_key text,
  referrer text,
  user_agent text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_events_video_idx ON public.video_events (video_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.video_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_video_bytes bigint NOT NULL DEFAULT 524288000,
  allow_download_default boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.video_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- RLS: tighten public read
DROP POLICY IF EXISTS "videos public read" ON public.videos;
CREATE POLICY "videos public read" ON public.videos
  FOR SELECT USING (
    (
      status = 'published'
      OR (status = 'scheduled' AND published_at <= now())
    )
    AND visibility IN ('public', 'unlisted')
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS "video staff manage videos" ON public.videos;
DROP POLICY IF EXISTS "editors manage videos" ON public.videos;
CREATE POLICY "video staff read all" ON public.videos
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'));

CREATE POLICY "video staff write" ON public.videos
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'videos:manage'));

ALTER TABLE public.video_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_playlists public read" ON public.video_playlists
  FOR SELECT USING (status = 'published');
CREATE POLICY "video_playlists staff" ON public.video_playlists
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'videos:manage'));

CREATE POLICY "video_playlist_items public read" ON public.video_playlist_items FOR SELECT USING (true);
CREATE POLICY "video_playlist_items staff" ON public.video_playlist_items
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'videos:manage'));

CREATE POLICY "video_captions public read" ON public.video_captions FOR SELECT USING (true);
CREATE POLICY "video_captions staff" ON public.video_captions
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'videos:manage'));

CREATE POLICY video_events_insert ON public.video_events FOR INSERT WITH CHECK (true);
CREATE POLICY video_events_staff_read ON public.video_events
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'));

CREATE POLICY video_settings_staff ON public.video_settings
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'videos:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'videos:manage'));

GRANT SELECT ON public.video_playlists, public.video_playlist_items, public.video_captions TO anon, authenticated;
GRANT SELECT, INSERT ON public.video_events TO anon, authenticated;
GRANT SELECT ON public.video_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.video_playlists, public.video_playlist_items, public.video_captions, public.video_settings TO authenticated;
GRANT ALL ON public.video_playlists, public.video_playlist_items, public.video_captions, public.video_events, public.video_settings TO service_role;

CREATE OR REPLACE FUNCTION public.video_bump_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'play_started' THEN
    UPDATE public.videos SET view_count = coalesce(view_count, 0) + 1, updated_at = now() WHERE id = NEW.video_id;
  ELSIF NEW.event_type = 'play_completed' THEN
    UPDATE public.videos SET completion_count = coalesce(completion_count, 0) + 1, updated_at = now() WHERE id = NEW.video_id;
  ELSIF NEW.event_type = 'watch_progress' AND NEW.position_seconds IS NOT NULL AND NEW.position_seconds > 0 THEN
    UPDATE public.videos
    SET watch_seconds_total = coalesce(watch_seconds_total, 0) + NEW.position_seconds, updated_at = now()
    WHERE id = NEW.video_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_events_bump ON public.video_events;
CREATE TRIGGER video_events_bump
  AFTER INSERT ON public.video_events
  FOR EACH ROW EXECUTE FUNCTION public.video_bump_counters();

CREATE OR REPLACE FUNCTION public.publish_due_videos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE public.videos
  SET status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  WHERE status = 'scheduled'
    AND (scheduled_for <= now() OR published_at <= now())
    AND archived_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_videos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_videos() TO service_role;
