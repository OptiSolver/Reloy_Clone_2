# docs/worktables/WORKTABLE_06_PRODUCTO_OWNER.md
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