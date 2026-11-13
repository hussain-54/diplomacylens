# Podcast, Infographic & Video scheduling

Call these with the service role (pg_cron or Edge Function), same pattern as ePaper:

```sql
select public.publish_due_media_modules();
-- or individually:
select public.publish_due_podcast_episodes();
select public.publish_due_infographics();
select public.publish_due_epaper_editions();
select public.publish_due_videos();
```

Example pg_cron (every 5 minutes):

```sql
select cron.schedule(
  'publish-due-media-modules',
  '*/5 * * * *',
  $$ select public.publish_due_media_modules(); $$
);
```

Applying `20260809050000_schedule_due_media_publish_cron.sql` creates
`publish_due_media_modules()` and registers that job when `pg_cron` is enabled
(no-op otherwise). Homepage schedules are included via
`publish_due_homepage_schedules()` (see `20260809060000_homepage_builder.sql`).
Breaking news activate/expire via `publish_due_breaking_news()`
(`20260809070000_breaking_news_cms.sql`).

Do not rely on browser timers for publication.

## Manual staff trigger

Authorized CMS users can also call:

```sql
select public.run_due_media_publish();
```

from the admin **Publishing** page (`/admin/publishing`), after applying
`20260809040000_run_due_media_publish.sql`.
