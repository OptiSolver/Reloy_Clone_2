# docs/worktables/WORKTABLE_02_CORE_ENGINE.md
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