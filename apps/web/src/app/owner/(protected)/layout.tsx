export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import OwnerTopbar from "./OwnerTopbar";

/* =========================
   Cookies (compat sync/async)
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

const nav = [
  { href: "/owner", label: "Home" },
  { href: "/owner/rewards", label: "Rewards" },
  { href: "/owner/customers", label: "Clientes" },

  // FUTURO
  { href: "#", label: "Misiones", soon: true },
  { href: "#", label: "Campañas", soon: true },
  { href: "#", label: "Segmentos", soon: true },
  { href: "#", label: "Staff", soon: true },
  { href: "#", label: "Sucursales", soon: true },
  { href: "#", label: "Reportes", soon: true },
  { href: "#", label: "Ajustes", soon: true },
] as const;

export default async function OwnerProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUserId = await getDevAuthUserId();

  // Gate login
  if (!authUserId) redirect("/owner/login");

  return (
    <div className="min-h-screen bg-background">
      {/* Fondo suave tipo SaaS */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_120px,hsl(var(--primary)/0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,transparent,rgba(0,0,0,0.03))]" />
      </div>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-70 border-r bg-background/60 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary/70" />
              <span className="text-sm font-semibold tracking-tight">LOOP</span>
              <span className="text-xs text-muted-foreground">Owner</span>
            </div>

            <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
              v0
            </span>
          </div>

          <nav className="px-3 pb-3">
            <div className="grid gap-1">
              {nav.map((i) => {
                const isSoon = "soon" in i && i.soon;
                if (isSoon) {
                  return (
                    <div
                      key={i.label}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground"
                    >
                      <span>{i.label}</span>
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                        Próximamente
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="
                      rounded-xl px-3 py-2 text-sm
                      text-foreground/80
                      hover:bg-muted
                      hover:text-foreground
                      transition-colors
                    "
                  >
                    {i.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto p-3">
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Sesión DEV</div>
              <div className="mt-1 break-all text-xs font-mono text-foreground/80">
                {authUserId}
              </div>

              <div className="mt-3 grid gap-2">
                <Link href="/owner/onboarding" className="w-full">
                  <Button variant="secondary" className="w-full">
                    Ir a Onboarding
                  </Button>
                </Link>

                <Link href="/owner/login" className="w-full">
                  <Button variant="outline" className="w-full">
                    Cambiar cuenta
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
            <div className="px-4 py-3 md:px-6">
              <OwnerTopbar />
            </div>
          </header>

          {/* Content */}
          <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}