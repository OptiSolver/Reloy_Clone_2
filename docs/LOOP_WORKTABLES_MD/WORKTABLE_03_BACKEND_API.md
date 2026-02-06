# docs/worktables/WORKTABLE_03_BACKEND_API.md
# WORKTABLE_03 — BACKEND API (apps/web/src/app/api)

## 0) Propósito
Documentar endpoints reales y sus contratos, para que UI (owner/staff/client) consuma sin inventar.

Regla: toda pantalla debe mapear a:
- endpoint(s) necesarios
- query/body
- respuesta esperada
- errores

---

## 1) Autenticación dev (actual)
- Header: `x-auth-user-id: <uuid>`
- Usado en:
  - `/api/session` (obligatorio)
  - `/api/events` (autocompleta merchant/branch/staff si está el header)
  - `/api/redeem` (autocompleta y valida staff activo)

---

## 2) Endpoints (inventario actual observado)
### 2.1 GET /api/session
Objetivo: resolver identidad runtime (owner/staff).

Req:
- header `x-auth-user-id` (uuid)

Res:
- `{ ok, auth_user_id, owner, staff }`
- owner: lookup por `owners.auth_user_id`
- staff: lookup por `staff.auth_user_id` + join branches→merchant

Errores:
- 401 missing_dev_auth_user_id

---

### 2.2 GET /api/events
Objetivo: timeline de events por merchant, filtrable por customer/branch.

Query:
- merchant_id (req)
- customer_id (opt)
- branch_id (opt)
- limit (opt, default 50)

Res:
- `{ ok, events: [], customer_status?, customer_presence? }`
- si customer_id viene, se calcula customer_state (incluye presencia por último checkin/checkout)

---

### 2.3 POST /api/events
Objetivo: crear evento + otorgar puntos (awardPointsFromEvent).

Body:
- CreateEventInputSchema (core)
- Autocomplete: si viene header dev y faltan ids, completa merchant/branch/staff desde staff context.

Res:
- `{ ok, event }` con timestamps locales.

Errores:
- 400 zod / validaciones
- 500 si DB no devolvió timestamps

---

### 2.4 GET /api/presence
Query:
- merchant_id (req)
- customer_id (req)

Res:
- `{ ok: true, customer_presence: "in" | "out" }`

---

### 2.5 GET /api/customers
Modo LIST:
- merchant_id (req)
- q (opt)
- limit (opt)

Res:
- customers: [{ customer_id, identifier_*, balance, last_event_* }]

Modo GET ONE:
- merchant_id (req)
- customer_id (req)

Res:
- membership
- identifiers
- balance (ledger sum)
- last_event

---

### 2.6 POST /api/customers
Objetivo: crear/buscar customer por identifier y asegurar membership.

Body:
- merchant_id (req)
- branch_id (opt)
- staff_id (opt)
- identifier: { type, value }

Res:
- `{ ok, merchant_id, customer_id, identifier, membership_created }`

---

### 2.7 GET /api/customers/summary
Objetivo: snapshot de estado derivado para UI.

Query:
- merchant_id (req)
- customer_id (req)
- branch_id (opt)

Res:
- total_events
- last_event_type/at
- customer_status
- customer_presence
- last_presence_event_* (debug útil)

---

### 2.8 GET /api/rewards
Query:
- merchant_id (req)

Res:
- rewards list

---

### 2.9 POST /api/rewards
Body:
- CreateRewardInputSchema (core)

Res:
- reward inserted

---

### 2.10 POST /api/redeem
Body soportado:
- camel o snake
- mínimo: customerId + rewardId si viene x-auth-user-id (resuelve contexto staff)

Reglas:
- valida reward active
- evita duplicado approved
- chequea balance por points_ledger
- crea reward_redemptions + event redeem + ledger negativo (tx)

Res:
- redemption + event

Errores:
- 401 staff_context_not_found
- 403 staff_inactive
- 404 reward_not_found
- 409 already_redeemed
- 400 insufficient_points

---

## 3) Contratos de error (estandar)
Regla simple:
- `{ ok:false, error:<string|zod> }`
- status codes coherentes (400/401/403/404/409/500)

---

## 4) Redirecciones
- Derivaciones (presence/state/points): `WORKTABLE_02_CORE_ENGINE.md`
- Pantallas que consumen: WT_04/05/06

Fin.