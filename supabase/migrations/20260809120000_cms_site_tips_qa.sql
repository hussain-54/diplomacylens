-- Site CMS + News Tips + QA foundation for locked Diplomacy Lens admin architecture.
-- Reuses existing articles/staff/settings; does not duplicate content bodies.

-- ============ News Tips ============
CREATE TABLE IF NOT EXISTS public.news_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'unreviewed', 'investigation', 'verified', 'rejected', 'anonymous'
    )),
  source_name text,
  source_contact text,
  is_anonymous boolean NOT NULL DEFAULT false,
  location text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_tips_status_idx ON public.news_tips (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.news_tip_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization text,
  contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ CMS Pages ============
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  body text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  template_key text,
  seo_title text,
  seo_description text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_pages_status_idx ON public.cms_pages (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.cms_page_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE TABLE IF NOT EXISTS public.cms_page_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_key text NOT NULL UNIQUE,
  description text,
  body_structure text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cms_page_templates (name, template_key, description, body_structure)
VALUES
  ('Blank', 'blank', 'Empty page', ''),
  ('Policy', 'policy', 'Legal / policy layout', '## Summary\n\n## Details\n'),
  ('About', 'about', 'About / company page', '## Overview\n\n## Mission\n')
ON CONFLICT (template_key) DO NOTHING;

-- ============ Navigation menus ============
CREATE TABLE IF NOT EXISTS public.site_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  menu_key text NOT NULL UNIQUE,
  location text NOT NULL DEFAULT 'main'
    CHECK (location IN ('main', 'header', 'footer', 'mobile', 'category', 'mega')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.site_menus(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.site_menu_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  link_type text NOT NULL DEFAULT 'custom'
    CHECK (link_type IN ('custom', 'page', 'category', 'article', 'external')),
  href text,
  target_id uuid,
  position int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_menu_items_menu_pos_idx ON public.site_menu_items (menu_id, position);

INSERT INTO public.site_menus (name, menu_key, location)
VALUES
  ('Main Menu', 'main', 'main'),
  ('Header Menu', 'header', 'header'),
  ('Footer Menu', 'footer', 'footer'),
  ('Mobile Menu', 'mobile', 'mobile'),
  ('Category Menu', 'category', 'category'),
  ('Mega Menu', 'mega', 'mega')
ON CONFLICT (menu_key) DO NOTHING;

-- ============ Footer CMS ============
CREATE TABLE IF NOT EXISTS public.footer_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  copyright_text text,
  newsletter_enabled boolean NOT NULL DEFAULT true,
  newsletter_heading text,
  newsletter_blurb text,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.footer_settings (id, copyright_text, newsletter_heading)
VALUES (true, '© Diplomacy Lens. All rights reserved.', 'Newsletter')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.footer_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.footer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES public.footer_columns(id) ON DELETE CASCADE,
  label text NOT NULL,
  href text NOT NULL,
  position int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Editorial calendar extras ============
CREATE TABLE IF NOT EXISTS public.editorial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  event_type text NOT NULL DEFAULT 'event'
    CHECK (event_type IN ('event', 'deadline', 'campaign')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editorial_events_starts_idx ON public.editorial_events (starts_at);

-- ============ QA / UAT ============
CREATE TABLE IF NOT EXISTS public.qa_test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  suite_type text NOT NULL DEFAULT 'functional'
    CHECK (suite_type IN (
      'functional', 'ui', 'api', 'security', 'performance',
      'browser', 'mobile', 'regression', 'uat'
    )),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qa_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id uuid REFERENCES public.qa_test_suites(id) ON DELETE SET NULL,
  title text NOT NULL,
  steps text,
  expected_result text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'passed', 'failed', 'blocked')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qa_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
  related_case_id uuid REFERENCES public.qa_test_cases(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qa_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_label text NOT NULL,
  notes text,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ RLS ============
ALTER TABLE public.news_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_tip_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_signoffs ENABLE ROW LEVEL SECURITY;

-- Public read for published pages / enabled menus / footer
DROP POLICY IF EXISTS cms_pages_public_read ON public.cms_pages;
CREATE POLICY cms_pages_public_read ON public.cms_pages
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS site_menus_public_read ON public.site_menus;
CREATE POLICY site_menus_public_read ON public.site_menus
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS site_menu_items_public_read ON public.site_menu_items;
CREATE POLICY site_menu_items_public_read ON public.site_menu_items
  FOR SELECT TO anon, authenticated
  USING (
    enabled = true
    AND EXISTS (SELECT 1 FROM public.site_menus m WHERE m.id = menu_id AND m.enabled = true)
  );

DROP POLICY IF EXISTS footer_settings_public_read ON public.footer_settings;
CREATE POLICY footer_settings_public_read ON public.footer_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS footer_columns_public_read ON public.footer_columns;
CREATE POLICY footer_columns_public_read ON public.footer_columns
  FOR SELECT TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS footer_links_public_read ON public.footer_links;
CREATE POLICY footer_links_public_read ON public.footer_links
  FOR SELECT TO anon, authenticated
  USING (
    enabled = true
    AND EXISTS (SELECT 1 FROM public.footer_columns c WHERE c.id = column_id AND c.enabled = true)
  );

-- Staff policies via has_permission where available
DO $$
BEGIN
  -- news tips
  DROP POLICY IF EXISTS news_tips_staff_all ON public.news_tips;
  CREATE POLICY news_tips_staff_all ON public.news_tips
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'articles:view'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'articles:edit_own') OR app_hidden.has_permission(auth.uid(), 'articles:edit_all') OR app_hidden.has_permission(auth.uid(), 'articles:review'));

  DROP POLICY IF EXISTS news_tip_sources_staff_all ON public.news_tip_sources;
  CREATE POLICY news_tip_sources_staff_all ON public.news_tip_sources
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'articles:review'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'articles:review'));

  DROP POLICY IF EXISTS cms_pages_staff_all ON public.cms_pages;
  CREATE POLICY cms_pages_staff_all ON public.cms_pages
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS cms_page_revisions_staff_all ON public.cms_page_revisions;
  CREATE POLICY cms_page_revisions_staff_all ON public.cms_page_revisions
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS cms_page_templates_staff_read ON public.cms_page_templates;
  CREATE POLICY cms_page_templates_staff_read ON public.cms_page_templates
    FOR SELECT TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS site_menus_staff_all ON public.site_menus;
  CREATE POLICY site_menus_staff_all ON public.site_menus
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS site_menu_items_staff_all ON public.site_menu_items;
  CREATE POLICY site_menu_items_staff_all ON public.site_menu_items
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS footer_settings_staff_all ON public.footer_settings;
  CREATE POLICY footer_settings_staff_all ON public.footer_settings
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS footer_columns_staff_all ON public.footer_columns;
  CREATE POLICY footer_columns_staff_all ON public.footer_columns
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS footer_links_staff_all ON public.footer_links;
  CREATE POLICY footer_links_staff_all ON public.footer_links
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS editorial_events_staff_all ON public.editorial_events;
  CREATE POLICY editorial_events_staff_all ON public.editorial_events
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'articles:view'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'articles:review') OR app_hidden.has_permission(auth.uid(), 'articles:edit_all'));

  DROP POLICY IF EXISTS qa_suites_staff_all ON public.qa_test_suites;
  CREATE POLICY qa_suites_staff_all ON public.qa_test_suites
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS qa_cases_staff_all ON public.qa_test_cases;
  CREATE POLICY qa_cases_staff_all ON public.qa_test_cases
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS qa_bugs_staff_all ON public.qa_bugs;
  CREATE POLICY qa_bugs_staff_all ON public.qa_bugs
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));

  DROP POLICY IF EXISTS qa_signoffs_staff_all ON public.qa_signoffs;
  CREATE POLICY qa_signoffs_staff_all ON public.qa_signoffs
    FOR ALL TO authenticated
    USING (app_hidden.has_permission(auth.uid(), 'settings:manage'))
    WITH CHECK (app_hidden.has_permission(auth.uid(), 'settings:manage'));
END $$;
