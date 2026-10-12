-- Run once in the Supabase SQL editor AFTER deploying, replacing the two placeholders.
-- Calls the app every 15 minutes to push due reminders (Vercel's free cron is daily-only).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'bens-meals-reminders',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-APP.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
