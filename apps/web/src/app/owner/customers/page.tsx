// apps/web/src/app/owner/customers/page.tsx
export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/* =========================
   TIPOS
========================= */

type CustomerRow = {
  customer_id: string;
  merchant_id: string;
  merchant_name: string;
  status: string;
  points_balance: number;

  identifier_type: string | null;
  identifier_value_raw: string | null;
  identifier_value_normalized: string | null;

  last_event_type: string | null;
  last_event_at: string | null;
  branch_name: string | null;
};

type OwnerCustomersResponse = {
  ok: boolean;
  error?: string;

  owner?: { id: string; name: string };
  merchants?: Array<{ id: string; name: string }>;
  defaults?: { merchant_id: string | null };

  count?: number;
  customers?: CustomerRow[];
};

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

/* =========================
   FETCH
========================= */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function fetchOwnerCustomers(authUserId: string, q?: string) {
  const url = new URL("/api/owner/customers", BASE_URL);
  if (q && q.trim().length > 0) url.searchParams.set("q", q.trim());

  const res = await fetch(url.toString(), {
    headers: { "x-auth-user-id": authUserId },
    cache: "no-store",
  });

  const data = (await res.json()) as OwnerCustomersResponse;
  return { res, data };
}

/* =========================
   HELPERS
========================= */

function formatInt(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();

  // Mapeo simple (lo refinamos cuando “status” esté canonizado)
  if (s.includes("lost") || s.includes("perd")) return <Badge variant="destructive">Perdido</Badge>;
  if (s.includes("risk") || s.includes("ries")) return <Badge variant="secondary">En riesgo</Badge>;
  if (s.includes("recurr") || s.includes("repeat")) return <Badge variant="secondary">Recurrente</Badge>;
  if (s.includes("new") || s.includes("nuevo")) return <Badge variant="secondary">Nuevo</Badge>;

  return <Badge variant="secondary">{status || "—"}</Badge>;
}

/* =========================
   PAGE
========================= */

export default async function OwnerCustomersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const authUserId = await getDevAuthUserId();

  if (!authUserId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Card className="p-5">
          <div className="text-lg font-semibold">Clientes</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Falta <code className="font-mono">dev_auth_user_id</code> en cookie (dev).
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Tip: iniciá sesión desde <code className="font-mono">/owner/login</code> para setearla.
          </div>
          <div className="mt-4">
            <Link href="/owner">
              <Button variant="outline">Volver</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const q = (searchParams?.q ?? "").trim();

  const { res, data } = await fetchOwnerCustomers(authUserId, q);

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Card className="p-5">
          <div className="text-lg font-semibold">Clientes</div>
          <div className="mt-2 text-sm">
            Error: <code className="font-mono">{data.error ?? "unknown_error"}</code>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">HTTP: {res.status}</div>
          <div className="mt-4">
            <Link href="/owner">
              <Button variant="outline">Volver</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const ownerName = data.owner?.name ?? "Owner";
  const merchantName = data.merchants?.[0]?.name ?? "—";
  const customers = data.customers ?? [];
  const count = data.count ?? customers.length;

  const statusCounts = customers.reduce<Record<string, number>>((acc, c) => {
    const k = (c.status ?? "unknown").toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // intentamos agrupar “lo importante” aunque el status sea libre
  const newCount = Object.entries(statusCounts).reduce((n, [k, v]) => (k.includes("new") || k.includes("nuevo") ? n + v : n), 0);
  const recurrentCount = Object.entries(statusCounts).reduce((n, [k, v]) => (k.includes("recurr") || k.includes("repeat") ? n + v : n), 0);
  const riskCount = Object.entries(statusCounts).reduce((n, [k, v]) => (k.includes("risk") || k.includes("ries") ? n + v : n), 0);
  const lostCount = Object.entries(statusCounts).reduce((n, [k, v]) => (k.includes("lost") || k.includes("perd") ? n + v : n), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Owner • {merchantName}</div>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <div className="text-sm text-muted-foreground">
            Datos operativos para entender actividad y segmentación (mientras el staff carga eventos).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/owner">
            <Button variant="outline">Volver</Button>
          </Link>
          <Link href="/owner">
            <Button variant="secondary">Ir a Home</Button>
          </Link>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Search */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold">Búsqueda</div>
            <div className="text-sm text-muted-foreground">
              Por teléfono / email / identificador. ({ownerName})
            </div>
          </div>

          <form action="/owner/customers" className="flex w-full gap-2 md:w-[520px]">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar cliente…"
            />
            <Button type="submit">Buscar</Button>
            <Link href="/owner/customers">
              <Button type="button" variant="outline">
                Reset
              </Button>
            </Link>
          </form>
        </div>
      </Card>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(count)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Clientes detectados</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Nuevos</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(newCount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Primer contacto</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Recurrentes</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(recurrentCount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Vuelven seguido</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">En riesgo</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(riskCount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">A recuperar</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Perdidos</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(lostCount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Inactivos</div>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-base font-semibold">Listado</div>
            <div className="text-sm text-muted-foreground">
              {formatInt(customers.length)} filas • Mostramos máxima data disponible.
            </div>
          </div>
          <Badge variant="secondary">v1</Badge>
        </div>

        <Separator className="my-4" />

        {customers.length === 0 ? (
          <div className="rounded-2xl border bg-muted/20 p-6">
            <div className="text-sm font-semibold">Todavía no hay clientes</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Cuando el staff empiece a registrar eventos, acá vas a ver actividad real.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Puntos</th>
                  <th className="px-3 py-2">Último evento</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Sucursal</th>
                  <th className="px-3 py-2">Merchant</th>
                  <th className="px-3 py-2">Acción</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((c) => (
                  <tr key={c.customer_id} className="border-t">
                    <td className="px-3 py-3 align-top">
                      <div className="text-sm font-semibold">
                        {c.identifier_value_raw ?? c.identifier_value_normalized ?? c.customer_id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.identifier_type ?? "—"} •{" "}
                        <span className="font-mono">{c.customer_id}</span>
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <StatusBadge status={c.status} />
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        raw: <span className="font-mono">{c.status ?? "—"}</span>
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div className="text-sm font-semibold tabular-nums">{formatInt(c.points_balance ?? 0)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">balance</div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div className="text-sm font-medium">{c.last_event_type ?? "—"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        normalizado: {c.identifier_value_normalized ?? "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                      {shortDate(c.last_event_at)}
                    </td>

                    <td className="px-3 py-3 align-top text-sm">
                      {c.branch_name ?? <span className="text-muted-foreground">—</span>}
                    </td>

                    <td className="px-3 py-3 align-top text-sm">
                      <div className="font-medium">{c.merchant_name ?? "—"}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground font-mono">{c.merchant_id}</div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <Link href={`/owner/customers/${c.customer_id}`}>
                        <Button size="sm" variant="outline">
                          Ver detalle
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}