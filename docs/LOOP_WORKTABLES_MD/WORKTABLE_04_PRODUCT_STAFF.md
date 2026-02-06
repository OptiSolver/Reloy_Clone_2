# docs/worktables/WORKTABLE_04_PRODUCTO_STAFF.md
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