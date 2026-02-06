// apps/web/src/app/owner/register/page.tsx
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/* =========================
   Types
========================= */
type RegisterResponse =
  | { ok: true; auth_user_id: string }
  | { ok: false; error: string };

type SearchParams = Record<string, string | string[] | undefined>;

/* =========================
   Cookie helpers (compat sync/async)
========================= */
async function getCookieStore() {
  const c = cookies() as unknown;
  return (c instanceof Promise ? await c : c) as {
    get(name: string): { value: string } | undefined;
    set: (
      name: string,
      value: string,
      options?: { httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string }
    ) => void;
  };
}

async function setDevAuthCookie(authUserId: string) {
  const c = await getCookieStore();
  c.set("dev_auth_user_id", authUserId, {
    httpOnly: false, // dev only
    sameSite: "lax",
    path: "/",
  });
}

/* =========================
   UI atoms (inline)
========================= */
function Card(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: 18,
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700 }}>{props.title}</div>
      {props.subtitle ? <div style={{ marginTop: 6, opacity: 0.75 }}>{props.subtitle}</div> : null}
      <div style={{ marginTop: 16 }}>{props.children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.18)",
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
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.18)",
        background: "rgba(0,0,0,0.06)",
        cursor: "pointer",
        fontWeight: 600,
        width: "100%",
        ...((props.style as React.CSSProperties) ?? {}),
      }}
    />
  );
}

/* =========================
   Server Action
========================= */
async function doRegister(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");

  if (!email || !password || !password2) {
    redirect("/owner/register?error=missing_fields");
  }

  if (password !== password2) {
    redirect("/owner/register?error=passwords_do_not_match");
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const res = await fetch(`${base}/api/owner/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as RegisterResponse | null;

  // ✅ FIX: sin any, con discriminación de tipos
  if (!res.ok || !json || json.ok === false) {
    const code =
      json && json.ok === false && typeof json.error === "string" ? json.error : "server_error";
    redirect(`/owner/register?error=${encodeURIComponent(code)}`);
  }

  // ok === true
  await setDevAuthCookie(json.auth_user_id);

  redirect("/owner/onboarding");
}

/* =========================
   Page
========================= */
function prettyError(code: string) {
  switch (code) {
    case "missing_fields":
      return "Completá email y contraseña.";
    case "passwords_do_not_match":
      return "Las contraseñas no coinciden.";
    case "email_and_password_required":
      return "Email y contraseña son obligatorios.";
    case "password_too_short":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "email_already_registered":
      return "Ese email ya está registrado.";
    default:
      return `Error: ${code}`;
  }
}

export default async function OwnerRegisterPage(props: { searchParams?: SearchParams }) {
  const sp = props.searchParams ?? {};
  const raw = sp.error;
  const errorCode = Array.isArray(raw) ? raw[0] : raw;

  return (
    <Card title="Owner • Registro" subtitle="Creá tu cuenta para administrar tu comercio.">
      {errorCode ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
            fontSize: 13,
          }}
        >
          {prettyError(String(errorCode))}
        </div>
      ) : null}

      <form action={doRegister} style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
        <Input name="email" type="email" placeholder="nuevo1@loop.com" required />

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Contraseña</div>
        <Input name="password" type="password" placeholder="Password123" minLength={8} required />

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Repetir contraseña</div>
        <Input name="password2" type="password" placeholder="Password123" minLength={8} required />

        <div style={{ marginTop: 8 }}>
          <Button type="submit">Crear cuenta</Button>
        </div>

        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
          ¿Ya tenés cuenta?{" "}
          <a href="/owner/login" style={{ textDecoration: "underline" }}>
            Iniciar sesión
          </a>
        </div>
      </form>
    </Card>
  );
}