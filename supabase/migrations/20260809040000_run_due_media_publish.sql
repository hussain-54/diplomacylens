-- Allow authorized CMS staff to run due-media publish (manual trigger).
-- Cron with service_role remains the primary path (see MEDIA_SCHEDULING.md).

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
  ) THEN
    RAISE EXCEPTION 'Forbidden — missing publish permission';
  END IF;

  PERFORM public.publish_due_videos();
  PERFORM public.publish_due_podcast_episodes();
  PERFORM public.publish_due_infographics();
  PERFORM public.publish_due_epaper_editions();

  BEGIN
    PERFORM public.publish_due_articles();
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.run_due_media_publish() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_due_media_publish() TO authenticated, service_role;
