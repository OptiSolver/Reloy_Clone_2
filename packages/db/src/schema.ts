// Schema inicial (vacío por ahora).
// En FASE 2.2 vamos a definir tablas mínimas: owners, merchants, branches, staff, customers, memberships, events.

import { pgTable } from "drizzle-orm/pg-core";

// placeholder para que el archivo compile aunque no tenga tablas
export const __placeholder = pgTable("__placeholder", {});
