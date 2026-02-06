export const runtime = "nodejs";

import Link from "next/link";

function Shell(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", padding: 28, display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>LOOP</div>
          <h1 style={{ margin: "6px 0 0 0", fontSize: 28, fontWeight: 800 }}>{props.title}</h1>
          {props.subtitle ? <div style={{ marginTop: 8, opacity: 0.75 }}>{props.subtitle}</div> : null}
        </div>

        <div
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 16,
            padding: 18,
            background: "rgba(0,0,0,0.03)",
          }}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}

function CardLink(props: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={props.href}
      style={{
        display: "block",
        padding: 14,
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.10)",
        textDecoration: "none",
        marginTop: 10,
        color: "inherit",
      }}
    >
      <div style={{ fontWeight: 750 }}>{props.title}</div>
      <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>{props.desc}</div>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <Shell
      title="Elegí tu rol"
      subtitle="La landing solo decide el mundo. Cada mundo tiene su login y su flujo propio."
    >
      <CardLink href="/owner/login" title="Owner" desc="Dueño / Admin del comercio" />
      <CardLink href="/staff/login" title="Staff" desc="Operación rápida en sucursal" />
      <CardLink href="/app/login" title="Cliente" desc="Wallet, misiones, recompensas" />
    </Shell>
  );
}