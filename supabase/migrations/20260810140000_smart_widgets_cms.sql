-- Smart Widgets CMS for Diplomacy Lens (weather, islamic, currency, markets placeholders).

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
    WHEN _permission = 'smart_widgets:view' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY[
          'editor_in_chief', 'managing_editor', 'section_editor'
        ])
    )
    WHEN _permission = 'smart_widgets:manage' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    WHEN _permission IN ('smart_widgets:configure', 'smart_widgets:analytics') THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text = ANY (ARRAY['editor_in_chief', 'managing_editor'])
    )
    ELSE false
  END;
$$;

-- ============ Providers ============
CREATE TABLE IF NOT EXISTS public.smart_widget_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL,
  base_url text,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Slot catalog ============
CREATE TABLE IF NOT EXISTS public.smart_widget_slots (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Widget instances ============
CREATE TABLE IF NOT EXISTS public.smart_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  widget_type text NOT NULL,
  category text NOT NULL,
  provider_key text REFERENCES public.smart_widget_providers(key) ON UPDATE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  display jsonb NOT NULL DEFAULT '{}'::jsonb,
  cache_ttl_seconds int NOT NULL DEFAULT 900,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_widgets_category_idx ON public.smart_widgets(category);
CREATE INDEX IF NOT EXISTS smart_widgets_enabled_idx ON public.smart_widgets(enabled);

-- ============ Placements ============
CREATE TABLE IF NOT EXISTS public.smart_widget_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL REFERENCES public.smart_widgets(id) ON DELETE CASCADE,
  slot_key text NOT NULL REFERENCES public.smart_widget_slots(key) ON UPDATE CASCADE,
  page_type text NOT NULL DEFAULT 'homepage',
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (widget_id, slot_key, page_type)
);

CREATE INDEX IF NOT EXISTS smart_widget_placements_page_slot_idx
  ON public.smart_widget_placements(page_type, slot_key, enabled);

-- ============ Targeting rules ============
CREATE TABLE IF NOT EXISTS public.smart_widget_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid REFERENCES public.smart_widget_placements(id) ON DELETE CASCADE,
  widget_id uuid REFERENCES public.smart_widgets(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  device text,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  category_slug text,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Alerts ============
CREATE TABLE IF NOT EXISTS public.smart_widget_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid REFERENCES public.smart_widgets(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info',
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Analytics ============
CREATE TABLE IF NOT EXISTS public.smart_widget_analytics_events (
  id bigserial PRIMARY KEY,
  widget_id uuid REFERENCES public.smart_widgets(id) ON DELETE SET NULL,
  placement_id uuid REFERENCES public.smart_widget_placements(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  page_type text,
  slot_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_widget_analytics_widget_idx
  ON public.smart_widget_analytics_events(widget_id, created_at DESC);

-- ============ API logs ============
CREATE TABLE IF NOT EXISTS public.smart_widget_api_logs (
  id bigserial PRIMARY KEY,
  provider_key text,
  widget_id uuid REFERENCES public.smart_widgets(id) ON DELETE SET NULL,
  status_code int,
  ok boolean NOT NULL DEFAULT false,
  latency_ms int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Response cache ============
CREATE TABLE IF NOT EXISTS public.smart_widget_cache (
  cache_key text PRIMARY KEY,
  widget_id uuid REFERENCES public.smart_widgets(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS smart_widget_cache_expires_idx ON public.smart_widget_cache(expires_at);

-- ============ Module settings (singleton) ============
CREATE TABLE IF NOT EXISTS public.smart_widget_settings (
  id int PRIMARY KEY CHECK (id = 1),
  module_enabled boolean NOT NULL DEFAULT true,
  default_cache_ttl_seconds int NOT NULL DEFAULT 900,
  stale_while_revalidate_seconds int NOT NULL DEFAULT 300,
  weather_lat numeric,
  weather_lon numeric,
  weather_city_label text DEFAULT 'Islamabad',
  prayer_city text DEFAULT 'Islamabad',
  prayer_country text DEFAULT 'Pakistan',
  currency_base text DEFAULT 'USD',
  currency_symbols jsonb NOT NULL DEFAULT '["EUR","GBP","PKR","SAR","AED"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.smart_widget_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============ Activity feed ============
CREATE TABLE IF NOT EXISTS public.smart_widget_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Seeds: slots ============
INSERT INTO public.smart_widget_slots (key, label, description, sort_order) VALUES
  ('header', 'Header', 'Above masthead strip', 10),
  ('top_bar', 'Top bar', 'Utility strip under header', 20),
  ('before_content', 'Before content', 'Above main page content', 30),
  ('in_content', 'In content', 'Inline within content', 40),
  ('sidebar', 'Sidebar', 'Side column widgets', 50),
  ('after_content', 'After content', 'Below main content', 60),
  ('related_content', 'Related content', 'Near related modules', 70),
  ('footer', 'Footer', 'Footer region', 80)
ON CONFLICT (key) DO NOTHING;

-- ============ Seeds: providers ============
INSERT INTO public.smart_widget_providers (key, label, category, base_url, enabled, config) VALUES
  ('open_meteo', 'Open-Meteo', 'weather', 'https://api.open-meteo.com', true, '{}'::jsonb),
  ('aladhan', 'Aladhan', 'islamic', 'https://api.aladhan.com', true, '{}'::jsonb),
  ('frankfurter', 'Frankfurter', 'currency', 'https://api.frankfurter.app', true, '{}'::jsonb),
  ('manual', 'Manual / Not configured', 'markets', null, false, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ Seeds: catalog widgets ============
INSERT INTO public.smart_widgets (slug, title, widget_type, category, provider_key, enabled, config) VALUES
  ('weather-open-meteo', 'Weather (Open-Meteo)', 'weather', 'weather', 'open_meteo', false, '{}'::jsonb),
  ('prayer-aladhan', 'Prayer Times (Aladhan)', 'prayer_times', 'islamic', 'aladhan', false, '{}'::jsonb),
  ('currency-frankfurter', 'Currency Rates (Frankfurter)', 'currency_rates', 'currency', 'frankfurter', false, '{}'::jsonb),
  ('gold-metals-manual', 'Gold & Metals', 'gold_metals', 'gold_metals', 'manual', false, '{"status":"not_configured"}'::jsonb),
  ('markets-psx-manual', 'PSX / Markets', 'markets', 'markets', 'manual', false, '{"status":"not_configured"}'::jsonb),
  ('energy-manual', 'Energy Prices', 'energy', 'energy', 'manual', false, '{"status":"not_configured"}'::jsonb),
  ('sports-manual', 'Sports Scores', 'sports', 'sports', 'manual', false, '{"status":"not_configured"}'::jsonb),
  ('datetime-local', 'Date & Time', 'datetime', 'date_time', null, true, '{"timezone":"Asia/Karachi"}'::jsonb),
  ('pakistan-context', 'Pakistan Brief', 'pakistan_brief', 'pakistan', null, false, '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ============ RLS ============
ALTER TABLE public.smart_widget_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_widget_activity ENABLE ROW LEVEL SECURITY;

-- Staff read
DROP POLICY IF EXISTS "smart_widget_providers staff read" ON public.smart_widget_providers;
CREATE POLICY "smart_widget_providers staff read" ON public.smart_widget_providers
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:view'));

DROP POLICY IF EXISTS "smart_widget_providers staff write" ON public.smart_widget_providers;
CREATE POLICY "smart_widget_providers staff write" ON public.smart_widget_providers
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:configure'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:configure'));

DROP POLICY IF EXISTS "smart_widget_slots staff read" ON public.smart_widget_slots;
CREATE POLICY "smart_widget_slots staff read" ON public.smart_widget_slots
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:view'));

DROP POLICY IF EXISTS "smart_widget_slots public read" ON public.smart_widget_slots;
CREATE POLICY "smart_widget_slots public read" ON public.smart_widget_slots
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "smart_widgets staff read" ON public.smart_widgets;
CREATE POLICY "smart_widgets staff read" ON public.smart_widgets
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:view'));

DROP POLICY IF EXISTS "smart_widgets public read enabled" ON public.smart_widgets;
CREATE POLICY "smart_widgets public read enabled" ON public.smart_widgets
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS "smart_widgets staff write" ON public.smart_widgets;
CREATE POLICY "smart_widgets staff write" ON public.smart_widgets
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'));

DROP POLICY IF EXISTS "smart_widget_placements staff read" ON public.smart_widget_placements;
CREATE POLICY "smart_widget_placements staff read" ON public.smart_widget_placements
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:view'));

DROP POLICY IF EXISTS "smart_widget_placements public read" ON public.smart_widget_placements;
CREATE POLICY "smart_widget_placements public read" ON public.smart_widget_placements
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS "smart_widget_placements staff write" ON public.smart_widget_placements;
CREATE POLICY "smart_widget_placements staff write" ON public.smart_widget_placements
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'));

DROP POLICY IF EXISTS "smart_widget_rules staff" ON public.smart_widget_rules;
CREATE POLICY "smart_widget_rules staff" ON public.smart_widget_rules
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'));

DROP POLICY IF EXISTS "smart_widget_alerts staff" ON public.smart_widget_alerts;
CREATE POLICY "smart_widget_alerts staff" ON public.smart_widget_alerts
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'));

DROP POLICY IF EXISTS "smart_widget_analytics staff read" ON public.smart_widget_analytics_events;
CREATE POLICY "smart_widget_analytics staff read" ON public.smart_widget_analytics_events
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:analytics'));

DROP POLICY IF EXISTS "smart_widget_analytics insert" ON public.smart_widget_analytics_events;
CREATE POLICY "smart_widget_analytics insert" ON public.smart_widget_analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "smart_widget_api_logs staff" ON public.smart_widget_api_logs;
CREATE POLICY "smart_widget_api_logs staff" ON public.smart_widget_api_logs
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:configure'));

DROP POLICY IF EXISTS "smart_widget_cache public read" ON public.smart_widget_cache;
CREATE POLICY "smart_widget_cache public read" ON public.smart_widget_cache
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "smart_widget_cache staff write" ON public.smart_widget_cache;
CREATE POLICY "smart_widget_cache staff write" ON public.smart_widget_cache
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'));

DROP POLICY IF EXISTS "smart_widget_cache public write" ON public.smart_widget_cache;
CREATE POLICY "smart_widget_cache public write" ON public.smart_widget_cache
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "smart_widget_cache public update" ON public.smart_widget_cache;
CREATE POLICY "smart_widget_cache public update" ON public.smart_widget_cache
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "smart_widget_settings staff read" ON public.smart_widget_settings;
CREATE POLICY "smart_widget_settings staff read" ON public.smart_widget_settings
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:view'));

DROP POLICY IF EXISTS "smart_widget_settings staff write" ON public.smart_widget_settings;
CREATE POLICY "smart_widget_settings staff write" ON public.smart_widget_settings
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:configure'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:configure'));

DROP POLICY IF EXISTS "smart_widget_settings public read" ON public.smart_widget_settings;
CREATE POLICY "smart_widget_settings public read" ON public.smart_widget_settings
  FOR SELECT TO anon, authenticated
  USING (module_enabled = true);

DROP POLICY IF EXISTS "smart_widget_activity staff" ON public.smart_widget_activity;
CREATE POLICY "smart_widget_activity staff" ON public.smart_widget_activity
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'smart_widgets:view'));

DROP POLICY IF EXISTS "smart_widget_activity staff insert" ON public.smart_widget_activity;
CREATE POLICY "smart_widget_activity staff insert" ON public.smart_widget_activity
  FOR INSERT TO authenticated
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'smart_widgets:manage'));

GRANT SELECT ON public.smart_widget_slots, public.smart_widgets, public.smart_widget_placements,
  public.smart_widget_cache, public.smart_widget_settings TO anon, authenticated;
GRANT SELECT, INSERT ON public.smart_widget_analytics_events TO anon, authenticated;
GRANT SELECT ON public.smart_widget_providers, public.smart_widget_rules, public.smart_widget_alerts,
  public.smart_widget_api_logs, public.smart_widget_activity TO authenticated;
GRANT ALL ON public.smart_widgets, public.smart_widget_placements, public.smart_widget_rules,
  public.smart_widget_alerts, public.smart_widget_cache, public.smart_widget_settings,
  public.smart_widget_providers, public.smart_widget_activity TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.smart_widget_analytics_events_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.smart_widget_api_logs_id_seq TO authenticated;
