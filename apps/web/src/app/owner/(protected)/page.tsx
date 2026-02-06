export const runtime = "nodejs";

import { revalidatePath } from "next/cache";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/* =========================
   TIPOS
========================= */

type Reward = {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OwnerRewardsResponse = {
  ok: boolean;
  error?: string;

  owner?: { id: string; name: string };
  merchants?: Array<{ id: string; name: string }>;
  defaults?: { merchant_id: string | null };

  count?: number;
  rewards?: Reward[];
};

type OnboardingStatus = {
  ok: boolean;
  onboarding?: { step: number; is_complete: boolean };
  error?: string;
};

/* =========================
   COOKIES (compat sync/async)
========================= */

async function getCookieStore() {
  const c = cookies() as unknown;
  return (c instanceof Promise ? await c : c) as {
    get(name: string): { value: string } | undefined;
  };
}

async function getDevAuthUserId(): Promise<string | null> {
  const c = await getCookieStore();
  return c.get("dev_auth_user_id")?.value ?? null;
}

/* =========================
   FETCH helpers
========================= */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function apiFetchJson<T>(
  path: string,
  authUserId: string
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-auth-user-id": authUserId },
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, error: `http_${res.status}` };

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "bad_json" };
  }
}

async function fetchOnboardingStatus(authUserId: string): Promise<OnboardingStatus> {
  const r = await apiFetchJson<OnboardingStatus>("/api/owner/onboarding/status", authUserId);
  if (!r.ok) return { ok: false, error: r.error };
  return r.data;
}

async function fetchOwnerRewards(authUserId: string) {
  return apiFetchJson<OwnerRewardsResponse>("/api/owner/rewards", authUserId);
}

/* =========================
   UI helpers (server component)
========================= */

function PageShell(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "white" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>LOOP • Owner</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{props.title}</h1>
            <Link href="/" style={{ fontSize: 13, opacity: 0.8 }}>
              Salir / Cambiar rol
            </Link>
          </div>
          {props.subtitle ? <div style={{ fontSize: 13, opacity: 0.75 }}>{props.subtitle}</div> : null}
        </header>

        {props.children}
      </div>
    </div>
  );
}

function Panel(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{props.title}</div>
          {props.subtitle ? <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>{props.subtitle}</div> : null}
        </div>
        {props.right ? <div>{props.right}</div> : null}
      </div>
      <div style={{ padding: 14 }}>{props.children}</div>
    </section>
  );
}

function StatPill(props: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        fontSize: 13,
      }}
    >
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        outline: "none",
        fontSize: 14,
        ...((props.style as React.CSSProperties) ?? {}),
      }}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        fontWeight: 700,
        cursor: "pointer",
        background: "rgba(0,0,0,0.04)",
        ...((props.style as React.CSSProperties) ?? {}),
      }}
    />
  );
}

/* =========================
   SERVER ACTION
========================= */

async function createReward(formData: FormData) {
  "use server";

  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length ? descriptionRaw : null;

  const pointsCostRaw = String(formData.get("points_cost") ?? "").trim();
  const points_cost = Number(pointsCostRaw);

  if (!title) return;
  if (!Number.isFinite(points_cost) || points_cost <= 0) return;

  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  await fetch(`${BASE_URL}/api/owner/rewards`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-user-id": authUserId,
    },
    body: JSON.stringify({ title, description, points_cost }),
    cache: "no-store",
  });

  revalidatePath("/owner");
}

/* =========================
   PAGE
========================= */

export default async function OwnerHomePage() {
  const authUserId = await getDevAuthUserId();

  // 1) login gate
  if (!authUserId) redirect("/owner/login");

  // 2) onboarding gate
  const status = await fetchOnboardingStatus(authUserId);
  if (!status.ok || !status.onboarding?.is_complete) redirect("/owner/onboarding");

  // 3) data
  const rewardsResp = await fetchOwnerRewards(authUserId);
  if (!rewardsResp.ok) {
    return (
      <PageShell title="Home" subtitle="No pudimos cargar tu información.">
        <Panel title="Error" subtitle="Falló el fetch de /api/owner/rewards">
          <div style={{ fontSize: 13 }}>
            Código: <code>{rewardsResp.error}</code>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/owner/onboarding">Ir a onboarding</Link>
            <Link href="/owner/login">Volver a login</Link>
          </div>
        </Panel>
      </PageShell>
    );
  }

  const payload = rewardsResp.data;
  if (!payload.ok) {
    return (
      <PageShell title="Home" subtitle="La API respondió con error.">
        <Panel title="Error" subtitle="Respuesta inválida de /api/owner/rewards">
          <div style={{ fontSize: 13 }}>
            Error: <code>{payload.error ?? "unknown_error"}</code>
          </div>
        </Panel>
      </PageShell>
    );
  }

  const ownerName = payload.owner?.name ?? "Owner";
  const merchant = payload.merchants?.[0] ?? null;
  const merchantName = merchant?.name ?? "—";
  const rewards = payload.rewards ?? [];

  return (
    <PageShell title="Home" subtitle={`${ownerName} • ${merchantName}`}>
      {/* STATUS BAR */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatPill label="Onboarding" value="Completo" />
        <StatPill label="Rewards" value={String(rewards.length)} />
        <StatPill label="Merchant" value={merchant ? "OK" : "—"} />
      </div>

      {/* QUICK ACTIONS */}
      <Panel
        title="Acciones rápidas"
        subtitle="Atajos para operar el día 1."
        right={<Link href="/owner/onboarding">Editar onboarding</Link>}
      >
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Link
            href="/owner/rewards"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 800 }}>Rewards</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>Ver y administrar recompensas.</div>
          </Link>

          <Link
            href="/owner/dashboard"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 800 }}>Dashboard</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>Métricas y estado general.</div>
          </Link>

          <Link
            href="/owner/onboarding"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 800 }}>Config inicial</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>Nombre, comercio, rubro.</div>
          </Link>
        </div>
      </Panel>

      {/* CREATE REWARD */}
      <Panel title="Crear reward" subtitle="Lo mínimo para empezar a operar recompensas desde el día 1.">
        <form action={createReward} style={{ display: "grid", gap: 10, maxWidth: 560 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Título</div>
            <Input name="title" placeholder="Ej: Lavado Premium -15%" required />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Descripción (opcional)</div>
            <Input name="description" placeholder="Ej: válido de lunes a jueves" />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Costo en puntos</div>
            <Input name="points_cost" type="number" min={1} placeholder="Ej: 250" required />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Button type="submit">Crear reward</Button>
            </div>
            <div style={{ flex: "1 1 220px", display: "grid", placeItems: "center", fontSize: 13, opacity: 0.75 }}>
              Tip: empezá con 3 rewards (barato / medio / premium).
            </div>
          </div>
        </form>
      </Panel>

      {/* LIST */}
      <Panel
        title="Rewards existentes"
        subtitle="Listado operativo."
        right={<Link href="/owner/rewards">Ver todo</Link>}
      >
        {rewards.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Todavía no hay rewards. Creá el primero arriba.
          </div>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: 10, borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>
              <strong>{rewards.length}</strong> rewards
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa", textAlign: "left" }}>
                  <th style={{ padding: 10, fontSize: 13 }}>Título</th>
                  <th style={{ padding: 10, fontSize: 13, width: 120 }}>Puntos</th>
                  <th style={{ padding: 10, fontSize: 13, width: 120 }}>Activo</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 800 }}>{r.title}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{r.description ?? "—"}</div>
                    </td>
                    <td style={{ padding: 10, fontSize: 13 }}>{r.points_cost}</td>
                    <td style={{ padding: 10, fontSize: 13 }}>{r.is_active ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* FOOT NAV */}
      <footer style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, opacity: 0.85 }}>
        <Link href="/owner">Home</Link>
        <Link href="/owner/dashboard">Dashboard</Link>
        <Link href="/owner/rewards">Rewards</Link>
        <Link href="/owner/onboarding">Onboarding</Link>
      </footer>
    </PageShell>
  );
}