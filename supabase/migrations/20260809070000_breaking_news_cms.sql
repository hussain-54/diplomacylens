-- Breaking News CMS: full editorial module (replaces ticker_items as source of truth).

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
    ELSE false
  END;
$$;

-- ============ Tables ============
CREATE TABLE IF NOT EXISTS public.breaking_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  description text,
  category_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  media_url text,
  media_type text CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'audio')),
  breaking_type text NOT NULL DEFAULT 'simple'
    CHECK (breaking_type IN ('simple', 'article', 'media')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal')),
  priority_rank integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'expired', 'archived')),
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  show_on_ticker boolean NOT NULL DEFAULT true,
  show_on_homepage_alert boolean NOT NULL DEFAULT true,
  notification_enabled boolean NOT NULL DEFAULT false,
  notification_sent boolean NOT NULL DEFAULT false,
  notification_sent_at timestamptz,
  notification_id text,
  view_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS breaking_news_status_idx ON public.breaking_news (status, priority_rank, sort_order);
CREATE INDEX IF NOT EXISTS breaking_news_active_window_idx ON public.breaking_news (status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS breaking_news_published_idx ON public.breaking_news (published_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.breaking_news_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  module_enabled boolean NOT NULL DEFAULT true,
  default_expiration_hours integer NOT NULL DEFAULT 24,
  default_priority text NOT NULL DEFAULT 'normal',
  max_active_items integer NOT NULL DEFAULT 10,
  ticker_enabled boolean NOT NULL DEFAULT true,
  ticker_position text NOT NULL DEFAULT 'top',
  ticker_style text NOT NULL DEFAULT 'scroll',
  ticker_max_items integer NOT NULL DEFAULT 8,
  ticker_speed text NOT NULL DEFAULT 'medium',
  ticker_show_timestamp boolean NOT NULL DEFAULT false,
  ticker_show_category boolean NOT NULL DEFAULT true,
  ticker_show_icon boolean NOT NULL DEFAULT true,
  ticker_source text NOT NULL DEFAULT 'automatic',
  homepage_alert_enabled boolean NOT NULL DEFAULT true,
  homepage_alert_max integer NOT NULL DEFAULT 1,
  homepage_alert_duration_seconds integer NOT NULL DEFAULT 0,
  homepage_alert_auto_dismiss boolean NOT NULL DEFAULT false,
  homepage_alert_manual_dismiss boolean NOT NULL DEFAULT true,
  homepage_alert_show_desktop boolean NOT NULL DEFAULT true,
  homepage_alert_show_mobile boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  push_default_on_publish boolean NOT NULL DEFAULT false,
  realtime_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.breaking_news_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.breaking_news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breaking_news_id uuid NOT NULL REFERENCES public.breaking_news(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'view', 'click', 'ticker_impression', 'alert_impression',
      'notification_sent', 'notification_open'
    )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS breaking_news_events_bn_idx
  ON public.breaking_news_events (breaking_news_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.breaking_news_notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breaking_news_id uuid NOT NULL REFERENCES public.breaking_news(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS breaking_news_notification_jobs_status_idx
  ON public.breaking_news_notification_jobs (status, created_at);

-- ============ Migrate ticker_items → breaking_news ============
INSERT INTO public.breaking_news (
  headline, description, priority, priority_rank, status, sort_order,
  show_on_ticker, show_on_homepage_alert, published_at, starts_at
)
SELECT
  t.text,
  NULL,
  'normal',
  3,
  CASE WHEN t.active THEN 'published' ELSE 'archived' END,
  t.sort_order,
  true,
  false,
  CASE WHEN t.active THEN COALESCE(t.created_at, now()) ELSE NULL END,
  CASE WHEN t.active THEN COALESCE(t.created_at, now()) ELSE NULL END
FROM public.ticker_items t
WHERE NOT EXISTS (
  SELECT 1 FROM public.breaking_news bn WHERE bn.headline = t.text
);

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.breaking_news_is_publicly_active(bn public.breaking_news)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    bn.status = 'published'
    AND (bn.starts_at IS NULL OR bn.starts_at <= now())
    AND (bn.expires_at IS NULL OR bn.expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.get_active_breaking_news(p_limit integer DEFAULT 20)
RETURNS SETOF public.breaking_news
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.breaking_news bn
  WHERE bn.status = 'published'
    AND (bn.starts_at IS NULL OR bn.starts_at <= now())
    AND (bn.expires_at IS NULL OR bn.expires_at > now())
  ORDER BY bn.priority_rank ASC, bn.sort_order ASC, bn.published_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

REVOKE ALL ON FUNCTION public.get_active_breaking_news(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_breaking_news(integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.publish_due_breaking_news()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Activate scheduled items whose start time has arrived
  UPDATE public.breaking_news
  SET status = 'published',
      published_at = COALESCE(published_at, now()),
      updated_at = now()
  WHERE status = 'scheduled'
    AND starts_at IS NOT NULL
    AND starts_at <= now()
    AND (expires_at IS NULL OR expires_at > now());

  -- Expire published items past expires_at
  UPDATE public.breaking_news
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'published'
    AND expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_breaking_news() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_breaking_news() TO service_role;

CREATE OR REPLACE FUNCTION public.publish_breaking_news_now(p_id uuid, p_send_push boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.breaking_news%ROWTYPE;
  job_id uuid;
BEGIN
  IF uid IS NULL OR NOT app_hidden.has_permission(uid, 'breaking_news:publish') THEN
    RAISE EXCEPTION 'Forbidden — missing breaking_news:publish';
  END IF;

  SELECT * INTO rec FROM public.breaking_news WHERE id = p_id;
  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Breaking news not found';
  END IF;

  UPDATE public.breaking_news
  SET status = 'published',
      published_at = now(),
      published_by = uid,
      starts_at = COALESCE(starts_at, now()),
      updated_by = uid,
      updated_at = now(),
      notification_enabled = CASE WHEN p_send_push THEN true ELSE notification_enabled END
  WHERE id = p_id
  RETURNING * INTO rec;

  IF p_send_push AND NOT COALESCE(rec.notification_sent, false) THEN
    INSERT INTO public.breaking_news_notification_jobs (breaking_news_id, status, payload, created_by)
    VALUES (
      p_id,
      'pending',
      jsonb_build_object(
        'title', 'BREAKING NEWS',
        'body', rec.headline,
        'breaking_news_id', p_id,
        'article_id', rec.article_id
      ),
      uid
    )
    RETURNING id INTO job_id;

    UPDATE public.breaking_news
    SET notification_enabled = true,
        notification_sent = true,
        notification_sent_at = now(),
        notification_id = job_id::text
    WHERE id = p_id;
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_logs (actor_id, action, entity_type, entity_id, summary, payload)
    VALUES (
      uid,
      'breaking_news_published',
      'breaking_news',
      p_id::text,
      'Breaking news published',
      jsonb_build_object('send_push', p_send_push, 'job_id', job_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'notification_job_id', job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_breaking_news_now(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_breaking_news_now(uuid, boolean) TO authenticated, service_role;

-- Hook into media publish orchestrator
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
  BEGIN PERFORM public.publish_due_breaking_news(); EXCEPTION WHEN undefined_function THEN NULL; END;
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
    OR app_hidden.has_permission(uid, 'breaking_news:publish')
  ) THEN
    RAISE EXCEPTION 'Forbidden — missing publish permission';
  END IF;

  BEGIN PERFORM public.publish_due_videos(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_podcast_episodes(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_infographics(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_epaper_editions(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_homepage_schedules(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_breaking_news(); EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN PERFORM public.publish_due_articles(); EXCEPTION WHEN undefined_function THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'ran_at', now());
END;
$$;

-- ============ RLS ============
ALTER TABLE public.breaking_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaking_news_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaking_news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaking_news_notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "breaking_news public read active" ON public.breaking_news;
CREATE POLICY "breaking_news public read active" ON public.breaking_news
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "breaking_news staff read" ON public.breaking_news;
CREATE POLICY "breaking_news staff read" ON public.breaking_news
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'breaking_news:view'));

DROP POLICY IF EXISTS "breaking_news staff write" ON public.breaking_news;
CREATE POLICY "breaking_news staff write" ON public.breaking_news
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'breaking_news:edit'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'breaking_news:edit'));

DROP POLICY IF EXISTS "breaking_news_settings public read" ON public.breaking_news_settings;
CREATE POLICY "breaking_news_settings public read" ON public.breaking_news_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "breaking_news_settings staff" ON public.breaking_news_settings;
CREATE POLICY "breaking_news_settings staff" ON public.breaking_news_settings
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'breaking_news:publish'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'breaking_news:publish'));

DROP POLICY IF EXISTS "breaking_news_events public insert" ON public.breaking_news_events;
CREATE POLICY "breaking_news_events public insert" ON public.breaking_news_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.breaking_news bn
      WHERE bn.id = breaking_news_id
        AND bn.status = 'published'
        AND (bn.starts_at IS NULL OR bn.starts_at <= now())
        AND (bn.expires_at IS NULL OR bn.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "breaking_news_events staff read" ON public.breaking_news_events;
CREATE POLICY "breaking_news_events staff read" ON public.breaking_news_events
  FOR SELECT TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'breaking_news:view'));

DROP POLICY IF EXISTS "breaking_news_jobs staff" ON public.breaking_news_notification_jobs;
CREATE POLICY "breaking_news_jobs staff" ON public.breaking_news_notification_jobs
  FOR ALL TO authenticated
  USING (app_hidden.has_permission(auth.uid(), 'breaking_news:publish'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'breaking_news:publish'));

GRANT SELECT ON public.breaking_news, public.breaking_news_settings TO anon, authenticated;
GRANT INSERT ON public.breaking_news_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breaking_news, public.breaking_news_settings,
  public.breaking_news_events, public.breaking_news_notification_jobs TO authenticated;
GRANT ALL ON public.breaking_news, public.breaking_news_settings,
  public.breaking_news_events, public.breaking_news_notification_jobs TO service_role;

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.breaking_news;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.breaking_news_settings;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
