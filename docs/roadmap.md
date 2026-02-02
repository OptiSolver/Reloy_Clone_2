# 🧭 ROADMAP v2 — LOOP / OVERO LOYALTY  
**Documento de dirección integral del proyecto**

Este roadmap está guiado 100% por el documento base (“Qué es Overo Loyalty”), que actúa como Product Canon.
Regla: lo técnico se adapta al documento, no al revés.

---

## 0️⃣ PRINCIPIOS FUNDAMENTALES (NO NEGOCIABLES)

### 0.1 Fuente de verdad
- El documento **“Qué es Overo Loyalty”** es el **Product Canon**.
- El roadmap **no define el producto**: lo traduce a sistema.
- Nada se desarrolla si no está:
  - en el documento, o
  - agregado explícitamente al documento (y luego reflejado aquí).

### 0.2 Qué ES Loop / Overo Loyalty
- Un **sistema de registro de eventos** por cliente y por comercio.
- Un **motor de estados** derivado de esos eventos.
- Un **sistema operativo** para comercios (no solo puntos).

### 0.3 Qué NO ES
- No es solo una app de puntos.
- No es solo marketing.
- No es una app “bonita” sin lógica profunda.
- No es dependiente del UX para funcionar.

### 0.4 Regla de oro técnica
**Los eventos son la verdad.**  
**Los estados son derivados.**  
**La UI solo representa.**

---

## 1️⃣ BLOQUE 0 — PREPARACIÓN Y GOBIERNO (YA EJECUTADO)

### Objetivo real
Preparar el terreno para ejecutar el documento sin improvisación, sin olvidos y sin deuda estructural.

### Incluye
- Documento base + anexo freeze
- Requirements Tracker
- Roadmap (este documento)
- Repo Git + GitHub
- Entorno local limpio
- SSH + seguridad
- Regla de gates

### Gate de salida (OBLIGATORIO)
- `/docs` completo y versionado
- Tracker presente
- Roadmap aprobado
- Repo remoto funcionando

**Estado:** COMPLETO ✅

---

## 2️⃣ FASE 1 — ARQUITECTURA Y ESTRUCTURA (SIN PRODUCTO)

> Esta fase NO crea funcionalidades.  
> Crea el esqueleto donde todo lo del documento va a vivir.

### Objetivo
Que cada concepto del documento tenga:
- un lugar claro en el sistema
- una frontera definida
- una responsabilidad única

### Se define en esta fase

#### 2.1 Arquitectura general
- Multi-tenant real (owner → comercios → sucursales)
- 3 mundos separados:
  - Owner (estrategia y análisis)
  - Staff (operación)
  - Cliente (wallet y relación)
- Cliente global, wallets por comercio
- Eventos append-only

#### 2.2 Estructura del proyecto
- Monorepo
- Apps separadas:
  - Web (landing)
  - Owner
  - Staff
  - Client
- Packages compartidos:
  - Core (reglas del negocio)
  - DB (modelo y migraciones)
  - UI (solo componentes)
  - Config (tooling)

#### 2.3 Reglas de orden (clave para operar solo)
- Ninguna app accede directo a DB
- Ninguna UI define reglas
- Ningún evento se edita o borra
- Nada se “resuelve” en frontend

### Gate de salida FASE 1
- Estructura creada y documentada
- Se puede explicar dónde vive cada cosa del documento
- El proyecto levanta en local vacío
- No hay lógica de negocio todavía

---

## 3️⃣ FASE 2 — MODELO DE DATOS (EL CORAZÓN)

> Fase crítica. Si está mal, todo lo demás se rompe.

### Objetivo
Traducir el documento a un modelo de datos sólido, escalable y auditable.

### Lo que se implementa

#### 3.1 Identidad y jerarquía
- Owner (cuenta que paga)
- Comercio
- Sucursal
- Staff
- Cliente global

#### 3.2 Relación cliente–comercio
- Membership / Wallet por comercio
- Estados por comercio (no globales)
- Historial completo

#### 3.3 Eventos (núcleo absoluto)
Eventos como:
- visita
- check-in
- check-out
- canje
- reseña
- misión completada
- contacto

Todos:
- inmutables
- con timestamp
- con origen (staff / cliente / sistema)

#### 3.4 Estados derivados
- nuevo
- recurrente
- en riesgo
- perdido

No se guardan como verdad: se calculan.

### Gate de salida FASE 2
- Modelo refleja el documento sin excepciones
- RLS multi-tenant funcionando
- Eventos append-only garantizados
- Se puede reconstruir toda la historia de un cliente

---

## 4️⃣ FASE 3 — BACKEND Y REGLAS DEL NEGOCIO

> Acá el documento “cobra vida”.

### Objetivo
Implementar las reglas reales:
- cuándo pasa algo
- qué efecto tiene
- qué se habilita después

### Incluye

#### 4.1 Motor de eventos
- Validación
- Registro
- Efectos secundarios (puntos, progreso, estados)

#### 4.2 Motor de estados
- Lógica de transición
- Ventanas de tiempo
- Reglas por rubro (in/out vs visita unificada)

#### 4.3 Reglas de misiones y recompensas
- Definición
- Progreso
- Completado
- Canje auditable

### Gate de salida FASE 3
- Backend funciona sin UI
- Dados eventos → estados correctos
- Reglas alineadas al documento

---

## 5️⃣ FASE 4 — END TO END OPERATIVO (STAFF → OWNER)

> Primer producto real, aunque feo.

### Objetivo
Cerrar el circuito mínimo del documento:
**Staff opera → sistema registra → owner entiende**

### Incluye

#### 5.1 Staff App (operación)
- Identificar cliente
- Crear cliente si no existe
- Ejecutar evento (según rubro)
- Canjear recompensa

#### 5.2 Owner Panel (lectura)
- Dashboard básico
- Lista de clientes
- Timeline por cliente
- Estados visibles

### Gate de salida FASE 4
- Caso real completo funcionando
- Sin hacks manuales
- Sin datos “fantasma”

---

## 6️⃣ FASE 5 — UX / UI (RECIÉN ACÁ)

> La UI es 100% modificable porque la lógica ya está cerrada.

### Objetivo
Convertir “funciona” en “se entiende y se vende”.

### Incluye
- Diseño de flujos
- Pantallas por rol
- Componentes reutilizables
- Claridad operativa para staff

### Gate
- La UI no rompe reglas
- La UI no inventa estados
- La UI no ejecuta lógica

---

## 7️⃣ FASE 6 — MISIONES, RECOMPENSAS Y CAMPAÑAS

### Objetivo
Ejecutar el valor comercial del sistema.

Incluye:
- Misiones configurables
- Recompensas
- Campañas WhatsApp (manual al inicio)
- Segmentación por estados

---

## 8️⃣ FASE 7 — OFFLINE Y ROBUSTEZ

> Obligatorio para comercios reales.

Incluye:
- Cola offline
- Sync idempotente
- Prevención de duplicados

---

## 9️⃣ FASE 8 — OBSERVABILIDAD Y ESCALA

Incluye:
- Logs
- Auditoría
- Métricas
- Performance

---

## 🔟 FASE 9 — PRODUCCIÓN Y PILOTOS

Incluye:
- Deploy
- Comercios reales
- Feedback
- Correcciones

---

## 🔒 REGLA FINAL
Si algo no entra naturalmente en este roadmap, se vuelve al documento base (Product Canon).
