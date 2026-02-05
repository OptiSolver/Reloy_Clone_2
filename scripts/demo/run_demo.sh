#!/usr/bin/env bash
set -euo pipefail

########################################
# LOOP — DEMO RUNNER
########################################

# ========================
# TIMESTAMP / DEMO RUN ID
# ========================
NOW="$(date +%Y_%m_%d_%H%M%S)"
DEMO_RUN_ID="demo_overowash_${NOW}"

# ========================
# VARIABLES DEMO (FIXED)
# ========================
MERCHANT_ID="cc611d6f-c039-4bb6-876a-fe59ae569a50"
BRANCH_ID="edeb417b-5f6f-4ea6-b244-1dd584cdd59c"
STAFF_ID="9972f80b-b17f-472c-893b-15be850f848b"
CUSTOMER_ID="3337ec6b-d417-43aa-8e33-0d9612bdd12f"
REWARD_ID="a529a0f9-5941-424b-abe6-8277bf0f3c19"

# ========================
# AUTH (DEV)
# ========================
# auth_user_id del staff (resuelve merchant/branch/staff en /api/redeem)
AUTH_USER_ID="1ccd1500-169c-4c13-9962-ca54320750c1"

# ========================
# HEADER
# ========================
echo "========================================"
echo " LOOP — DEMO RUN"
echo "========================================"
echo "DEMO_RUN_ID = ${DEMO_RUN_ID}"
echo "MERCHANT_ID = ${MERCHANT_ID}"
echo "CUSTOMER_ID = ${CUSTOMER_ID}"
echo "REWARD_ID   = ${REWARD_ID}"
echo "========================================"
echo ""

########################################
# HELPERS
########################################

get_balance () {
  psql "$DATABASE_URL" \
    -v merchant_id="${MERCHANT_ID}" \
    -v customer_id="${CUSTOMER_ID}" <<'SQL'
select coalesce(sum(delta_points),0) as balance
from points_ledger
where merchant_id = :'merchant_id'
  and customer_id = :'customer_id';
SQL
}

post_visit_event () {
  echo "➡️  POST visit event"

  curl -s -X POST "http://localhost:3000/api/events" \
    -H "Content-Type: application/json" \
    --data-raw "{
      \"type\": \"visit\",
      \"merchant_id\": \"${MERCHANT_ID}\",
      \"branch_id\": \"${BRANCH_ID}\",
      \"customer_id\": \"${CUSTOMER_ID}\",
      \"staff_id\": \"${STAFF_ID}\",
      \"payload\": {
        \"source\": \"demo_visit\",
        \"demo_run_id\": \"${DEMO_RUN_ID}\"
      }
    }" | jq .
}

post_redeem () {
  echo "➡️  POST redeem"

  curl -s -X POST "http://localhost:3000/api/redeem" \
    -H "Content-Type: application/json" \
    -H "x-auth-user-id: ${AUTH_USER_ID}" \
    --data-raw "{
      \"customerId\": \"${CUSTOMER_ID}\",
      \"rewardId\": \"${REWARD_ID}\",
      \"demo_run_id\": \"${DEMO_RUN_ID}\"
    }" | jq .
}

########################################
# FLOW
########################################

echo "➡️  Balance inicial:"
get_balance
echo ""

post_visit_event

echo ""
echo "➡️  Balance luego de visit:"
get_balance
echo ""

post_redeem

echo ""
echo "➡️  Balance luego de redeem:"
get_balance
echo ""