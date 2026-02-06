export const runtime = "nodejs";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/* =========================
   Types
========================= */
type OnboardingStatus = {
  ok: boolean;
  owner?: { owner_id: string };
  onboarding?: { step: number; is_complete: boolean };
  error?: string;
};

type StepResponse =
  | { ok: true; step_completed: number }
  | { ok: false; error: string; expected?: number };



/* =========================
   Cookie helpers (compat sync/async)
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
   API helpers
========================= */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function fetchStatus(authUserId: string): Promise<OnboardingStatus> {
  const res = await fetch(`${BASE_URL}/api/owner/onboarding/status`, {
    headers: { "x-auth-user-id": authUserId },
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, error: `http_${res.status}` };
  return (await res.json()) as OnboardingStatus;
}

async function postStep(authUserId: string, step: number, data: Record<string, unknown>): Promise<StepResponse> {
  const res = await fetch(`${BASE_URL}/api/owner/onboarding/steps`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-user-id": authUserId,
    },
    body: JSON.stringify({ step, data }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as StepResponse | null;

  if (!res.ok || !json || !("ok" in json)) {
    return { ok: false, error: `step_failed_http_${res.status}` };
  }
  return json;
}

/* =========================
   Server Actions
========================= */
async function step1Action(formData: FormData) {
  "use server";

  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();

  const r = await postStep(authUserId, 1, { first_name, last_name });
  if (!r.ok) throw new Error(r.error);

  redirect("/owner/onboarding");
}

async function step2Action(formData: FormData) {
  "use server";

  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  const merchant_name = String(formData.get("merchant_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const zone = String(formData.get("zone") ?? "").trim();

  const r = await postStep(authUserId, 2, { merchant_name, city, zone });
  if (!r.ok) throw new Error(r.error);

  redirect("/owner/onboarding");
}

async function step3Action(formData: FormData) {
  "use server";

  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  const industry = String(formData.get("industry") ?? "").trim();

  const r = await postStep(authUserId, 3, { industry });
  if (!r.ok) throw new Error(r.error);

  // ya completo => al home
  redirect("/owner");
}

/* =========================
   Page
========================= */
export default async function OwnerOnboardingPage() {
  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  const status = await fetchStatus(authUserId);

  if (!status.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Owner • Onboarding</h1>
        <p style={{ marginTop: 12 }}>
          Error status: <code>{status.error ?? "unknown_error"}</code>
        </p>
      </div>
    );
  }

  const step = status.onboarding?.step ?? 0;
  const isComplete = Boolean(status.onboarding?.is_complete);

  if (isComplete) redirect("/owner");

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Configuración inicial</h1>
      <p style={{ marginTop: 8, opacity: 0.75 }}>3 pasos. Solo datos mínimos para habilitar.</p>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ fontWeight: 700 }}>Paso {step + 1} / 3</div>

        {step === 0 && (
          <form action={step1Action} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Nombre</span>
              <input name="first_name" required style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Apellido</span>
              <input name="last_name" required style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }} />
            </label>
            <button type="submit" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}>
              Siguiente →
            </button>
          </form>
        )}

        {step === 1 && (
          <form action={step2Action} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Nombre comercial</span>
              <input name="merchant_name" required style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Ciudad</span>
              <input name="city" required style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Zona (opcional)</span>
              <input name="zone" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }} />
            </label>
            <button type="submit" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}>
              Siguiente →
            </button>
          </form>
        )}

        {step === 2 && (
          <form action={step3Action} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Industria</span>
              <select name="industry" required style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <option value="">Seleccionar…</option>
                <option value="car_wash">Car Wash</option>
                <option value="barber">Barbería</option>
                <option value="gym">Gimnasio</option>
                <option value="restaurant">Restaurant</option>
              </select>
            </label>
            <button type="submit" style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}>
              Terminar →
            </button>
          </form>
        )}
      </div>
    </div>
  );
}