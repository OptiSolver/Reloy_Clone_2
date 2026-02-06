# WORKTABLE_06 — OWNER UI / UX

## 1. Rol de esta mesa
Esta mesa define **QUÉ VE, QUÉ CONFIGURA y QUÉ CONTROLA** el Owner.
No define reglas de negocio.
No define lógica de eventos.
No persiste estados derivados.

La UI SOLO CONSUME:
- eventos
- estados derivados
- catálogos configurables

---

## 2. Qué YA EXISTE (no reinventar)
### Backend operativo:
- Sistema event-driven (append-only)
- Eventos: visit, checkin, checkout, redeem
- Estados derivados:
  - customer_presence
  - customer_status
  - points_balance (snapshot)
- Endpoints ya funcionales:
  - GET /api/session
  - GET/POST /api/events
  - GET /api/presence
  - GET/POST /api/rewards
  - GET /api/customers
  - GET /api/customers/summary

### Modelo mental innegociable:
- La UI **NO decide**
- La UI **NO recalcula**
- La UI **NO muta estados derivados**
- Todo lo que se muestra viene del core

---

## 3. Qué NO EXISTE TODAVÍA (responsabilidad de esta mesa)
No existe ninguna Owner Console real.

Esta mesa debe DEFINIR:
- Qué pantallas existen
- Qué datos muestra cada pantalla
- Qué acciones están permitidas
- Qué endpoints faltan (sin implementarlos)

---

## 4. Objetivo del Owner (MVP)
Un Owner debe poder:
1. Crear y entender su comercio
2. Ver si el sistema está siendo usado
3. Configurar recompensas
4. Ver clientes y su comportamiento
5. Crear staff operativo

Nada más.

---

## 5. Pantallas MÍNIMAS (MVP obligatorio)

### 5.1 Dashboard
Objetivo: saber si el sistema vive.

Mostrar:
- Total customers
- Total events
- Total redemptions
- Última actividad

NO:
- gráficos complejos
- funnels
- predicciones

---

### 5.2 Customers
Objetivo: entender relación en el tiempo.

Listado:
- customer_id
- estado actual
- puntos
- última visita

Detalle:
- timeline de eventos
- redemptions
- estado derivado

---

### 5.3 Rewards
Objetivo: definir incentivos.

Listado:
- reward
- costo en puntos
- activo / inactivo

Acciones:
- crear reward
- activar / desactivar

---

### 5.4 Staff
Objetivo: habilitar operación.

Listado:
- staff
- rol
- sucursal
- estado

Acción:
- crear staff

---

### 5.5 Settings (básico)
Objetivo: definir cómo opera el comercio.

Mostrar:
- industry
- visit_mode (single / in_out)

NO:
- reglas complejas
- lógica condicional

---

## 6. Qué NO SE PUEDE ROMPER
- Event sourcing
- Append-only events
- Estados derivados
- Desacople UI ↔ Core

Si una pantalla necesita “calcular algo” → está mal planteada.

---

## 7. Relación con otras mesas
- Depende de: WT_00 (Núcleo), WT_01 (Data Model)
- Alimenta: WT_04 (Staff UI), WT_05 (Client UI)

---

## 8. Output esperado de esta mesa
Esta mesa NO entrega código.

Entrega:
- Lista final de pantallas
- Descripción de cada pantalla
- Datos requeridos por pantalla
- Acciones permitidas
- Endpoints necesarios (solo definición)

Con eso recién se pasa a implementación.