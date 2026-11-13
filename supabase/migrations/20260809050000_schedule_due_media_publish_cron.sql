-- Schedule automatic publish for due media modules when pg_cron is available.
-- Mirrors 20260725100000_public_visibility_and_scheduling_fix.sql for articles.
-- Safe to re-run: unschedules the named job before creating it.

CREATE OR REPLACE FUNCTION public.publish_due_media_modules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.publish_due_videos();
  PERFORM public.publish_due_podcast_episodes();
  PERFORM public.publish_due_infographics();
  PERFORM public.publish_due_epaper_editions();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_media_modules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_media_modules() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'publish-due-media-modules';

    PERFORM cron.schedule(
      'publish-due-media-modules',
      '*/5 * * * *',
      'SELECT public.publish_due_media_modules()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron media scheduling skipped: %', SQLERRM;
END $$;
