-- Public visibility hardening + scheduled publishing automation.
--
-- 1. Fix the soft-delete RLS hole: the original permissive policy
--    "published articles public" (status = 'published' only) was never
--    dropped by 20260720200000, so soft-deleted published articles stayed
--    publicly readable (permissive SELECT policies combine with OR).
-- 2. Gate public reads on expiry and publish time as well.
-- 3. Stop counting views for soft-deleted articles.
-- 4. Schedule publish_due_articles() with pg_cron when available so
--    scheduled articles actually go live without manual action.

-- ============ 1 + 2: single authoritative public read policy ============

DROP POLICY IF EXISTS "published articles public" ON public.articles;
DROP POLICY IF EXISTS "Public read published articles" ON public.articles;
DROP POLICY IF EXISTS articles_public_read ON public.articles;
DROP POLICY IF EXISTS articles_public_read_published ON public.articles;

CREATE POLICY articles_public_read_published ON public.articles
  FOR SELECT
  USING (
    status = 'published'::public.article_status
    AND deleted_at IS NULL
    AND (published_at IS NULL OR published_at <= now())
    AND (expiry_at IS NULL OR expiry_at > now())
  );

-- ============ 3: view counter ignores deleted articles ============

CREATE OR REPLACE FUNCTION public.increment_article_view(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.articles
    WHERE id = p_article_id
      AND status = 'published'
      AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.article_daily_metrics (article_id, metric_date, views)
  VALUES (p_article_id, current_date, 1)
  ON CONFLICT (article_id, metric_date)
  DO UPDATE SET views = public.article_daily_metrics.views + 1;
END;
$$;

-- ============ 4: run scheduled publishing every minute via pg_cron ============

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- Remove a previous job with the same name before re-adding.
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'publish-due-articles';
    PERFORM cron.schedule(
      'publish-due-articles',
      '* * * * *',
      'SELECT public.publish_due_articles()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
