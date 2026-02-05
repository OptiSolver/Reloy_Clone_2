#!/usr/bin/env bash
set -euo pipefail

########################################
# LOOP — DEMO RUNNER (multi customers + multi rewards)
# HC4.2 / HC4.3 / HC4.4
#
# ✅ Fixes:
# - create_reward() único (sin duplicados)
# - rewards.title NOT NULL → insert con title/description
# - output de create_reward limpio (solo UUID)
# - delete_rewards_created usa psql correcto (sin :'var' en -c)
########################################

NOW="$(date +%Y_%m_%d_%H%M%S)"
DEMO_RUN_ID="demo_overowash_${NOW}"

API_BASE="${API_BASE:-http://localhost:3000}"
DATABASE_URL="${DATABASE_URL:?ERROR: falta DATABASE_URL}"
AUTH_USER_ID="${AUTH_USER_ID:-1ccd1500-169c-4c13-9962-ca54320750c1}"

MERCHANT_ID="${MERCHANT_ID:-cc611d6f-c039-4bb6-876a-fe59ae569a50}"
BRANCH_ID="${BRANCH_ID:-edeb417b-5f6f-4ea6-b244-1dd584cdd59c}"
STAFF_ID="${STAFF_ID:-9972f80b-b17f-472c-893b-15be850f848b}"

CUSTOMER_A_ID="${CUSTOMER_A_ID:-3337ec6b-d417-43aa-8e33-0d9612bdd12f}"
CUSTOMER_B_ID="${CUSTOMER_B_ID:-7229416d-a18e-4955-bb51-05473dd27aa5}"

VISITS_BEFORE_REDEEM="${VISITS_BEFORE_REDEEM:-2}"

AUTO_RESET="${AUTO_RESET:-0}"
RESET_SQL_PATH="${RESET_SQL_PATH:-scripts/demo_reset.sql}"

title () {
  echo ""
  echo "========================================"
  echo " $1"
  echo "========================================"
}

balance_for () {
  local customer_id="$1"
  psql "$DATABASE_URL" -v merchant_id="${MERCHANT_ID}" -v customer_id="${customer_id}" <<'SQL'
select coalesce(sum(delta_points),0) as balance
from points_ledger
where merchant_id = :'merchant_id'
  and customer_id = :'customer_id';
SQL
}

create_reward () {
  local points_cost="${1:?missing points_cost}"
  local reward_title="${2:?missing reward_title}"
  local reward_desc="${3:?missing reward_desc}"

  # -X -q -t -A → solo valor, sin ruido
  local out
  out="$(psql "$DATABASE_URL" -X -q -t -A \
    -v merchant_id="${MERCHANT_ID}" \
    -v points_cost="${points_cost}" \
    -v title="${reward_title}" \
    -v description="${reward_desc}" \
    -v demo_run_id="${DEMO_RUN_ID}" <<'SQL'
\set ON_ERROR_STOP on
INSERT INTO rewards (merchant_id, title, description, points_cost, is_active, meta)
VALUES (
  :'merchant_id',
  :'title',
  :'description',
  :'points_cost',
  true,
  jsonb_build_object('demo_run_id', :'demo_run_id')
)
RETURNING id;
SQL
)"
  echo "${out}" | head -n 1 | tr -d '[:space:]'
}

delete_rewards_created () {
  if [[ "${#REWARD_IDS[@]}" -eq 0 ]]; then
    return 0
  fi

  title "DELETE REWARDS CREADOS (count=${#REWARD_IDS[@]})"
  for rid in "${REWARD_IDS[@]}"; do
    [[ -z "${rid}" ]] && continue
    echo "➡️  delete reward ${rid}"
    psql "$DATABASE_URL" -X -q -v reward_id="${rid}" <<'SQL' >/dev/null || true
DELETE FROM rewards WHERE id = :'reward_id';
SQL
  done
}

post_visit () {
  local customer_id="$1"
  local source="$2"

  curl -s -X POST "${API_BASE}/api/events" \
    -H "Content-Type: application/json" \
    --data-raw "{
      \"type\": \"visit\",
      \"merchant_id\": \"${MERCHANT_ID}\",
      \"branch_id\": \"${BRANCH_ID}\",
      \"customer_id\": \"${customer_id}\",
      \"staff_id\": \"${STAFF_ID}\",
      \"payload\": {
        \"source\": \"${source}\",
        \"demo_run_id\": \"${DEMO_RUN_ID}\"
      }
    }"
}

post_redeem () {
  local customer_id="$1"
  local reward_id="$2"
  local source="$3"

  curl -s -X POST "${API_BASE}/api/redeem" \
    -H "Content-Type: application/json" \
    -H "x-auth-user-id: ${AUTH_USER_ID}" \
    --data-raw "{
      \"customerId\": \"${customer_id}\",
      \"rewardId\": \"${reward_id}\",
      \"demo_run_id\": \"${DEMO_RUN_ID}\",
      \"source\": \"${source}\"
    }"
}

reset_demo () {
  title "RESET DEMO (demo_run_id=${DEMO_RUN_ID})"

  if [[ ! -f "${RESET_SQL_PATH}" ]]; then
    echo "ERROR: no existe ${RESET_SQL_PATH}"
    exit 1
  fi

  echo "➡️  Preview:"
  psql "$DATABASE_URL" \
    -v merchant_id="${MERCHANT_ID}" \
    -v demo_run_id="${DEMO_RUN_ID}" \
    -v do_delete=0 \
    -f "${RESET_SQL_PATH}"

  echo ""
  echo "➡️  Delete:"
  psql "$DATABASE_URL" \
    -v merchant_id="${MERCHANT_ID}" \
    -v demo_run_id="${DEMO_RUN_ID}" \
    -v do_delete=1 \
    -f "${RESET_SQL_PATH}"

  # rewards no se borran por demo_reset.sql
  delete_rewards_created
}

run_customer_flow () {
  local label="$1"
  local customer_id="$2"
  local reward_id="$3"

  title "CUSTOMER ${label} — START (reward=${reward_id})"

  echo "➡️  Balance inicial:"
  balance_for "${customer_id}"

  echo ""
  echo "➡️  Visits x${VISITS_BEFORE_REDEEM}:"
  for i in $(seq 1 "${VISITS_BEFORE_REDEEM}"); do
    echo "  - visit ${i}"
    post_visit "${customer_id}" "demo_visit_${label}_${i}" | jq .
  done

  echo ""
  echo "➡️  Balance luego de visits:"
  balance_for "${customer_id}"

  echo ""
  echo "➡️  Redeem (reward=${reward_id}):"
  post_redeem "${customer_id}" "${reward_id}" "demo_redeem_${label}" | jq .

  echo ""
  echo "➡️  Balance final:"
  balance_for "${customer_id}"

  title "CUSTOMER ${label} — END"
}

########################################
# RUN
########################################

declare -a REWARD_IDS=()

REWARD_1_ID="$(create_reward 10  "Lavado Exterior -10%"   "Demo reward 10 pts (${DEMO_RUN_ID})")"; REWARD_IDS+=("${REWARD_1_ID}")
REWARD_2_ID="$(create_reward 20  "Lavado Interior -15%"   "Demo reward 20 pts (${DEMO_RUN_ID})")"; REWARD_IDS+=("${REWARD_2_ID}")
REWARD_3_ID="$(create_reward 30  "Lavado Premium -20%"    "Demo reward 30 pts (${DEMO_RUN_ID})")"; REWARD_IDS+=("${REWARD_3_ID}")

if [[ -z "${REWARD_1_ID}" || -z "${REWARD_2_ID}" || -z "${REWARD_3_ID}" ]]; then
  echo "ERROR: no se pudieron crear rewards demo"
  exit 1
fi

echo "========================================"
echo " LOOP — DEMO RUN (MULTI + MULTI-REWARD)"
echo "========================================"
echo "DEMO_RUN_ID = ${DEMO_RUN_ID}"
echo "API_BASE    = ${API_BASE}"
echo "MERCHANT_ID = ${MERCHANT_ID}"
echo "BRANCH_ID   = ${BRANCH_ID}"
echo "STAFF_ID    = ${STAFF_ID}"
echo "CUSTOMER_A  = ${CUSTOMER_A_ID}"
echo "CUSTOMER_B  = ${CUSTOMER_B_ID}"
echo "VISITS_BEFORE_REDEEM = ${VISITS_BEFORE_REDEEM}"
echo "AUTO_RESET  = ${AUTO_RESET}"
echo "REWARD_1_ID (10 pts) = ${REWARD_1_ID}"
echo "REWARD_2_ID (20 pts) = ${REWARD_2_ID}"
echo "REWARD_3_ID (30 pts) = ${REWARD_3_ID}"
echo "========================================"
echo ""

run_customer_flow "A" "${CUSTOMER_A_ID}" "${REWARD_1_ID}"
run_customer_flow "B" "${CUSTOMER_B_ID}" "${REWARD_2_ID}"

title "HC4.3 — Caso controlado (insufficient_points) con reward_3"
echo "➡️  Intento redeem reward_3 (30 pts) para Customer B"
post_redeem "${CUSTOMER_B_ID}" "${REWARD_3_ID}" "demo_redeem_B_insufficient" | jq .
echo "➡️  Balance B final:"
balance_for "${CUSTOMER_B_ID}"

if [[ "${AUTO_RESET}" == "1" ]]; then
  reset_demo
else
  title "FIN (sin reset automático)"
  echo "Tip: para borrar events/ledger/redemptions de esta corrida:"
  echo "psql \"\$DATABASE_URL\" -v merchant_id='${MERCHANT_ID}' -v demo_run_id='${DEMO_RUN_ID}' -v do_delete=1 -f ${RESET_SQL_PATH}"
  echo "Y para borrar rewards creados:"
  for rid in "${REWARD_IDS[@]}"; do
    echo "psql \"\$DATABASE_URL\" -c \"delete from rewards where id='${rid}';\""
  done
fi

echo ""
echo "✅ DONE"