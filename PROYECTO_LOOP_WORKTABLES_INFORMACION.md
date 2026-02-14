
# WORKTABLE_00 — NÚCLEO (Fuente de verdad)

## 0) Propósito
Esta mesa define el “contrato operativo” del proyecto LOOP:

- Qué es LOOP (y qué NO es).
- Cómo se organiza el repo.
- Qué decisiones son “ley” (no negociables).
- Cómo se conectan todas las mesas (redirecciones).
- Cómo se trabaja: branches, commits, convenciones, y secuencia real.

Este archivo es el “tablero madre”.  
Si algo no encaja en una mesa específica, vuelve acá.

---

## 1) Definición del sistema (1 frase)
LOOP es un sistema **event-driven**: registra eventos (visita/checkin/checkout/redeem/…) y **deriva estados** (balance, presencia, status, elegibilidad de rewards).  
La UI **no decide**; solo consulta y representa estados derivados.

---

## 2) Repo real (estado actual)
### 2.1 Workspaces
El repo es un monorepo con pnpm workspaces:

- `pnpm-workspace.yaml` (root):
  - `apps/*`
  - `packages/*`

### 2.2 Estructura (real hoy)
- `apps/`
  - `web/` (Next.js, API routes + UI base)
  - `owner/` (existe hoy como app separada)
  - `staff/` (existe hoy como app separada)
  - `client/` (existe hoy como app separada)
- `packages/`
  - `db/` (Drizzle + Pool pg, schema.ts)
  - `core/` (contratos zod + servicios)
  - `ui/` (existe; scope a definir)
  - `config/` (existe; scope a definir)

**Decisión vigente (tuya): “Versión B = single app”**  
⇒ La UI objetivo es dentro de `apps/web` con rutas:
- `/owner/*`
- `/staff/*`
- `/client/*`

**Estado real hoy:** existen `apps/owner|staff|client` además de `apps/web`.  
Eso NO se rompe ahora: se define plan de consolidación (ver 2.3).

### 2.3 Plan de consolidación a single app (sin romper)
- Corto plazo (MVP): construir UI en `apps/web/src/app/(owner|staff|client)` sin depender de las apps separadas.
- Las apps separadas quedan en “modo legacy/parking”:
  - no sumar features nuevas ahí
  - no eliminar hasta que `apps/web` tenga parity mínima
- Cuando `apps/web` esté estable:
  - se archivan o se eliminan apps separadas en un PR dedicado + checklist de verificación.

---

## 3) Principios no negociables
1. **Event sourcing / append-only**: `events` no se edita ni se borra.
2. **Estados derivados**: balances/presencia/status vienen de eventos/ledger + servicios core.
3. **Idempotencia**:
   - ledger con `source_event_id` (o equivalente) para no duplicar puntos.
   - redeem anti-duplicado por índice/constraint (ya existe estrategia en API).
4. **Multi-tenant jerárquico**:
   - owner (tenant) → merchants → branches
   - customers globales + memberships por merchant (wallet).
5. **UI no decide**: no “calcula” puntos ni valida lógica de negocio; llama API.

---

## 4) Autenticación (estado actual)
### 4.1 Dev Auth (vigente hoy)
- Header: `x-auth-user-id: <uuid>`
- API `/api/session` resuelve “identidad runtime”:
  - owner si existe en `owners.auth_user_id`
  - staff si existe en `staff.auth_user_id` y join a branch→merchant

**Nota real detectada:** zod `uuid()` era demasiado estricto (v1-8) y se reemplazó por regex UUID más permisivo en algunos contratos.

### 4.2 Prod Auth (future)
- JWT Supabase / middleware (pendiente)
- Cuando se implemente: NO romper contratos, solo reemplazar extractor.

**Redirección:** ver `WORKTABLE_10_COMPLIANCE_LEGAL_DATA.md` (auth, RLS, privacidad).

---

## 5) Contratos core (estado actual)
`packages/core/src/index.ts` exporta:

### Contratos (Zod)
- `contracts/event`
- `contracts/events-query`
- `contracts/presence-query`
- `contracts/customer-state`
- `contracts/reward`
- `contracts/redeem`
- (`contracts/event-types` existe como archivo pero NO está re-exportado hoy)

### Servicios
- `create-event`
- `computeCustomerStatus`
- `computeCustomerPresence`
- `computeCustomerState`
- `create-reward`
- `list-rewards`
- `redeem-reward`
- `award-points-from-event`

**Regla:** apps consumen contratos/servicios desde `@loop/core`, no re-implementan lógica.

---

## 6) Backend API (estado actual)
En `apps/web/src/app/api/*` hoy existen rutas (según lo que venías pegando):
- `/api/session`
- `/api/events` (GET timeline, POST create + awardPoints)
- `/api/presence`
- `/api/redeem`
- `/api/rewards`
- `/api/customers`
- `/api/customers/summary`

**Regla:** toda UI single-app se apoya en estas rutas.
**Redirección:** ver `WORKTABLE_03_BACKEND_API.md`.

---

## 7) Convenciones técnicas (para no volver a romper)
### 7.1 UUID validation
- En contratos zod, preferir regex UUID “genérica” si el entorno genera UUIDs no v4 estrictos.
- Regla: **mismo criterio** en todos los schemas (events-query, presence-query, etc).

### 7.2 Snake vs camel
- DB: snake_case
- Core/contratos: puede ser camelCase
- API: se acepta ambos cuando sea necesario (ya se hace en redeem y events)

**Regla:** donde haya “doble naming”, se documenta y se migra luego, no se improvisa.

### 7.3 Timezone
- Normalización a `America/Argentina/Buenos_Aires` para strings “locales”.
- DB timestamps: mantener como timestamp sin tz (lo que ya está).

---

## 8) Roadmap real (secuencia de trabajo)
Orden correcto para “bases sólidas”:

1) WORKTABLE_01 — DATA MODEL  
2) WORKTABLE_02 — CORE ENGINE  
3) WORKTABLE_03 — BACKEND API  
4) WORKTABLE_06 — PRODUCTO OWNER (UX/UI)  
5) WORKTABLE_04 — PRODUCTO STAFF (UX/UI)  
6) WORKTABLE_05 — PRODUCTO CLIENTE (UX/UI)  
7) WORKTABLE_UI_SYSTEM (tokens/estilos) → queda dentro de WT_06 como sub-bloque o mesa aparte si crece  
8) Growth/Marketing/Operaciones/Compliance

---

## 9) Redirecciones (mapa de “dónde va cada cosa”)
- Modelo/Tablas/Relaciones/Índices → `WORKTABLE_01_DATA_MODEL.md`
- Reglas de puntos, estado, presencia, idempotencia → `WORKTABLE_02_CORE_ENGINE.md`
- Endpoints, contratos request/response, errores → `WORKTABLE_03_BACKEND_API.md`
- UI Staff (operación rápida) → `WORKTABLE_04_PRODUCTO_STAFF.md`
- UI Cliente (wallet, rewards, timeline) → `WORKTABLE_05_PRODUCTO_CLIENTE.md`
- UI Owner (dashboard, clientes, rewards, staff, config) → `WORKTABLE_06_PRODUCTO_OWNER.md`
- Landing/marketing/entry points → `WORKTABLE_07_MARKETING_LANDING.md`
- Experimentos/AB/metrics growth → `WORKTABLE_08_EXPERIMENTACION_GROWTH.md`
- Soporte/operación/Incidentes → `WORKTABLE_09_OPERACIONES_SOPORTE.md`
- Legal/compliance/auth/RLS/data retention → `WORKTABLE_10_COMPLIANCE_LEGAL_DATA.md`

---

## 10) Checklist “no sigo si…”
- Si `WORKTABLE_01` no refleja el schema real → no avanzar UI.
- Si `WORKTABLE_03` no lista endpoints reales + contratos → no avanzar pantallas.
- Si una pantalla necesita cálculo de negocio en UI → volver a WT_02/WT_03.

---

## 11) Estado actual (resumen)
- Monorepo OK.
- `apps/web` ya corre y expone API.
- Dev auth por header ok.
- Se corrigieron conflictos de exports en `@loop/core` (index.ts).
- Se relajó validación UUID en presence/events query.
- Próximo paso real: **formalizar DATA MODEL** (WT_01) y completar schema (merchant_settings continúa).

Fin.

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

# WORKTABLE_02 — CORE ENGINE (reglas y derivaciones)

## 0) Propósito
Acá vive la lógica de negocio “pura” (sin UI).  
Fuente: `packages/core`.

Regla: si una pantalla necesita “lógica” (presencia, puntos, status, elegibilidad) → se define acá y se expone por API.

---

## 1) Contratos (Zod) existentes
Ubicación: `packages/core/src/contracts/*`

- `event` (CreateEventInputSchema, EventType, etc.)
- `events-query` (EventsQuerySchema)
- `presence-query` (PresenceQuerySchema)
- `customer-state` (estado derivado + schemas)
- `reward` (CreateRewardInputSchema, etc.)
- `redeem` (redeem contract si aplica)

Nota: existe `event-types.ts` como archivo, pero hoy no se re-exporta en `core/src/index.ts`.

---

## 2) Servicios existentes (source of truth)
Ubicación: `packages/core/src/services/*`

- `create-event`
- `computeCustomerPresence`
- `computeCustomerStatus`
- `computeCustomerState`
- `award-points-from-event`
- `create-reward`
- `list-rewards`
- `redeem-reward`

---

## 3) Reglas canon (derivaciones)
### 3.1 Presencia (in/out)
La presencia se deriva por el último evento de presencia relevante:
- `checkin` => in
- `checkout` => out
- si no hay eventos => out

Implementación: `computeCustomerPresence()`.

### 3.2 Estado del cliente (status)
Se deriva de:
- totalEvents
- lastEventAt + lastEventType
- lastPresenceEventAt + lastPresenceEventType

Implementación: `computeCustomerState()` (y/o computeCustomerStatus).

### 3.3 Puntos (award)
Puntos se otorgan por evento (idempotente).
Implementación: `award-points-from-event()`.

Regla:
- Nunca “sumar puntos” desde UI.
- Todo ingreso de puntos debe rastrearse por `eventId` (source_event_id) o análogo para evitar duplicados.

---

## 4) Validaciones UUID (consistencia)
Detectado: zod `uuid()` fue demasiado estricto para algunos IDs.

Regla:
- Unificar criterio en contratos (events-query, presence-query, etc.)
- Preferir regex UUID genérico (5 grupos) para compatibilidad.

---

## 5) Outputs mínimos requeridos por UI
- presence: `"in" | "out"`
- customer_state:
  - customer_status
  - customer_presence
  - last_event_type/at
  - total_events
- points:
  - balance derivado por ledger (si existe)
- redeem:
  - approved/denied + causa

---

## 6) Redirecciones
- Data model (tablas necesarias para engine): `WORKTABLE_01_DATA_MODEL.md`
- API (cómo se expone el engine): `WORKTABLE_03_BACKEND_API.md`

Fin.

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

# WORKTABLE_04 — PRODUCTO STAFF (UX + UI)

## 0) Propósito
Definir la app Staff (operación rápida).  
Debe permitir operar reglas ya definidas sin fricción.

Regla: Staff UI = velocidad + cero ambigüedad.

---

## 1) Objetivo principal
- Identificar cliente (phone/email/qr)
- Crear evento (visit/checkin/checkout)
- Canjear reward (redeem)
- Ver estado rápido (presence + status + balance)

---

## 2) Navegación MVP (mínimo)
1) Buscar/crear cliente
2) Cliente detalle (estado + acciones)
3) Canjear reward
4) Historial (opcional MVP light)

---

## 3) Pantallas MVP
### 3.1 “Inicio / Buscar cliente”
Inputs:
- buscador por identifier (q)
Acciones:
- si no existe: crear customer (POST /api/customers)

APIs:
- GET /api/customers?merchant_id=&q=
- POST /api/customers

### 3.2 “Cliente Detalle”
Muestra:
- identificador principal
- balance
- status (derived)
- presence (in/out)
Acciones:
- “Registrar visita / checkin / checkout” según merchant_settings (cuando esté)
- “Canjear”

APIs:
- GET /api/customers (one)
- GET /api/customers/summary
- POST /api/events

### 3.3 “Canjear Reward”
Muestra:
- rewards disponibles
- balance actual
Acción:
- redeem

APIs:
- GET /api/rewards?merchant_id=
- POST /api/redeem

---

## 4) Reglas de UI (no romper core)
- La UI no decide si es “in/out” → consulta presence/summary.
- La UI no calcula puntos → solo muestra balance.
- Autocomplete por session header (dev) reduce IDs en body.

---

## 5) Estados comunes
- Loading
- Empty (sin customers)
- Error (con mensaje claro)
- Success (confirmación “evento registrado / canje aprobado”)

---

## 6) Redirecciones
- Endpoints: `WORKTABLE_03_BACKEND_API.md`
- Reglas operativas (single vs in_out): `WORKTABLE_01_DATA_MODEL.md` (merchant_settings) + `WORKTABLE_02_CORE_ENGINE.md`

Fin.

# WORKTABLE_05 — PRODUCTO CLIENTE (UX + UI)

## 0) Propósito
Definir la app Cliente (wallet).  
Debe ser “daily-use”: estado + rewards + timeline + canje (QR).

Regla: cliente NO opera, solo consume estados derivados.

---

## 1) Módulos (según tu mapa mental)
1) Entry / Landing (pre-login)
2) Auth / Onboarding
3) Home (estado + acción)
4) Rewards (catálogo + detalle)
5) Canje (QR)
6) Timeline (eventos)
7) Perfil / Nivel (opcional MVP light)
8) Descubrir / Red (V2)

---

## 2) Navegación (propuesta)
Bottom bar 5 items (MVP):
- Home
- Rewards
- QR
- Timeline
- Perfil

QR siempre accesible (centro o destacado).

---

## 3) Pantallas MVP (con APIs)
### 3.1 Entry / Landing
Muestra:
- comercio/merchant
- claim
- preview reward
Acciones:
- entrar/crear cuenta

(backend para esto puede ser estático al inicio; no bloquear desarrollo)

### 3.2 Home
Muestra:
- balance
- status
- “te falta X para…”
- quick actions

APIs:
- GET /api/customers (one) + balance
- GET /api/customers/summary (status/presence)
- GET /api/rewards (para “tease”)

### 3.3 Rewards
Lista + detalle:
- disponibles / bloqueadas
- “te faltan X”

APIs:
- GET /api/rewards
- balance via customers endpoint

### 3.4 QR / Canje
- QR grande
- estado “esperando validación”
- fallback “pedí ayuda al staff”

MVP: QR representa customer_id (o identifier).  
La validación final la hace staff en redeem.

### 3.5 Timeline
- lista de events
- agrupado por fecha
- insights simples (V2)

APIs:
- GET /api/events?merchant_id=&customer_id=

---

## 4) Multi-comercio / red (tu punto clave)
Decisión MVP:
- Cliente entra “contextual” por merchant (QR/NFC/link).
- La UI cliente puede soportar múltiples merchants, pero:
  - MVP: 1 merchant activo (context)
  - V2: “selector de comercio” + “descubrir”

Esto depende de cómo querés manejar “contexto” y session del cliente (WT_10 + auth).

---

## 5) Redirecciones
- Derivaciones: `WORKTABLE_02_CORE_ENGINE.md`
- Endpoints: `WORKTABLE_03_BACKEND_API.md`
- Owner define rewards/config: `WORKTABLE_06_PRODUCTO_OWNER.md`

Fin.

# WORKTABLE_06 — PRODUCTO OWNER (UX + UI)

## 0) Propósito
Definir Owner Console dentro de `apps/web` (single app).

Owner = control + configuración + análisis.

---

## 1) Objetivos del owner (MVP)
- Ver salud del negocio (KPIs)
- Ver clientes y su estado (balance, último evento, status)
- Crear/editar rewards
- Administrar staff (alta/baja)
- Configurar modo operativo del merchant (merchant_settings)

---

## 2) Navegación (MVP)
Sidebar:
- Dashboard
- Clientes
- Rewards
- Staff
- Configuración

Ruta objetivo:
- `/owner/dashboard`
- `/owner/customers`
- `/owner/rewards`
- `/owner/staff`
- `/owner/settings`

---

## 3) Dashboard (pediste “más info”)
MVP “rico pero simple” (sin BI pesado):

### KPIs Core
- Total clientes (memberships count por merchant)
- Clientes nuevos (últimos 7 días)
- Total eventos (últimos 7/30 días)
- Visitas/checkins (últimos 7/30)
- Canjes (últimos 7/30)
- Puntos otorgados (sum ledger +)
- Puntos gastados (sum ledger -)

### Señales de salud
- Top rewards canjeadas
- Clientes en risk/lost (derivado)
- Presencia ahora (in vs out) si aplica modo in_out

**Nota:** algunas métricas requieren endpoints nuevos o queries agregadas.
Se definen en WT_03 cuando se implementen.

---

## 4) Clientes (MVP)
Tabla:
- identifier principal
- balance
- last_event_at
- last_event_type
- status
- presence (si aplica)

Detalle cliente:
- timeline (events)
- summary (customer_state)

APIs actuales:
- GET /api/customers (list)
- GET /api/customers (one)
- GET /api/customers/summary
- GET /api/events

---

## 5) Rewards (MVP)
- listar rewards
- crear reward
- activar/desactivar (si está en DB)

API actual:
- GET /api/rewards
- POST /api/rewards
- redeem se ve por eventos/analytics (V2)

---

## 6) Staff (MVP)
- listar staff por branch
- activar/desactivar
- asociar auth_user_id (V2)
- pin (V2)

Requiere endpoints: (probable) `/api/staff/*` (no listados aún).  
Se define en WT_03.

---

## 7) Configuración (merchant_settings)
- industry
- modo operativo: single vs in_out
- reglas de puntos por evento (si se define)
- settings de rewards (si se define)

Depende de completar schema.ts.

---

## 8) Redirecciones
- Modelo (merchant_settings): `WORKTABLE_01_DATA_MODEL.md`
- Endpoints y métricas: `WORKTABLE_03_BACKEND_API.md`

Fin.

# WORKTABLE_07 — MARKETING & LANDING

## 0) Propósito
Definir entry points y conversión:
- landing mini (cliente)
- landing comercial (venta a merchants/owners)
- deep links QR/NFC

---

## 1) Entry points cliente (MVP)
- QR/NFC en sucursal → link con merchant/branch context
- Link directo (WhatsApp/IG)
- Staff comparte link

MVP:
- al abrir: muestra merchant + beneficio + CTA “Entrar / Crear cuenta”
- si ya tiene sesión: redirige al Home del merchant

---

## 2) Redirecciones
- Cliente UX: `WORKTABLE_05_PRODUCTO_CLIENTE.md`
- Auth/consent: `WORKTABLE_10_COMPLIANCE_LEGAL_DATA.md`

Fin.

## WORKTABLE\_08\_EXPERIMENTACIÓN\_GROWTH

\# docs/worktables/WORKTABLE\_08\_EXPERIMENTACION\_GROWTH.md  
\# WORKTABLE\_08 — EXPERIMENTACIÓN & GROWTH

\#\# 0\) Propósito  
Definir experimentos y métricas sin romper el core.

\---

\#\# 1\) Métricas base (derivables por eventos)  
\- activación (primer evento por customer)  
\- retención (eventos por semana)  
\- canje rate  
\- tiempo a primer canje  
\- distribución de status (new/active/risk/lost)

\---

\#\# 2\) Experimentos MVP  
\- copy de landing  
\- tease de reward bloqueada (“te falta 1 visita”)  
\- ubicación del QR (tab central vs botón)

\---

\#\# 3\) Redirecciones  
\- Eventos: WT\_03  
\- Estados: WT\_02  
\- Pantallas: WT\_05/WT\_06

Fin.

## WORKTABLE\_9\_OPERACIONES\_SOPORTE

\# docs/worktables/WORKTABLE\_09\_OPERACIONES\_SOPORTE.md  
\# WORKTABLE\_09 — OPERACIONES & SOPORTE

\#\# 0\) Propósito  
Definir soporte, fallas típicas, y playbooks.

\---

\#\# 1\) Incidentes comunes (MVP)  
\- staff no tiene contexto (auth\_user\_id no matchea)  
\- redeem devuelve insufficient\_points / already\_redeemed  
\- cliente no aparece por identifier (normalización)  
\- eventos duplicados (idempotencia)

\---

\#\# 2\) Playbook rápido  
\- validar /api/session con header dev  
\- validar staff.is\_active  
\- validar merchant\_id/customer\_id con queries base  
\- ver timeline /api/events

\---

\#\# 3\) Redirecciones  
\- Session/auth: WT\_03 \+ WT\_10  
\- Data model: WT\_01

Fin.

## WORKTABLE\_10\_COMPLIANCE\_LEGAL\_DATA

\# docs/worktables/WORKTABLE\_10\_COMPLIANCE\_LEGAL\_DATA.md  
\# WORKTABLE\_10 — COMPLIANCE / LEGAL / DATA

\#\# 0\) Propósito  
Definir:  
\- privacidad  
\- retención de datos  
\- auth real (prod)  
\- RLS/policies (si se usa Supabase)  
\- auditoría (event sourcing ayuda)

\---

\#\# 1\) Datos personales (PII)  
\- customer\_identifiers puede contener: teléfono/email/documento  
Regla:  
\- value\_raw se guarda porque es útil operativamente, pero:  
  \- value\_normalized es el “índice” de búsqueda  
  \- minimizar exposición en UI

\---

\#\# 2\) Auth prod (pendiente)  
\- Migrar de header dev a JWT  
\- Definir sesión de cliente y owner

\---

\#\# 3\) Retención  
\- events append-only: definir política (nunca borrar vs borrar demo)  
\- si hay “demo\_run\_id”: habilitar reset de demo sin tocar prod

\---

\#\# 4\) Redirecciones  
\- Session endpoints: WT\_03  
\- Data model: WT\_01

Fin.  
