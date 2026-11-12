-- Infrastructure extension tables live in cron, not the 16-table academic/game schema.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
SELECT cron.schedule('truco-arena-online-deadlines','1 second',$job$
 BEGIN;
 SET LOCAL ROLE ta_timer_runner;
 SET LOCAL statement_timeout='5s';
 SELECT truco_arena_der.ta_online_tick();
 COMMIT;
$job$);
-- Bound only this project's high-frequency scheduler logs, never game history or other jobs.
SELECT cron.schedule('truco-arena-deadline-log-retention','17 * * * *',$job$
 DELETE FROM cron.job_run_details WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='truco-arena-online-deadlines') AND end_time<clock_timestamp()-interval '6 hours';
$job$);
