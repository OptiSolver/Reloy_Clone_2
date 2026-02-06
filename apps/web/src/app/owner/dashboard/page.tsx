export const dynamic = "force-dynamic";

type DashboardRes = {
  ok: boolean;
  owner: { id: string; name: string };
  merchants: Array<{ id: string; name: string }>;
  kpis: {
    total_customers: number;
    total_events: number;
    total_staff: number;
  };
};

type ActivityRes = {
  ok: boolean;
  owner: { id: string; name: string };
  merchants: Array<{ id: string; name: string }>;
  recent_events: Array<{
    id: string;
    type: string;
    customer_id: string;
    branch_id: string | null;
    occurred_at: string;
    branch_name: string | null;
  }>;
  recent_customers: Array<{
    customer_id: string;
    last_event_type: string | null;
    last_event_at: string | null;
    branch_name: string | null;
  }>;
};

async function fetchJson<T>(url: string) {
  const res = await fetch(url, {
    headers: {
      // DEV AUTH fijo (por ahora)
      "x-auth-user-id": "11111111-1111-4111-8111-111111111111",
    },
    cache: "no-store",
  });

  // si explota, queremos ver el body
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} -> ${JSON.stringify(data)}`
    );
  }

  return data as T;
}

export default async function OwnerDashboardPage() {
  const dashboard = await fetchJson<DashboardRes>(
    "http://localhost:3000/api/owner/dashboard"
  );

  const activity = await fetchJson<ActivityRes>(
    "http://localhost:3000/api/owner/dashboard/activity"
  );

  const merchantName = dashboard.merchants?.[0]?.name ?? "—";

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 6 }}>
        Dashboard
      </h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        {dashboard.owner.name} • {merchantName}
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <KpiCard title="Clientes" value={dashboard.kpis.total_customers} />
        <KpiCard title="Eventos" value={dashboard.kpis.total_events} />
        <KpiCard title="Staff" value={dashboard.kpis.total_staff} />
      </div>

      {/* Activity */}
      <div style={{ display: "flex", gap: 24 }}>
        <section style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Actividad reciente (eventos)
          </h2>

          {activity.recent_events.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Todavía no hay eventos.</div>
          ) : (
            <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activity.recent_events.map((e) => (
                <li
                  key={e.id}
                  style={{
                    border: "1px solid #333",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{e.type}</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    customer: {e.customer_id}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    branch: {e.branch_name ?? e.branch_id ?? "—"}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    occurred_at: {e.occurred_at}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Clientes recientes (última actividad)
          </h2>

          {activity.recent_customers.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Todavía no hay clientes con actividad.</div>
          ) : (
            <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activity.recent_customers.map((c) => (
                <li
                  key={c.customer_id}
                  style={{
                    border: "1px solid #333",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{c.customer_id}</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    last_event: {c.last_event_type ?? "—"}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    at: {c.last_event_at ?? "—"}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    branch: {c.branch_name ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Debug (temporal) */}
      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Debug</h2>
      <pre style={{ fontSize: 12, opacity: 0.8 }}>
        {JSON.stringify({ dashboard, activity }, null, 2)}
      </pre>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 12,
        padding: 14,
        minWidth: 160,
      }}
    >
      <div style={{ opacity: 0.8, fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}