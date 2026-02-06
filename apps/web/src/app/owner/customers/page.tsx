export const runtime = "nodejs";

import Link from "next/link";

type OwnerCustomersResponse = {
  ok: boolean;
  error?: string;

  owner?: { id: string; name: string };
  merchants?: Array<{ id: string; name: string }>;
  defaults?: { merchant_id: string | null };

  count?: number;
  customers?: Array<{
    customer_id: string;
    merchant_id: string;
    merchant_name: string;
    status: string;
    points_balance: number;

    identifier_type: string | null;
    identifier_value_raw: string | null;
    identifier_value_normalized: string | null;

    last_event_type: string | null;
    last_event_at: string | null;
    branch_name: string | null;
  }>;
};

function devAuthHeader(): Record<string, string> {
  const id = process.env.DEV_AUTH_USER_ID ?? "";
  return id ? { "x-auth-user-id": id } : {};
}

async function fetchOwnerCustomers(q?: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const url = new URL("/api/owner/customers", base);
  if (q && q.trim().length > 0) url.searchParams.set("q", q.trim());

  const res = await fetch(url.toString(), {
    headers: devAuthHeader(),
    cache: "no-store",
  });

  const data = (await res.json()) as OwnerCustomersResponse;
  return { res, data };
}

export default async function OwnerCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = sp.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;

  const { res, data } = await fetchOwnerCustomers(q);

  if (!data.ok) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clientes</h1>
        <p style={{ marginTop: 12 }}>
          Error: <code>{data.error ?? "unknown_error"}</code>
        </p>
        <p style={{ marginTop: 8, opacity: 0.8 }}>Status HTTP: {res.status}</p>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Tip: en UI server-side usá <code>DEV_AUTH_USER_ID</code> en <code>.env</code>
        </p>
      </div>
    );
  }

  const ownerName = data.owner?.name ?? "Owner";
  const merchantName = data.merchants?.[0]?.name ?? "—";
  const customers = data.customers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clientes</h1>
        <div style={{ marginTop: 6, opacity: 0.75 }}>
          {ownerName} • {merchantName}
        </div>
      </div>

      <form
        action="/owner/customers"
        style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 520 }}
      >
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por teléfono / email / identificador…"
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Buscar
        </button>
        <Link
          href="/owner/customers"
          style={{
            padding: "10px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Reset
        </Link>
      </form>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>
          <strong>{data.count ?? customers.length}</strong> clientes
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left" }}>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Identificador</th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Puntos</th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Última actividad</th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Sucursal</th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td style={{ padding: 12 }} colSpan={5}>
                    No hay clientes todavía.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.customer_id}>
                    <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ fontWeight: 600 }}>
                        {c.identifier_value_raw ?? c.customer_id}
                      </div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        {c.identifier_type ?? "—"} • {c.status}
                      </div>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                      {c.points_balance}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                      {c.last_event_type ?? "—"}
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        {c.last_event_at ?? ""}
                      </div>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                      {c.branch_name ?? "—"}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                      <Link
                        href={`/owner/customers/${c.customer_id}`}
                        style={{ textDecoration: "none", fontWeight: 600 }}
                      >
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details style={{ opacity: 0.85 }}>
        <summary style={{ cursor: "pointer" }}>Debug</summary>
        <pre style={{ marginTop: 10, fontSize: 12 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}