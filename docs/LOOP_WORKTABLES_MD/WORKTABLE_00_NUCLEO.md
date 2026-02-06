# docs/worktables/WORKTABLE_00_NUCLEO.md
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