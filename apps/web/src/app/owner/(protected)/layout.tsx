// apps/web/src/app/owner/(protected)/layout.tsx
export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  LayoutDashboard,
  Users,
  Gift,
  Sparkles,
  Settings,
  Activity,
  Bell,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
};

const nav: NavItem[] = [
  { href: "/owner", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { href: "/owner/customers", label: "Clientes", icon: <Users className="size-4" /> },
  { href: "/owner/rewards", label: "Rewards", icon: <Gift className="size-4" /> },

  { href: "/owner", label: "Fidelización", icon: <Sparkles className="size-4" />, soon: true },
  { href: "/owner", label: "Operaciones", icon: <Activity className="size-4" />, soon: true },
  { href: "/owner", label: "Insights", icon: <Sparkles className="size-4" />, soon: true },

  { href: "/owner", label: "Configuración", icon: <Settings className="size-4" />, soon: true },
];

function NavLink({
  href,
  children,
  active,
  soon,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  soon?: boolean;
}) {
  return (
    <Link
      href={soon ? "#" : href}
      aria-disabled={soon ? "true" : undefined}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
        "text-foreground/80 hover:text-foreground",
        "hover:bg-muted/60",
        active ? "bg-muted text-foreground shadow-sm" : "",
        soon ? "opacity-60 pointer-events-none" : ""
      )}
    >
      {children}
    </Link>
  );
}

export default async function OwnerProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUserId = await getDevAuthUserId();

  // Gate login
  if (!authUserId) redirect("/owner/login");

  // (v1) activo simple: no hacemos hook de pathname para mantenerlo server-only
  // Luego, cuando hagamos sidebar colapsable, lo convertimos en client + pathname.
  const activeHref = "/owner";

  return (
    <div className="min-h-screen bg-background">
      {/* Fondo suave tipo SaaS */}
      <div className="pointer-events-none fixed inset-0 -z-10 loop-hero" />

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-72 border-r bg-background/70 backdrop-blur md:flex md:flex-col">
          {/* Brand block */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-content-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <span className="text-sm font-bold">L</span>
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-tight">LOOP</div>
                  <div className="text-xs text-muted-foreground">Owner Panel</div>
                </div>
              </div>

              <Badge variant="secondary" className="rounded-full">
                v0
              </Badge>
            </div>

            <div className="mt-4 rounded-2xl border bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Sesión DEV</div>
              <div className="mt-1 break-all text-xs font-mono text-foreground/80">
                {authUserId}
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="px-3 pb-3">
            <div className="grid gap-1">
              {nav.map((i) => (
                <NavLink
                  key={i.label}
                  href={i.href}
                  active={i.href === activeHref}
                  soon={i.soon}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {i.icon}
                    </span>
                    <span>{i.label}</span>
                  </div>
                  {i.soon ? (
                    <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                      Coming soon
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Bottom actions */}
          <div className="mt-auto p-3">
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Acciones rápidas</div>
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
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="flex items-center gap-3">
                <div className="hidden md:grid size-9 place-content-center rounded-2xl bg-muted/60">
                  <LayoutDashboard className="size-4 text-muted-foreground" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">Dashboard</div>
                  <div className="text-xs text-muted-foreground">
                    Overview • Owner
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:block">
                  <div className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                    ⌘K Buscar (próximo)
                  </div>
                </div>

                <Button variant="outline" size="sm">
                  <Bell className="mr-2 size-4" />
                  Alertas
                </Button>

                <Link href="/owner/rewards">
                  <Button size="sm">Nuevo reward</Button>
                </Link>
              </div>
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