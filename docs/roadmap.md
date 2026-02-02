# LOOP — Roadmap oficial del proyecto

Este documento define el line-up completo del proyecto Loop, desde 0 hasta producción.
Regla: no se avanza de fase sin cumplir el gate de salida.

---

## BLOQUE 0 — Preparación (antes de FASE 1)
- Documentación base + Freeze
- Requirements Tracker
- Entorno local limpio y rápido
- Repo inicial versionado
- Convenciones y governance mínima

Gate:
- Repo inicial OK
- /docs completo
- Tracker presente

---

## FASE 1 — Estructura del proyecto (monorepo)
Objetivo: esqueleto sólido, escalable y ordenado.

Entregables:
- Monorepo con apps y packages
- Tooling (eslint, prettier, ts)
- Scripts base

Gate:
- pnpm dev levanta todo
- estructura documentada

---

## FASE 2 — Base de datos (MVP blindado)
Objetivo: corazón del sistema listo para escalar.

Entregables:
- Schema DB
- RLS multi-tenant
- Constraints e índices
- Seed mínimo

Gate:
- Seguridad validada
- append-only events

---

## FASE 3 — Backend / APIs
Objetivo: sistema funcional sin depender de UI.

Entregables:
- Auth
- Endpoints MVP
- Contratos en core

Gate:
- flujo staff → evento → DB

---

## FASE 4 — End-to-end funcional
Objetivo: producto vivo.

Entregables:
- Staff App operativa
- Owner panel mínimo
- Motor de puntos/estado

Gate:
- caso real completo funcionando

---

## FASE 5 — UX / UI
Objetivo: convertir funcional en vendible.

---

## FASE 6 — Misiones, recompensas y canjes

---

## FASE 7 — Campañas WhatsApp + reseñas

---

## FASE 8 — Offline + sync

---

## FASE 9 — Observabilidad y hardening

---

## FASE 10 — Producción y pilotos
