import { revalidatePath } from "next/cache";
import Link from "next/link";

export const runtime = "nodejs";

/* =========================
   TIPOS
========================= */

type OwnerRewardsResponse = {
  ok: boolean;
  error?: string;

  owner?: { id: string; name: string };
  merchants?: Array<{ id: string; name: string }>;
  defaults?: { merchant_id: string | null };

  count?: number;
  rewards?: Array<{
    id: string;
    merchant_id: string;
    title: string;
    description: string | null;
    points_cost: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
};

/* =========================
   AUTH HEADER (DEV)
========================= */

function devAuthHeader(): Record<string, string> {
  const id = process.env.DEV_AUTH_USER_ID;
  return id ? { "x-auth-user-id": id } : {};
}

/* =========================
   FETCH
========================= */

async function fetchOwnerRewards() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const url = new URL("/api/owner/rewards", base);

  const res = await fetch(url.toString(), {
    headers: devAuthHeader(),
    cache: "no-store",
  });

  const data = (await res.json()) as OwnerRewardsResponse;
  return { res, data };
}

/* =========================
   SERVER ACTION
========================= */

async function createReward(formData: FormData) {
  "use server";

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points_cost = Number(formData.get("points_cost"));

  if (!title || !Number.isFinite(points_cost) || points_cost <= 0) return;

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await fetch(`${base}/api/owner/rewards`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...devAuthHeader(),
    },
    body: JSON.stringify({ title, description, points_cost }),
    cache: "no-store",
  });

  revalidatePath("/owner/rewards");
}

/* =========================
   PAGE
========================= */

export default async function OwnerRewardsPage() {
  const { res, data } = await fetchOwnerRewards();

  if (!data.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Rewards</h1>
        <p style={{ marginTop: 12 }}>
          Error: <code>{data.error ?? "unknown_error"}</code>
        </p>
        <p style={{ marginTop: 8, opacity: 0.8 }}>Status HTTP: {res.status}</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/owner">← Volver</Link>
        </p>
      </div>
    );
  }

  const ownerName = data.owner?.name ?? "Owner";
  const merchantName = data.merchants?.[0]?.name ?? "—";
  const rewards = data.rewards ?? [];

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 980,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Rewards</h1>
        <div style={{ marginTop: 6, opacity: 0.75 }}>
          {ownerName} • {merchantName}
        </div>
      </div>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          maxWidth: 520,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Crear nuevo reward</h2>

        <form
          action={createReward}
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <input
            name="title"
            placeholder="Título (ej: Lavado Premium -15%)"
            required
            style={{
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          />

          <input
            name="description"
            placeholder="Descripción (opcional)"
            style={{
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          />

          <input
            name="points_cost"
            type="number"
            min={1}
            placeholder="Costo en puntos"
            required
            style={{
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          />

          <button
            type="submit"
            style={{
              marginTop: 6,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Crear reward
          </button>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>
          <strong>{rewards.length}</strong> rewards
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Título</th>
              <th style={{ padding: 12 }}>Costo</th>
              <th style={{ padding: 12 }}>Activo</th>
            </tr>
          </thead>
          <tbody>
            {rewards.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 12 }}>
                  No hay rewards todavía.
                </td>
              </tr>
            ) : (
              rewards.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {r.description ?? "—"}
                    </div>
                  </td>
                  <td style={{ padding: 12 }}>{r.points_cost}</td>
                  <td style={{ padding: 12 }}>{r.is_active ? "Sí" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <Link href="/owner">← Volver</Link>
    </div>
  );
}