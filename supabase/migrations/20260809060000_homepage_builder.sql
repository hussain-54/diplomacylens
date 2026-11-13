-- Fully dynamic homepage builder: versions, sections, items, schedules, ad slots.

-- ============ Permissions ============
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
    ELSE false
  END;
$$;

-- ============ Tables ============
CREATE TABLE IF NOT EXISTS public.homepage_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE DEFAULT 'home',
  name text NOT NULL DEFAULT 'Homepage',
  draft_version_id uuid,
  live_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homepage_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.homepage_pages(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'live', 'archived', 'scheduled')),
  label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version_number)
);

ALTER TABLE public.homepage_pages
  DROP CONSTRAINT IF EXISTS homepage_pages_draft_version_id_fkey;
ALTER TABLE public.homepage_pages
  DROP CONSTRAINT IF EXISTS homepage_pages_live_version_id_fkey;
ALTER TABLE public.homepage_pages
  ADD CONSTRAINT homepage_pages_draft_version_id_fkey
  FOREIGN KEY (draft_version_id) REFERENCES public.homepage_versions(id) ON DELETE SET NULL;
ALTER TABLE public.homepage_pages
  ADD CONSTRAINT homepage_pages_live_version_id_fkey
  FOREIGN KEY (live_version_id) REFERENCES public.homepage_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.homepage_versions(id) ON DELETE CASCADE,
  section_type text NOT NULL,
  name text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homepage_sections_version_pos_idx
  ON public.homepage_sections (version_id, position);

CREATE TABLE IF NOT EXISTS public.homepage_section_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
  content_type text NOT NULL
    CHECK (content_type IN ('article', 'video', 'podcast', 'infographic', 'epaper')),
  content_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homepage_section_items_section_pos_idx
  ON public.homepage_section_items (section_id, position);

CREATE TABLE IF NOT EXISTS public.homepage_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.homepage_versions(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homepage_schedules_due_idx
  ON public.homepage_schedules (status, starts_at);

CREATE TABLE IF NOT EXISTS public.ad_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  device text NOT NULL DEFAULT 'all'
    CHECK (device IN ('all', 'desktop', 'tablet', 'mobile')),
  enabled boolean NOT NULL DEFAULT true,
  gam_unit_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ RLS ============
ALTER TABLE public.homepage_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_section_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "homepage_pages staff" ON public.homepage_pages;
CREATE POLICY "homepage_pages staff" ON public.homepage_pages FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'homepage:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'homepage:edit'));

DROP POLICY IF EXISTS "homepage_pages public read" ON public.homepage_pages;
CREATE POLICY "homepage_pages public read" ON public.homepage_pages FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "homepage_versions staff" ON public.homepage_versions;
CREATE POLICY "homepage_versions staff" ON public.homepage_versions FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'homepage:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'homepage:edit'));

DROP POLICY IF EXISTS "homepage_versions public live" ON public.homepage_versions;
CREATE POLICY "homepage_versions public live" ON public.homepage_versions FOR SELECT TO anon, authenticated
  USING (
    status = 'live'
    OR EXISTS (
      SELECT 1 FROM public.homepage_schedules s
      WHERE s.version_id = homepage_versions.id
        AND s.status = 'active'
        AND s.starts_at <= now()
        AND (s.ends_at IS NULL OR s.ends_at > now())
    )
  );

DROP POLICY IF EXISTS "homepage_sections staff" ON public.homepage_sections;
CREATE POLICY "homepage_sections staff" ON public.homepage_sections FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'homepage:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'homepage:edit'));

DROP POLICY IF EXISTS "homepage_sections public" ON public.homepage_sections;
CREATE POLICY "homepage_sections public" ON public.homepage_sections FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homepage_versions v
      WHERE v.id = homepage_sections.version_id
        AND (
          v.status = 'live'
          OR EXISTS (
            SELECT 1 FROM public.homepage_schedules s
            WHERE s.version_id = v.id
              AND s.status = 'active'
              AND s.starts_at <= now()
              AND (s.ends_at IS NULL OR s.ends_at > now())
          )
        )
    )
  );

DROP POLICY IF EXISTS "homepage_section_items staff" ON public.homepage_section_items;
CREATE POLICY "homepage_section_items staff" ON public.homepage_section_items FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'homepage:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'homepage:edit'));

DROP POLICY IF EXISTS "homepage_section_items public" ON public.homepage_section_items;
CREATE POLICY "homepage_section_items public" ON public.homepage_section_items FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.homepage_sections sec
      JOIN public.homepage_versions v ON v.id = sec.version_id
      WHERE sec.id = homepage_section_items.section_id
        AND (
          v.status = 'live'
          OR EXISTS (
            SELECT 1 FROM public.homepage_schedules s
            WHERE s.version_id = v.id
              AND s.status = 'active'
              AND s.starts_at <= now()
              AND (s.ends_at IS NULL OR s.ends_at > now())
          )
        )
    )
  );

DROP POLICY IF EXISTS "homepage_schedules staff" ON public.homepage_schedules;
CREATE POLICY "homepage_schedules staff" ON public.homepage_schedules FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'homepage:view'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'homepage:publish'));

DROP POLICY IF EXISTS "ad_slots public read" ON public.ad_slots;
CREATE POLICY "ad_slots public read" ON public.ad_slots FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS "ad_slots staff" ON public.ad_slots;
CREATE POLICY "ad_slots staff" ON public.ad_slots FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'homepage:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'homepage:edit'));

GRANT SELECT ON public.homepage_pages, public.homepage_versions, public.homepage_sections,
  public.homepage_section_items, public.ad_slots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_pages, public.homepage_versions,
  public.homepage_sections, public.homepage_section_items, public.homepage_schedules, public.ad_slots
  TO authenticated;
GRANT ALL ON public.homepage_pages, public.homepage_versions, public.homepage_sections,
  public.homepage_section_items, public.homepage_schedules, public.ad_slots TO service_role;

-- ============ Seed ad slots ============
INSERT INTO public.ad_slots (key, label, device, enabled)
VALUES
  ('homepage_leaderboard', 'Homepage Leaderboard', 'desktop', true),
  ('homepage_sidebar', 'Homepage Sidebar', 'desktop', true),
  ('homepage_mobile', 'Homepage Mobile', 'mobile', true),
  ('homepage_inline', 'Homepage Inline', 'all', true)
ON CONFLICT (key) DO NOTHING;

-- ============ Seed homepage from current hardcoded layout ============
DO $$
DECLARE
  v_page_id uuid;
  live_id uuid;
  draft_id uuid;
  politics_id uuid;
BEGIN
  SELECT id INTO v_page_id FROM public.homepage_pages WHERE slug = 'home';
  IF v_page_id IS NULL THEN
    INSERT INTO public.homepage_pages (slug, name)
    VALUES ('home', 'Homepage')
    RETURNING id INTO v_page_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.homepage_versions hv WHERE hv.page_id = v_page_id
  ) THEN
    INSERT INTO public.homepage_versions (page_id, version_number, status, label, published_at)
    VALUES (v_page_id, 1, 'live', 'Initial layout', now())
    RETURNING id INTO live_id;

    INSERT INTO public.homepage_versions (page_id, version_number, status, label)
    VALUES (v_page_id, 2, 'draft', 'Working draft')
    RETURNING id INTO draft_id;

    UPDATE public.homepage_pages
    SET live_version_id = live_id, draft_version_id = draft_id, updated_at = now()
    WHERE id = v_page_id;

    SELECT id INTO politics_id FROM public.sections WHERE slug = 'politics' LIMIT 1;

    -- Live sections (mirror current index.tsx)
    INSERT INTO public.homepage_sections (version_id, section_type, name, position, enabled, config) VALUES
      (live_id, 'hero', 'Hero', 0, true, jsonb_build_object(
        'source', 'automatic', 'sort', 'featured_then_latest', 'limit', 5,
        'layout', 'lead_plus_side', 'side_count', 4, 'show_image', true, 'show_author', false, 'show_date', true, 'show_description', true,
        'spacing', 'medium', 'background', 'default', 'width', 'container'
      )),
      (live_id, 'featured_news', 'Featured Stories', 1, true, jsonb_build_object(
        'source', 'automatic', 'sort', 'latest', 'limit', 5, 'layout', 'grid_5',
        'title', 'Featured Stories', 'href', '/latest', 'show_image', true, 'show_date', true,
        'spacing', 'medium', 'background', 'default'
      )),
      (live_id, 'latest_news', 'Latest News', 2, true, jsonb_build_object(
        'source', 'automatic', 'sort', 'latest', 'limit', 9, 'layout', 'grid_3',
        'title', 'Latest News', 'href', '/latest', 'offset', 4,
        'show_image', true, 'show_date', true, 'show_description', true,
        'spacing', 'medium', 'background', 'muted'
      )),
      (live_id, 'category_news', 'Politics', 3, true, jsonb_build_object(
        'source', 'category', 'sort', 'latest', 'limit', 5, 'layout', 'grid_5',
        'title', 'Politics', 'eyebrow', 'Desk', 'href', '/section/politics',
        'category_id', politics_id, 'category_slug', 'politics',
        'show_image', true, 'spacing', 'medium', 'background', 'default'
      )),
      (live_id, 'epaper', 'E-Paper', 4, true, jsonb_build_object(
        'source', 'latest', 'limit', 4, 'layout', 'grid_4',
        'title', 'E-Paper', 'eyebrow', 'Print desk', 'href', '/epaper',
        'spacing', 'medium', 'background', 'muted'
      )),
      (live_id, 'video', 'Videos', 5, true, jsonb_build_object(
        'source', 'latest', 'limit', 5, 'layout', 'grid_5',
        'title', 'Videos', 'eyebrow', 'Watch', 'href', '/video',
        'spacing', 'medium', 'background', 'default'
      )),
      (live_id, 'podcast', 'Podcasts', 6, true, jsonb_build_object(
        'source', 'latest', 'limit', 4, 'layout', 'grid_4',
        'title', 'Podcasts', 'eyebrow', 'Listen', 'href', '/podcast',
        'spacing', 'medium', 'background', 'muted'
      )),
      (live_id, 'infographics', 'Infographics', 7, true, jsonb_build_object(
        'source', 'latest', 'limit', 4, 'layout', 'grid_4',
        'title', 'Infographics', 'eyebrow', 'Visual briefings', 'href', '/infographics',
        'spacing', 'medium', 'background', 'default'
      )),
      (live_id, 'article_grid', 'Explore', 8, true, jsonb_build_object(
        'source', 'automatic', 'sort', 'latest', 'limit', 10, 'layout', 'grid_5',
        'title', 'Explore', 'href', '/latest',
        'show_image', true, 'spacing', 'medium', 'background', 'muted'
      )),
      (live_id, 'war_monitor', 'War Monitor', 9, true, jsonb_build_object(
        'limit', 6, 'title', 'War Monitor', 'eyebrow', 'Global Conflict Desk', 'href', '/section/war',
        'spacing', 'medium', 'background', 'ink'
      )),
      (live_id, 'ambassadors_embassy', 'Ambassadors & Embassy Watch', 10, true, jsonb_build_object(
        'ambassador_limit', 2, 'embassy_limit', 6, 'spacing', 'medium', 'background', 'default'
      )),
      (live_id, 'newsletter', 'Newsletter', 11, true, jsonb_build_object(
        'spacing', 'medium', 'background', 'default'
      ));

    -- Copy live → draft for editing
    INSERT INTO public.homepage_sections (version_id, section_type, name, position, enabled, config)
    SELECT draft_id, section_type, name, position, enabled, config
    FROM public.homepage_sections WHERE version_id = live_id;
  END IF;
END $$;

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.get_public_homepage_version_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vid uuid;
  page_rec public.homepage_pages%ROWTYPE;
BEGIN
  SELECT * INTO page_rec FROM public.homepage_pages WHERE slug = 'home' LIMIT 1;
  IF page_rec.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Active schedule wins
  SELECT s.version_id INTO vid
  FROM public.homepage_schedules s
  JOIN public.homepage_versions v ON v.id = s.version_id
  WHERE s.status IN ('pending', 'active')
    AND s.starts_at <= now()
    AND (s.ends_at IS NULL OR s.ends_at > now())
    AND v.page_id = page_rec.id
  ORDER BY s.starts_at DESC
  LIMIT 1;

  IF vid IS NOT NULL THEN
    RETURN vid;
  END IF;

  RETURN page_rec.live_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_homepage_version_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_homepage_version_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.publish_homepage_version(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ver public.homepage_versions%ROWTYPE;
  page_rec public.homepage_pages%ROWTYPE;
  next_draft uuid;
  next_num integer;
BEGIN
  IF uid IS NULL OR NOT app_hidden.has_permission(uid, 'homepage:publish') THEN
    RAISE EXCEPTION 'Forbidden — missing homepage:publish';
  END IF;

  SELECT * INTO ver FROM public.homepage_versions WHERE id = p_version_id;
  IF ver.id IS NULL THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  SELECT * INTO page_rec FROM public.homepage_pages WHERE id = ver.page_id;

  IF page_rec.live_version_id IS NOT NULL AND page_rec.live_version_id <> p_version_id THEN
    UPDATE public.homepage_versions
    SET status = 'archived', updated_at = now()
    WHERE id = page_rec.live_version_id AND status = 'live';
  END IF;

  UPDATE public.homepage_versions
  SET status = 'live', published_by = uid, published_at = now(), updated_at = now()
  WHERE id = p_version_id;

  -- Ensure a fresh draft exists after publish (clone of live)
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_num
  FROM public.homepage_versions WHERE page_id = page_rec.id;

  INSERT INTO public.homepage_versions (page_id, version_number, status, label, created_by)
  VALUES (page_rec.id, next_num, 'draft', 'Working draft', uid)
  RETURNING id INTO next_draft;

  INSERT INTO public.homepage_sections (version_id, section_type, name, position, enabled, config)
  SELECT next_draft, section_type, name, position, enabled, config
  FROM public.homepage_sections WHERE version_id = p_version_id;

  INSERT INTO public.homepage_section_items (section_id, content_type, content_id, position)
  SELECT ns.id, oi.content_type, oi.content_id, oi.position
  FROM public.homepage_sections os
  JOIN public.homepage_section_items oi ON oi.section_id = os.id
  JOIN public.homepage_sections ns
    ON ns.version_id = next_draft
   AND ns.position = os.position
   AND ns.section_type = os.section_type
  WHERE os.version_id = p_version_id;

  UPDATE public.homepage_pages
  SET live_version_id = p_version_id,
      draft_version_id = next_draft,
      updated_at = now()
  WHERE id = page_rec.id;

  BEGIN
    INSERT INTO public.admin_audit_logs (actor_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'homepage_published',
      'homepage_version',
      p_version_id::text,
      jsonb_build_object('version_number', ver.version_number, 'new_draft_id', next_draft)
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'live_version_id', p_version_id, 'draft_version_id', next_draft);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_homepage_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_homepage_version(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.publish_due_homepage_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT s.id AS schedule_id, s.version_id, v.page_id
    FROM public.homepage_schedules s
    JOIN public.homepage_versions v ON v.id = s.version_id
    WHERE s.status = 'pending'
      AND s.starts_at <= now()
      AND (s.ends_at IS NULL OR s.ends_at > now())
  LOOP
    -- Archive current live
    UPDATE public.homepage_versions
    SET status = 'archived', updated_at = now()
    WHERE homepage_versions.page_id = rec.page_id AND status = 'live' AND id <> rec.version_id;

    UPDATE public.homepage_versions
    SET status = 'live', published_at = COALESCE(published_at, now()), updated_at = now()
    WHERE id = rec.version_id;

    UPDATE public.homepage_pages
    SET live_version_id = rec.version_id, updated_at = now()
    WHERE id = rec.page_id;

    UPDATE public.homepage_schedules
    SET status = 'active', updated_at = now()
    WHERE id = rec.schedule_id;
  END LOOP;

  UPDATE public.homepage_schedules
  SET status = 'completed', updated_at = now()
  WHERE status = 'active'
    AND ends_at IS NOT NULL
    AND ends_at <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_homepage_schedules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_homepage_schedules() TO service_role;

-- Hook into media publish wrapper when present
CREATE OR REPLACE FUNCTION public.publish_due_media_modules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN PERFORM public.publish_due_videos(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_podcast_episodes(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_infographics(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_epaper_editions(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_homepage_schedules(); EXCEPTION WHEN undefined_function THEN NULL; END;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_due_media_publish()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (
    app_hidden.has_permission(uid, 'settings:manage')
    OR app_hidden.has_permission(uid, 'videos:manage')
    OR app_hidden.has_permission(uid, 'podcasts:manage')
    OR app_hidden.has_permission(uid, 'infographics:manage')
    OR app_hidden.has_permission(uid, 'epaper:manage')
    OR app_hidden.has_permission(uid, 'articles:publish')
    OR app_hidden.has_permission(uid, 'homepage:publish')
  ) THEN
    RAISE EXCEPTION 'Forbidden — missing publish permission';
  END IF;

  BEGIN PERFORM public.publish_due_videos(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_podcast_episodes(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_infographics(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_epaper_editions(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_homepage_schedules(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_articles(); EXCEPTION WHEN undefined_function THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'ran_at', now());
END;
$$;

NOTIFY pgrst, 'reload schema';
