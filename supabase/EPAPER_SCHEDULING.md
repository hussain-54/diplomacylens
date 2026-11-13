# ePaper scheduling (Supabase / cron)

The function `public.publish_due_epaper_editions()` flips `status = 'scheduled'`
rows to `published` when `scheduled_for` (or `published_at`) is due.

Schedule it with one of:

## Option A — pg_cron (if enabled on the project)

```sql
select cron.schedule(
  'publish-due-epaper',
  '*/5 * * * *',
  $$ select public.publish_due_epaper_editions(); $$
);
```

## Option B — Supabase Edge Function + Dashboard cron

Invoke via service role:

```sql
select public.publish_due_epaper_editions();
```

Do not rely on browser timers for publication.
