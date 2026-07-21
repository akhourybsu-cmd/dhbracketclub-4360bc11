# READSHIFT — scheduled advancement setup

`readshift-advance` advances games whose phase deadline has passed. It is
callable two ways:

1. **Request-time fallback (already wired, no setup needed).** Whenever a
   participant opens a READSHIFT game, the client calls
   `readshift-advance { game_id, trigger: 'advance' }`. The function
   re-checks the deadline server-side and advances if due. This means a
   game never stalls while anyone is engaging with it, and no single
   inactive player can block progress.

2. **Scheduler scan (recommended, one-time setup).** A `pg_cron` job calls
   the function in `scan` mode every few minutes so games advance even when
   nobody has the app open. This requires the real `CRON_SHARED_SECRET`
   (a server secret, intentionally not committed), so run it ONCE in the
   Supabase SQL editor (or add it as a migration with the secret filled in):

```sql
-- Requires: create extension if not exists pg_cron; create extension if not exists pg_net;
select cron.unschedule('readshift-advance-scan') where exists (
  select 1 from cron.job where jobname = 'readshift-advance-scan'
);
select cron.schedule(
  'readshift-advance-scan',
  '*/10 * * * *',                     -- every 10 minutes
  $$
  select net.http_post(
    url := 'https://wnurxuvwljjbwmtoeqnm.supabase.co/functions/v1/readshift-advance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SUPABASE_ANON_KEY>',
      'x-cron-secret', '<CRON_SHARED_SECRET>'
    ),
    body := jsonb_build_object('mode', 'scan')
  );
  $$
);
```

`[functions.readshift-advance] verify_jwt = false` is already set in
`supabase/config.toml` so the cron call (which carries no user JWT) is
accepted; the function validates `x-cron-secret` itself.
