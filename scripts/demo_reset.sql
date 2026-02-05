-- scripts/demo_reset.sql
-- Demo reset por demo_run_id (events + points_ledger + reward_redemptions)
--
-- Uso (preview):
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_2026_02_04_run_01' -v do_delete=0 -f scripts/demo_reset.sql
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_2026_02_04_run_01' -v do_delete=false -f scripts/demo_reset.sql
--
-- Uso (delete real):
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_2026_02_04_run_01' -v do_delete=1 -f scripts/demo_reset.sql
--   psql "$DATABASE_URL" -v merchant_id='UUID' -v demo_run_id='demo_2026_02_04_run_01' -v do_delete=true -f scripts/demo_reset.sql
--
-- Notas:
-- - Si hay events tipo 'redeem' con payload.reward_redemption_id, también borra esas reward_redemptions.
-- - points_ledger se borra por source_event_id (id de event demo).
-- - Protege: si falta merchant_id o demo_run_id, aborta.

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
-- Normalizar do_delete a booleano (acepta 0/1 o true/false)
-- Regla:
--   1 / true  => borrar
--   0 / false => preview
-- =========================
\set do_delete_bool false
\if :do_delete
  \set do_delete_bool true
\endif
\if :do_delete = '1'
  \set do_delete_bool true
\endif
\if :do_delete = 'true'
  \set do_delete_bool true
\endif

\echo '------------------------------------------------------------'
\echo 'DEMO RESET'
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
)
SELECT
  (SELECT count(*) FROM demo_events) AS events_to_delete,
  (SELECT count(*) FROM points_ledger pl
     WHERE pl.source_event_id IN (SELECT id FROM demo_events)
  ) AS ledger_to_delete,
  (SELECT count(*) FROM reward_redemptions rr
     WHERE rr.id IN (SELECT reward_redemption_id FROM demo_redeems)
  ) AS redemptions_to_delete;

\echo ''

-- =========================
-- 2) Delete real (opcional)
-- =========================
\if :do_delete_bool
BEGIN;

-- 2.1) borrar points_ledger asociado a events demo
DELETE FROM points_ledger pl
WHERE pl.source_event_id IN (
  SELECT e.id
  FROM events e
  WHERE e.merchant_id = :'merchant_id'
    AND e.payload->>'demo_run_id' = :'demo_run_id'
);

-- 2.2) borrar reward_redemptions (solo las referenciadas por events redeem demo)
DELETE FROM reward_redemptions rr
WHERE rr.id IN (
  SELECT (e.payload->>'reward_redemption_id')::uuid
  FROM events e
  WHERE e.merchant_id = :'merchant_id'
    AND e.payload->>'demo_run_id' = :'demo_run_id'
    AND e.type = 'redeem'
    AND (e.payload ? 'reward_redemption_id')
);

-- 2.3) borrar events demo
DELETE FROM events e
WHERE e.merchant_id = :'merchant_id'
  AND e.payload->>'demo_run_id' = :'demo_run_id';

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
)
SELECT
  (SELECT count(*) FROM demo_events) AS events_left,
  (SELECT count(*) FROM points_ledger pl
     WHERE pl.source_event_id IN (SELECT id FROM demo_events)
  ) AS ledger_left,
  (SELECT count(*) FROM reward_redemptions rr
     WHERE rr.id IN (SELECT reward_redemption_id FROM demo_redeems)
  ) AS redemptions_left;

\else
\echo 'MODO PREVIEW (no se borró nada). Para borrar: -v do_delete=1 (o true)'
\endif