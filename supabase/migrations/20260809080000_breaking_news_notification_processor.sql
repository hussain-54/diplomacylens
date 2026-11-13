-- Process pending breaking-news push jobs (service_role / Edge Function).
-- Call via cron or after publish; does not send FCM itself — marks jobs and
-- returns payload for an external worker that holds provider credentials.

CREATE OR REPLACE FUNCTION public.process_breaking_news_notification_jobs(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  processed integer := 0;
  job record;
  results jsonb := '[]'::jsonb;
BEGIN
  FOR job IN
    SELECT j.*
    FROM public.breaking_news_notification_jobs j
    WHERE j.status = 'pending'
    ORDER BY j.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.breaking_news_notification_jobs
    SET status = 'processing'
    WHERE id = job.id;

    results := results || jsonb_build_array(
      jsonb_build_object(
        'job_id', job.id,
        'breaking_news_id', job.breaking_news_id,
        'payload', job.payload
      )
    );
    processed := processed + 1;

    -- Mark sent at queue handoff; external worker should set failed on delivery error.
    UPDATE public.breaking_news_notification_jobs
    SET status = 'sent', processed_at = now()
    WHERE id = job.id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'processed', processed, 'jobs', results);
END;
$$;

REVOKE ALL ON FUNCTION public.process_breaking_news_notification_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_breaking_news_notification_jobs(integer) TO service_role;

-- Optional: allow staff with publish permission to peek/process in CMS (no secrets exposed)
CREATE OR REPLACE FUNCTION public.run_breaking_news_notification_jobs(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT app_hidden.has_permission(uid, 'breaking_news:publish') THEN
    RAISE EXCEPTION 'Forbidden — missing breaking_news:publish';
  END IF;
  RETURN public.process_breaking_news_notification_jobs(p_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.run_breaking_news_notification_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_breaking_news_notification_jobs(integer) TO authenticated, service_role;
