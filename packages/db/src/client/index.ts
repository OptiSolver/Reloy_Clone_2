import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __loopPgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definido en el entorno");
}

// Reutilizamos el pool en dev (para evitar abrir 100 conexiones con hot reload)
export const pool =
  global.__loopPgPool ??
  new Pool({
    connectionString,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  global.__loopPgPool = pool;
}