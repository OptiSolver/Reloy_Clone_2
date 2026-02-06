export const runtime = "nodejs";

import Link from "next/link";

type OwnerCustomerDetailResponse = {
  ok: boolean;
  error?: string;

  owner?: { id: string; name: string };
  merchants?: Array<{ id: string; name: string }>;

  merchant_id?: string;
  customer_id?: string;

  membership?: {
    id: string;
    merchant_id: string;
    customer_id: string;
    status: string;
    points_balance: number;
    created_at: string;
    updated_at: string;
  };

  identifiers?: Array<{
    id: string;
    type: string;
    value_raw: string;
    value_normalized: string;
    is_primary: boolean;
    verified_at: string | null;
    created_at: string;
  }>;

  last_event?: {
    id: string;
    type: string;
    occurred_at: string;
    branch_id: string | null;
    staff_id: string | null;
    payload: unknown;
    branch_name: string | null;
  } | null;
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * Dev auth para Server Components:
 * usamos DEV_AUTH_USER_ID desde .env (server-side).
 * (No cookies, no headers del browser).
 */
function devAuthHeader(): HeadersInit {
  const id = process.env.DEV_AUTH_USER_ID;
  return id && isUuid(id) ? { "x-auth-user-id": id } : {};
}

/**
 * Next moderno puede entregar params como Promise.
 * Sin any.
 */
async function unwrapParams(
  params: Promise<{ customer_id: string }> | { customer_id: string }
): Promise<{ customer_id: string }> {
  const pUnknown: unknown = params;

  if (pUnknown && typeof pUnknown === "object") {
    const r = pUnknown as Record<string, unknown>;
    if (typeof r.then === "function") {
      return (params as Promise<{ customer_id: string }>);
    }
  }

  return params as { customer_id: string };
}

async function fetchCustomerDetail(customerId: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const url = new URL(`/api/owner/customers/${customerId}`, base);

  const res = await fetch(url.toString(), {
    headers: devAuthHeader(),
    cache: "no-store",
  });

  const data = (await res.json()) as OwnerCustomerDetailResponse;
  return { res, data };
}

export default async function OwnerCustomerDetailPage(props: {
  params: Promise<{ customer_id: string }> | { customer_id: string };
}) {
  const { customer_id } = await unwrapParams(props.params);

  const { res, data } = await fetchCustomerDetail(customer_id);

  if (!data.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <Link href="/owner/customers" style={{ textDecoration: "none" }}>
            ← Volver
          </Link>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Detalle de cliente</h1>

        <p>
          Error: <code>{data.error ?? "unknown_error"}</code>
        </p>
        <p style={{ opacity: 0.8 }}>Status HTTP: {res.status}</p>

        <p style={{ opacity: 0.8 }}>
          Tip: asegurate de tener <code>DEV_AUTH_USER_ID</code> en <code>.env</code>.
        </p>
      </div>
    );
  }

  const ownerName = data.owner?.name ?? "Owner";
  const merchantName = data.merchants?.[0]?.name ?? "—";

  const identifiers = data.identifiers ?? [];
  const primary = identifiers.find((i) => i.is_primary) ?? identifiers[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Link href="/owner/customers" style={{ textDecoration: "none" }}>
          ← Volver
        </Link>
      </div>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Detalle de cliente</h1>
        <div style={{ marginTop: 6, opacity: 0.75 }}>
          {ownerName} • {merchantName}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          {primary?.value_raw ?? data.customer_id}
        </div>

        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          customer_id: <code>{data.customer_id}</code>
        </div>

        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          status: <strong>{data.membership?.status ?? "—"}</strong> • puntos:{" "}
          <strong>{data.membership?.points_balance ?? 0}</strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Identificadores</h2>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {identifiers.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No hay identificadores.</div>
            ) : (
              identifiers.map((i) => (
                <div
                  key={i.id}
                  style={{
                    padding: 10,
                    border: "1px solid #f3f4f6",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {i.value_raw}{" "}
                    {i.is_primary ? (
                      <span style={{ opacity: 0.7, fontSize: 12 }}>(primary)</span>
                    ) : null}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    {i.type} • {i.value_normalized}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Último evento</h2>

          <div style={{ marginTop: 10 }}>
            {!data.last_event ? (
              <div style={{ opacity: 0.75 }}>Todavía no hay eventos.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <strong>{data.last_event.type}</strong>{" "}
                  <span style={{ opacity: 0.75 }}>
                    • {data.last_event.occurred_at}
                  </span>
                </div>

                <div style={{ opacity: 0.75 }}>
                  Sucursal: <strong>{data.last_event.branch_name ?? "—"}</strong>
                </div>

                <details>
                  <summary style={{ cursor: "pointer" }}>Payload</summary>
                  <pre style={{ marginTop: 10, fontSize: 12 }}>
                    {JSON.stringify(data.last_event.payload, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </section>
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