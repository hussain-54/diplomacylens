-- ePaper CMS upgrade: edition metadata, status, events, tighter RLS.
-- Builds on 20260805120000_homepage_media_modules.sql

ALTER TABLE public.epaper_editions
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS volume_number text,
  ADD COLUMN IF NOT EXISTS edition_number text,
  ADD COLUMN IF NOT EXISTS edition_type text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_print boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_asset_id uuid,
  ADD COLUMN IF NOT EXISTS cover_asset_id uuid,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS editor_name text,
  ADD COLUMN IF NOT EXISTS copyright text,
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reader_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill slugs for existing rows
UPDATE public.epaper_editions
SET slug = lower(regexp_replace(coalesce(nullif(trim(title), ''), 'edition') || '-' || substr(id::text, 1, 8), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR trim(slug) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'epaper_editions_slug_key'
  ) THEN
    ALTER TABLE public.epaper_editions ADD CONSTRAINT epaper_editions_slug_key UNIQUE (slug);
  END IF;
END
$$;

ALTER TABLE public.epaper_editions
  DROP CONSTRAINT IF EXISTS epaper_editions_status_check;
ALTER TABLE public.epaper_editions
  ADD CONSTRAINT epaper_editions_status_check
  CHECK (status IN ('draft', 'processing', 'ready', 'scheduled', 'published', 'archived', 'failed'));

ALTER TABLE public.epaper_editions
  DROP CONSTRAINT IF EXISTS epaper_editions_visibility_check;
ALTER TABLE public.epaper_editions
  ADD CONSTRAINT epaper_editions_visibility_check
  CHECK (visibility IN ('public', 'private', 'unlisted'));

ALTER TABLE public.epaper_editions
  DROP CONSTRAINT IF EXISTS epaper_editions_processing_check;
ALTER TABLE public.epaper_editions
  ADD CONSTRAINT epaper_editions_processing_check
  CHECK (processing_status IN ('pending', 'uploading', 'processing', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS epaper_editions_status_idx
  ON public.epaper_editions (status, published_at DESC);
CREATE INDEX IF NOT EXISTS epaper_editions_slug_idx
  ON public.epaper_editions (slug);
CREATE INDEX IF NOT EXISTS epaper_editions_featured_idx
  ON public.epaper_editions (is_featured, published_at DESC)
  WHERE status = 'published';

-- Analytics / reader events (anonymous-friendly)
CREATE TABLE IF NOT EXISTS public.epaper_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.epaper_editions(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'epaper_opened',
      'epaper_page_viewed',
      'epaper_downloaded',
      'epaper_shared',
      'epaper_printed',
      'epaper_completed',
      'flipbook_opened'
    )),
  page_number integer,
  session_key text,
  referrer text,
  user_agent text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS epaper_events_edition_idx
  ON public.epaper_events (edition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS epaper_events_type_idx
  ON public.epaper_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.epaper_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_pdf_bytes bigint NOT NULL DEFAULT 104857600,
  allow_download_default boolean NOT NULL DEFAULT true,
  allow_print_default boolean NOT NULL DEFAULT true,
  default_viewer_mode text NOT NULL DEFAULT 'embed',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.epaper_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- RLS: public may only see published (+ due scheduled) public editions
DROP POLICY IF EXISTS "epaper public read" ON public.epaper_editions;
CREATE POLICY "epaper public read" ON public.epaper_editions
  FOR SELECT
  USING (
    (
      status = 'published'
      OR (status = 'scheduled' AND published_at <= now())
    )
    AND visibility IN ('public', 'unlisted')
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS "epaper staff read all" ON public.epaper_editions;
CREATE POLICY "epaper staff read all" ON public.epaper_editions
  FOR SELECT TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'epaper:view')
    OR app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS "epaper staff write" ON public.epaper_editions;
CREATE POLICY "epaper staff write" ON public.epaper_editions
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

ALTER TABLE public.epaper_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epaper_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS epaper_events_insert ON public.epaper_events;
CREATE POLICY epaper_events_insert ON public.epaper_events
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS epaper_events_staff_read ON public.epaper_events;
CREATE POLICY epaper_events_staff_read ON public.epaper_events
  FOR SELECT TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'epaper:view')
    OR app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

DROP POLICY IF EXISTS epaper_settings_staff ON public.epaper_settings;
CREATE POLICY epaper_settings_staff ON public.epaper_settings
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

GRANT SELECT, INSERT ON public.epaper_events TO anon, authenticated;
GRANT SELECT ON public.epaper_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.epaper_settings TO authenticated;
GRANT ALL ON public.epaper_events, public.epaper_settings TO service_role;

-- Bump counters from events (security definer)
CREATE OR REPLACE FUNCTION public.epaper_bump_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'epaper_opened' OR NEW.event_type = 'flipbook_opened' THEN
    UPDATE public.epaper_editions
    SET view_count = coalesce(view_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.edition_id;

    IF NEW.session_key IS NOT NULL AND (
      SELECT count(*)::int
      FROM public.epaper_events e
      WHERE e.edition_id = NEW.edition_id
        AND e.session_key = NEW.session_key
        AND e.event_type IN ('epaper_opened', 'flipbook_opened')
    ) = 1 THEN
      UPDATE public.epaper_editions
      SET reader_count = coalesce(reader_count, 0) + 1,
          updated_at = now()
      WHERE id = NEW.edition_id;
    END IF;
  ELSIF NEW.event_type = 'epaper_downloaded' THEN
    UPDATE public.epaper_editions
    SET download_count = coalesce(download_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.edition_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS epaper_events_bump ON public.epaper_events;
CREATE TRIGGER epaper_events_bump
  AFTER INSERT ON public.epaper_events
  FOR EACH ROW
  EXECUTE FUNCTION public.epaper_bump_counters();

-- PDF version history (preserve analytics on replace)
CREATE TABLE IF NOT EXISTS public.epaper_pdf_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.epaper_editions(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  pdf_url text NOT NULL,
  pdf_path text,
  pdf_asset_id uuid,
  file_size_bytes bigint,
  page_count integer,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'replaced', 'restored')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS epaper_pdf_versions_edition_idx
  ON public.epaper_pdf_versions (edition_id, version_number DESC);

ALTER TABLE public.epaper_pdf_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS epaper_pdf_versions_staff ON public.epaper_pdf_versions;
CREATE POLICY epaper_pdf_versions_staff ON public.epaper_pdf_versions
  FOR ALL TO authenticated
  USING (
    app_hidden.has_permission(auth.uid(), 'epaper:view')
    OR app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  )
  WITH CHECK (
    app_hidden.has_permission(auth.uid(), 'epaper:manage')
    OR app_hidden.has_permission(auth.uid(), 'videos:manage')
  );

GRANT SELECT ON public.epaper_pdf_versions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.epaper_pdf_versions TO authenticated;
GRANT ALL ON public.epaper_pdf_versions TO service_role;

-- Publish due scheduled editions (call from cron / Edge Function)
CREATE OR REPLACE FUNCTION public.publish_due_epaper_editions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.epaper_editions
  SET status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  WHERE status = 'scheduled'
    AND (
      scheduled_for <= now()
      OR published_at <= now()
    )
    AND archived_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_epaper_editions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_epaper_editions() TO service_role;

-- Extend RBAC matrix with epaper permissions
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
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION app_hidden.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_hidden.has_permission(uuid, text)
TO authenticated, service_role;
