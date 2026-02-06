export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type ApiOk = { ok: true; auth_user_id: string };
type ApiErr = { ok: false; error: string };
type ApiResp = ApiOk | ApiErr;

function Card(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 18, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{props.title}</div>
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
        ...(props.style ?? {}),
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
        fontWeight: 700,
        width: "100%",
        ...(props.style ?? {}),
      }}
    />
  );
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function doRegister(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) return;

  const res = await fetch(`${BASE_URL}/api/owner/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as ApiResp | null;

  if (!res.ok || !json || !json.ok) {
    // por ahora simple: si querés, después lo mostramos en UI con searchParams (?e=)
    return;
  }

  const auth_user_id = json.auth_user_id;

  const c = cookies() as unknown;
  const store = (c instanceof Promise ? await c : c) as {
    set: (name: string, value: string, opts: { httpOnly: boolean; sameSite: "lax" | "strict" | "none"; path: string; secure?: boolean }) => void;
  };

  store.set("auth_user_id", auth_user_id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/owner");
}

export default function OwnerRegisterPage() {
  return (
    <Card title="Crear cuenta (Owner)" subtitle="Registrate con email y contraseña para administrar tu comercio.">
      <form action={doRegister} style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Email</div>
        <Input name="email" type="email" placeholder="tu@email.com" required />

        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Contraseña</div>
        <Input name="password" type="password" placeholder="mínimo 8 caracteres" required />

        <Button type="submit" style={{ marginTop: 8 }}>Crear cuenta</Button>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
          ¿Ya tenés cuenta? <Link href="/owner/login">Iniciar sesión</Link>
        </div>
      </form>
    </Card>
  );
}