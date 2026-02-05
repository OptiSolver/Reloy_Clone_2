-- scripts/demo/demo_reset_all.sql
-- Reset COMPLETO por demo_run_id:
-- - events (payload.demo_run_id)
-- - points_ledger por source_event_id (events demo)
-- - reward_redemptions referenciadas por events redeem demo
-- - rewards creados en esta corrida (rewards.meta.demo_run_id)
--
-- Uso (preview):
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_xxx' -v do_delete=0 -f scripts/demo/demo_reset_all.sql
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_xxx' -v do_delete=false -f scripts/demo/demo_reset_all.sql
--
-- Uso (delete real):
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_xxx' -v do_delete=1 -f scripts/demo/demo_reset_all.sql
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_xxx' -v do_delete=true -f scripts/demo/demo_reset_all.sql

\set ON_ERROR_STOP on

-- =========================
-- 0) Validaciones de vars
-- =========================
\if :{?merchant_id}
\else
  \echo 'ERROR: falta -v merchant_id=...'
  \quit 1
\endif

\if :{?demo_run_id}
\else
  \echo 'ERROR: falta -v demo_run_id=...'
  \quit 1
\endif

\if :{?do_delete}
\else
  \set do_delete 0
\endif

-- =========================
-- Normalizar do_delete a booleano
-- acepta: 0/1 o false/true
-- =========================
\set do_delete_bool false
\if :do_delete
  \set do_delete_bool true
\endif

\echo '------------------------------------------------------------'
\echo 'DEMO RESET ALL'
\echo ' merchant_id    = ' :merchant_id
\echo ' demo_run_id    = ' :demo_run_id
\echo ' do_delete      = ' :do_delete
\echo ' do_delete_bool = ' :do_delete_bool
\echo '------------------------------------------------------------'

-- =========================
-- 1) Preview (conteos)
-- =========================
WITH demo_events AS (
  SELECT id, type, payload
  FROM events
  WHERE merchant_id = :'merchant_id'
    AND payload->>'demo_run_id' = :'demo_run_id'
),
demo_redeems AS (
  SELECT (payload->>'reward_redemption_id')::uuid AS reward_redemption_id
  FROM demo_events
  WHERE type = 'redeem'
    AND (payload ? 'reward_redemption_id')
),
demo_rewards AS (
  SELECT id
  FROM rewards
  WHERE merchant_id = :'merchant_id'
    AND meta->>'demo_run_id' = :'demo_run_id'
)
SELECT
  (SELECT count(*) FROM demo_events) AS events_to_delete,
  (SELECT count(*) FROM points_ledger pl
     WHERE pl.source_event_id IN (SELECT id FROM demo_events)
  ) AS ledger_to_delete,
  (SELECT count(*) FROM reward_redemptions rr
     WHERE rr.id IN (SELECT reward_redemption_id FROM demo_redeems)
  ) AS redemptions_to_delete,
  (SELECT count(*) FROM demo_rewards) AS rewards_to_delete;

\echo ''

-- =========================
-- 2) Delete real (opcional)
-- =========================
\if :do_delete_bool
BEGIN;

-- 2.1) points_ledger por source_event_id de events demo
DELETE FROM points_ledger pl
WHERE pl.source_event_id IN (
  SELECT e.id
  FROM events e
  WHERE e.merchant_id = :'merchant_id'
    AND e.payload->>'demo_run_id' = :'demo_run_id'
);

-- 2.2) reward_redemptions referenciadas por redeem demo
DELETE FROM reward_redemptions rr
WHERE rr.id IN (
  SELECT (e.payload->>'reward_redemption_id')::uuid
  FROM events e
  WHERE e.merchant_id = :'merchant_id'
    AND e.payload->>'demo_run_id' = :'demo_run_id'
    AND e.type = 'redeem'
    AND (e.payload ? 'reward_redemption_id')
);

-- 2.3) events demo
DELETE FROM events e
WHERE e.merchant_id = :'merchant_id'
  AND e.payload->>'demo_run_id' = :'demo_run_id';

-- 2.4) rewards creados en la corrida (meta.demo_run_id)
DELETE FROM rewards r
WHERE r.merchant_id = :'merchant_id'
  AND r.meta->>'demo_run_id' = :'demo_run_id';

COMMIT;

\echo ''
\echo 'DELETE OK. Re-chequeando conteos...'

WITH demo_events AS (
  SELECT id, type, payload
  FROM events
  WHERE merchant_id = :'merchant_id'
    AND payload->>'demo_run_id' = :'demo_run_id'
),
demo_redeems AS (
  SELECT (payload->>'reward_redemption_id')::uuid AS reward_redemption_id
  FROM demo_events
  WHERE type = 'redeem'
    AND (payload ? 'reward_redemption_id')
),
demo_rewards AS (
  SELECT id
  FROM rewards
  WHERE merchant_id = :'merchant_id'
    AND meta->>'demo_run_id' = :'demo_run_id'
)
SELECT
  (SELECT count(*) FROM demo_events) AS events_left,
  (SELECT count(*) FROM points_ledger pl
     WHERE pl.source_event_id IN (SELECT id FROM demo_events)
  ) AS ledger_left,
  (SELECT count(*) FROM reward_redemptions rr
     WHERE rr.id IN (SELECT reward_redemption_id FROM demo_redeems)
  ) AS redemptions_left,
  (SELECT count(*) FROM demo_rewards) AS rewards_left;

\else
\echo 'MODO PREVIEW (no se borró nada). Para borrar: -v do_delete=1 (o true)'
\endif