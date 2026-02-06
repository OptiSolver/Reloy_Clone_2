# docs/worktables/WORKTABLE_05_PRODUCTO_CLIENTE.md
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