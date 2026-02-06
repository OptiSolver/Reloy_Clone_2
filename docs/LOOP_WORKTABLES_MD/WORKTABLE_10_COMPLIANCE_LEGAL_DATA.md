# docs/worktables/WORKTABLE_10_COMPLIANCE_LEGAL_DATA.md
# WORKTABLE_10 — COMPLIANCE / LEGAL / DATA

## 0) Propósito
Definir:
- privacidad
- retención de datos
- auth real (prod)
- RLS/policies (si se usa Supabase)
- auditoría (event sourcing ayuda)

---

## 1) Datos personales (PII)
- customer_identifiers puede contener: teléfono/email/documento
Regla:
- value_raw se guarda porque es útil operativamente, pero:
  - value_normalized es el “índice” de búsqueda
  - minimizar exposición en UI

---

## 2) Auth prod (pendiente)
- Migrar de header dev a JWT
- Definir sesión de cliente y owner

---

## 3) Retención
- events append-only: definir política (nunca borrar vs borrar demo)
- si hay “demo_run_id”: habilitar reset de demo sin tocar prod

---

## 4) Redirecciones
- Session endpoints: WT_03
- Data model: WT_01

Fin.