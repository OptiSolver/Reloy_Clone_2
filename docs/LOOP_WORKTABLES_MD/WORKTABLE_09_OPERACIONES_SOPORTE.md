# docs/worktables/WORKTABLE_09_OPERACIONES_SOPORTE.md
# WORKTABLE_09 — OPERACIONES & SOPORTE

## 0) Propósito
Definir soporte, fallas típicas, y playbooks.

---

## 1) Incidentes comunes (MVP)
- staff no tiene contexto (auth_user_id no matchea)
- redeem devuelve insufficient_points / already_redeemed
- cliente no aparece por identifier (normalización)
- eventos duplicados (idempotencia)

---

## 2) Playbook rápido
- validar /api/session con header dev
- validar staff.is_active
- validar merchant_id/customer_id con queries base
- ver timeline /api/events

---

## 3) Redirecciones
- Session/auth: WT_03 + WT_10
- Data model: WT_01

Fin.