export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const table = url.searchParams.get("table") || "owners";
  const schema = url.searchParams.get("schema") || "public";

  const client = await pool.connect();
  try {
    const cols = await client.query(
      `select
         table_schema, table_name, column_name,
         is_nullable, data_type, column_default
       from information_schema.columns
       where table_schema = $1 and table_name = $2
       order by ordinal_position`,
      [schema, table]
    );

    return NextResponse.json({ ok: true, schema, table, columns: cols.rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
  } finally {
    client.release();
  }
}
