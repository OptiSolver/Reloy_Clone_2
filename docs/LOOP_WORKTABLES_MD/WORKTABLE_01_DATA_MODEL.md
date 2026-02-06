# docs/worktables/WORKTABLE_01_DATA_MODEL.md
# WORKTABLE_01 — DATA MODEL (Fuente de verdad: packages/db/src/schema.ts)

## 0) Propósito
Definir el modelo de datos “canon” (Postgres) y su relación con el core event-driven.

Regla: si una pantalla o endpoint pide algo que no existe en el modelo → se decide acá (o se deriva por eventos).

Fuente de verdad:
- `packages/db/src/schema.ts` (Drizzle)

---

## 1) Jerarquía multi-tenant
### 1.1 Owners (tenant raíz)
Tabla: `owners`
Campos:
- `id` (uuid pk)
- `created_at` (default now)
- `auth_user_id` (uuid, unique, nullable)
- `first_name` (text, nullable)
- `last_name` (text, nullable)
- `account_type` (text, default "owner")
- `status` (text, default "active")

Uso:
- Identidad del owner (console)
- Vinculación con merchants

---

### 1.2 Merchants (comercio/marca)
Tabla: `merchants`
Campos:
- `id`
- `owner_id` (FK owners.id, not null)
- `name` (not null)
- `is_active` (default true)
- `created_at` (default now)

Uso:
- Scope de todo lo operativo: rewards, missions, events, redemptions, memberships

---

### 1.3 Branches (sucursales)
Tabla: `branches`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `name` (not null)
- `created_at` (default now)

Uso:
- Operación staff por sucursal
- Segmentación de eventos

---

### 1.4 Staff (operadores)
Tabla: `staff`
Campos:
- `id`
- `branch_id` (FK branches.id, not null)
- `full_name` (not null)
- `role` (text, not null)  // ej: admin, cashier, manager
- `auth_user_id` (uuid, nullable)
- `pin_hash` (text, nullable)
- `is_active` (bool, default true)
- `created_at` (default now)

Uso:
- Identidad operativa
- Firma/autoría de eventos y redemptions

---

## 2) Customers (global) + Identifiers
### 2.1 Customers
Tabla: `customers`
Campos:
- `id`
- `created_at` (default now)

Regla:
- un customer existe UNA sola vez globalmente
- su vínculo por comercio se modela en `memberships`

---

### 2.2 Customer Identifiers
Tabla: `customer_identifiers`
Campos:
- `id`
- `customer_id` (FK customers.id, not null)
- `type` (text, not null) // phone|email|qr|code|document|external
- `value_raw` (text, not null)
- `value_normalized` (text, not null)
- `is_primary` (bool, default false)
- `verified_at` (timestamp, nullable)
- `created_at` (default now)

Constraints / Índices:
- `uq_customer_identifier_type_value` unique(type, value_normalized)
- `idx_customer_identifier_type_value` index(type, value_normalized)
- `idx_customer_identifier_customer_id` index(customer_id)

Regla:
- búsqueda siempre por `value_normalized`

---

## 3) Memberships (wallet por merchant)
Tabla: `memberships`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `customer_id` (FK customers.id, not null)
- `points_balance` (int, default 0) // snapshot
- `status` (text, default "new") // derivado: new|active|risk|lost
- `created_at` (default now)
- `updated_at` (default now)

Constraints / Índices:
- `uq_memberships_merchant_customer` unique(merchant_id, customer_id)
- `idx_memberships_merchant_id` index(merchant_id)
- `idx_memberships_customer_id` index(customer_id)

Regla de arquitectura:
- `points_balance` y `status` son snapshot/caché
- la verdad histórica vive en `events` (+ ledger si existiera; hoy no está en schema.ts)
- cualquier actualización de snapshot debe estar estandarizada por engine/API (WT_02/WT_03)

---

## 4) Events (append-only)
Tabla: `events`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `branch_id` (FK branches.id, nullable)
- `customer_id` (FK customers.id, not null)
- `staff_id` (FK staff.id, nullable)
- `type` (text, not null)
- `occurred_at` (timestamp, default now)
- `payload` (jsonb, default {})
- `created_at` (timestamp, default now)

Índices:
- `idx_events_merchant_occurred_at` index(merchant_id, occurred_at)
- `idx_events_customer_occurred_at` index(customer_id, occurred_at)
- `idx_events_type` index(type)

Reglas:
- append-only: no UPDATE/DELETE
- `occurred_at` = momento del evento
- `payload` flexible (pero siempre JSON)

---

## 5) Merchant Settings (config por merchant)
Tabla: `merchant_settings`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `industry` (text, not null) // gym, cafe, barber, retail...
- `visit_mode` (text, default "single") // "single" | "in_out"
- `config` (jsonb, default {}) // thresholds, reglas, etc.
- `created_at` (default now)
- `updated_at` (default now)

Constraints / Índices:
- `uq_merchant_settings_merchant` unique(merchant_id)
- `idx_merchant_settings_industry` index(industry)

Regla:
- `visit_mode` define UX y reglas de presencia:
  - single: eventos tipo `visit` (no hay “in/out” real)
  - in_out: eventos `checkin` y `checkout` (presencia derivada)
- `config` permite parametrizar rubro sin migrar DB

---

## 6) Rewards (catálogo por merchant)
Tabla: `rewards`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `title` (text, not null)
- `description` (text, nullable)
- `points_cost` (int, not null)
- `is_active` (bool, default true)
- `meta` (jsonb, default {}) // stock, tags, restricciones...
- `created_at` (default now)
- `updated_at` (default now)

Índices:
- `idx_rewards_merchant_id` index(merchant_id)
- `idx_rewards_active` index(is_active)

Regla:
- elegibilidad se decide por balance (derivado) + `points_cost` + `is_active`

---

## 7) Reward Redemptions (registro de canjes)
Tabla: `reward_redemptions`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `reward_id` (FK rewards.id, not null)
- `customer_id` (FK customers.id, not null)
- `staff_id` (FK staff.id, nullable)
- `branch_id` (FK branches.id, nullable)
- `points_spent` (int, not null)
- `status` (text, default "approved") // approved|cancelled|reversed
- `created_at` (default now)

Índices:
- `idx_redemptions_merchant_id` index(merchant_id)
- `idx_redemptions_customer_id` index(customer_id)
- `idx_redemptions_reward_id` index(reward_id)

Regla (importante):
- además de insertar acá, el canje debe generar:
  - un `event` tipo `redeem`
  - (ideal) una fuente idempotente para puntos negativos (ver WT_02: hoy no hay tabla ledger en schema.ts)

Nota:
- NO hay unique anti-duplicado por reward/customer. Si querés “solo 1 vez” por reward, se agrega constraint o se usa lógica en API (ya estás haciendo lógica).

---

## 8) Missions (catálogo por merchant)
Tabla: `missions`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `title` (text, not null)
- `description` (text, nullable)
- `rule` (jsonb, default {}) // ej {type:"visits", count:5, windowDays:30}
- `points_reward` (int, default 0)
- `is_active` (bool, default true)
- `created_at` (default now)
- `updated_at` (default now)

Índices:
- `idx_missions_merchant_id` index(merchant_id)
- `idx_missions_active` index(is_active)

Regla:
- completar misión debería generar event tipo `mission_completed`

---

## 9) Mission Progress (por customer, por merchant)
Tabla: `mission_progress`
Campos:
- `id`
- `merchant_id` (FK merchants.id, not null)
- `mission_id` (FK missions.id, not null)
- `customer_id` (FK customers.id, not null)
- `progress` (int, default 0)
- `is_completed` (bool, default false)
- `completed_at` (timestamp, nullable)
- `created_at` (default now)
- `updated_at` (default now)

Constraints / Índices:
- `uq_mission_progress_unique` unique(merchant_id, mission_id, customer_id)
- `idx_mission_progress_customer_id` index(customer_id)

Regla:
- el progress es un snapshot
- la verdad de “por qué avanzó” viene de events (visits/checkins/etc.) o de job de recompute

---

## 10) Invariantes y decisiones de arquitectura (para el núcleo)
1) `events` es append-only y es la historia.
2) `memberships` es snapshot (balance/status) y debe ser consistente con derivaciones.
3) `merchant_settings.visit_mode` define si existe presencia real.
4) rewards/canjes y missions/progress existen como “catálogos + snapshots”:
   - el hecho “real” se refleja también en events (redeem, mission_completed).

---

## 11) Qué falta (real) para cerrar el núcleo “robusto”
Sin inventar nada, por el schema actual faltan dos piezas típicas:

A) **Points ledger** (si querés idempotencia fuerte y auditoría):
- tabla `points_ledger` con:
  - merchant_id, customer_id, delta, source_event_id (unique), created_at
- hoy tu API puede estar usando sumatoria de algo: si eso está en DB real pero no en schema.ts, hay que agregarlo en Drizzle.

B) **Constraints anti-doble canje** (si aplica):
- unique parcial o índice único lógico:
  - (merchant_id, customer_id, reward_id, status='approved')
- o regla explícita en API (ya la tenés), pero DB constraint te protege.

Estas dos cosas se deciden en WT_02 (engine) + WT_03 (API).

Fin.