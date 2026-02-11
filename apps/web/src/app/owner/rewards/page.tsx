// apps/web/src/app/owner/rewards/page.tsx
export const runtime = "nodejs";

import { revalidatePath } from "next/cache";
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

type RewardTemplate = {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  tag: string;
};

type TemplateCategory = {
  key: "general" | "cafe" | "beauty" | "fitness" | "auto" | "retail";
  label: string;
  badge?: string;
  templates: RewardTemplate[];
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

async function fetchOwnerRewards(authUserId: string) {
  const url = new URL("/api/owner/rewards", BASE_URL);
  const res = await fetch(url.toString(), {
    headers: { "x-auth-user-id": authUserId },
    cache: "no-store",
  });
  const data = (await res.json()) as OwnerRewardsResponse;
  return { res, data };
}

/* =========================
   SERVER ACTIONS
========================= */

async function createReward(formData: FormData) {
  "use server";

  const authUserId = await getDevAuthUserId();
  if (!authUserId) return;

  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length ? descriptionRaw : null;

  const pointsCostRaw = String(formData.get("points_cost") ?? "").trim();
  const points_cost = Number(pointsCostRaw);

  if (!title || !Number.isFinite(points_cost) || points_cost <= 0) return;

  await fetch(`${BASE_URL}/api/owner/rewards`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-user-id": authUserId,
    },
    body: JSON.stringify({ title, description, points_cost }),
    cache: "no-store",
  });

  revalidatePath("/owner/rewards");
}

async function createTemplateReward(formData: FormData) {
  "use server";

  const authUserId = await getDevAuthUserId();
  if (!authUserId) return;

  const title = String(formData.get("t_title") ?? "").trim();
  const descriptionRaw = String(formData.get("t_description") ?? "").trim();
  const description = descriptionRaw.length ? descriptionRaw : null;

  const pointsCostRaw = String(formData.get("t_points_cost") ?? "").trim();
  const points_cost = Number(pointsCostRaw);

  if (!title || !Number.isFinite(points_cost) || points_cost <= 0) return;

  await fetch(`${BASE_URL}/api/owner/rewards`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-user-id": authUserId,
    },
    body: JSON.stringify({ title, description, points_cost }),
    cache: "no-store",
  });

  revalidatePath("/owner/rewards");
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "destructive"}>
      {active ? "Activo" : "Inactivo"}
    </Badge>
  );
}

/* =========================
   Templates por rubro (v1)
   - Esto es “parametrizado” desde UI (no DB)
   - En v2 lo conectamos a una tabla merchant_profile / industry
========================= */

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    key: "general",
    label: "General",
    badge: "Base",
    templates: [
      { id: "g1", title: "10% OFF", description: "Descuento aplicado en tu próxima compra.", points_cost: 120, tag: "Gancho" },
      { id: "g2", title: "2x1", description: "Promo limitada. Consultá condiciones.", points_cost: 180, tag: "Promo" },
      { id: "g3", title: "Upgrade", description: "Subí de nivel tu servicio / producto.", points_cost: 220, tag: "Premium" },
    ],
  },
  {
    key: "cafe",
    label: "Café / Gastronomía",
    templates: [
      { id: "c1", title: "Café gratis", description: "Un café a elección.", points_cost: 90, tag: "Frecuencia" },
      { id: "c2", title: "Medialunas x2", description: "Dos medialunas con tu café.", points_cost: 120, tag: "Combo" },
      { id: "c3", title: "Descuento 15%", description: "Aplicable a consumo en el local.", points_cost: 160, tag: "Gancho" },
    ],
  },
  {
    key: "beauty",
    label: "Belleza",
    templates: [
      { id: "b1", title: "15% OFF", description: "Descuento en tu próximo turno.", points_cost: 160, tag: "Gancho" },
      { id: "b2", title: "Servicio extra", description: "Ej: hidratación / ampolla / detalle.", points_cost: 220, tag: "Add-on" },
      { id: "b3", title: "Pack fidelidad", description: "Beneficio por 3 visitas.", points_cost: 260, tag: "Recurrencia" },
    ],
  },
  {
    key: "fitness",
    label: "Fitness",
    templates: [
      { id: "f1", title: "Día gratis", description: "Un día de acceso sin cargo.", points_cost: 140, tag: "Gancho" },
      { id: "f2", title: "Invitá a un amigo", description: "Un pase para acompañante.", points_cost: 180, tag: "Viral" },
      { id: "f3", title: "Clase especial", description: "Acceso a una clase premium.", points_cost: 240, tag: "Premium" },
    ],
  },
  {
    key: "auto",
    label: "Automotor",
    templates: [
      { id: "a1", title: "Lavado -10%", description: "Descuento sobre lavado.", points_cost: 140, tag: "Gancho" },
      { id: "a2", title: "Detailing interior", description: "Servicio adicional interior.", points_cost: 260, tag: "Add-on" },
      { id: "a3", title: "Upgrade a Premium", description: "Pasá a un plan superior.", points_cost: 320, tag: "Premium" },
    ],
  },
  {
    key: "retail",
    label: "Retail",
    templates: [
      { id: "r1", title: "$ OFF", description: "Descuento fijo en caja.", points_cost: 140, tag: "Caja" },
      { id: "r2", title: "Envío bonificado", description: "Envío sin cargo o prioritario.", points_cost: 200, tag: "Logística" },
      { id: "r3", title: "Regalo sorpresa", description: "Obsequio con compra.", points_cost: 220, tag: "Experiencia" },
    ],
  },
];

/* =========================
   PAGE
========================= */

export default async function OwnerRewardsPage({
  searchParams,
}: {
  searchParams?: { cat?: string };
}) {
  const authUserId = await getDevAuthUserId();

  if (!authUserId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Card className="p-5">
          <div className="text-lg font-semibold">Rewards</div>
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

  const { res, data } = await fetchOwnerRewards(authUserId);

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Card className="p-5">
          <div className="text-lg font-semibold">Rewards</div>
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
  const rewards = data.rewards ?? [];

  const activeCount = rewards.filter((r) => r.is_active).length;
  const inactiveCount = rewards.length - activeCount;
  const avgCost =
    rewards.length > 0
      ? Math.round(rewards.reduce((acc, r) => acc + (r.points_cost ?? 0), 0) / rewards.length)
      : 0;

  const catRaw = (searchParams?.cat ?? "general").toLowerCase();
  const selectedCat =
    TEMPLATE_CATEGORIES.find((c) => c.key === catRaw) ?? TEMPLATE_CATEGORIES[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Owner • {merchantName}</div>
          <h1 className="text-3xl font-semibold tracking-tight">Rewards</h1>
          <div className="text-sm text-muted-foreground">
            Plantillas por rubro + rewards personalizados. Activá y ajustá con puntos.
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

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total rewards</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(rewards.length)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{ownerName}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="text-sm text-muted-foreground">Activos</div>
            <Badge variant="secondary">Live</Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(activeCount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Listos para canje</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="text-sm text-muted-foreground">Inactivos</div>
            <Badge variant="secondary">Config</Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(inactiveCount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">No visibles al cliente</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Costo promedio</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(avgCost)} pts</div>
          <div className="mt-1 text-xs text-muted-foreground">Para calibrar conversión</div>
        </Card>
      </div>

      {/* Layout principal */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Templates */}
        <Card className="p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold">Plantillas por rubro</div>
              <div className="text-sm text-muted-foreground">
                Elegí una base y creala en 1 click. Después la editás.
              </div>
            </div>
            {selectedCat.badge ? <Badge variant="secondary">{selectedCat.badge}</Badge> : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {TEMPLATE_CATEGORIES.map((c) => {
              const active = c.key === selectedCat.key;
              return (
                <Link key={c.key} href={`/owner/rewards?cat=${c.key}`}>
                  <Button variant={active ? "secondary" : "outline"} size="sm">
                    {c.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {selectedCat.templates.map((t) => (
              <div key={t.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  </div>
                  <Badge variant="secondary">{t.tag}</Badge>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold tabular-nums">{formatInt(t.points_cost)} pts</div>

                  <form action={createTemplateReward}>
                    <input type="hidden" name="t_title" value={t.title} />
                    <input type="hidden" name="t_description" value={t.description} />
                    <input type="hidden" name="t_points_cost" value={String(t.points_cost)} />
                    <Button size="sm" type="submit">
                      Crear
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            * En v2: estas plantillas salen del rubro configurado por el owner (DB) + sugerencias dinámicas por performance.
          </div>
        </Card>

        {/* Crear personalizado */}
        <Card className="p-4">
          <div className="text-base font-semibold">Crear reward personalizado</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Ideal para promos específicas o beneficios premium.
          </div>

          <Separator className="my-4" />

          <form action={createReward} className="grid gap-3">
            <Input name="title" placeholder="Título (ej: Lavado Premium -15%)" required />
            <Input name="description" placeholder="Descripción (opcional)" />
            <Input name="points_cost" type="number" min={1} placeholder="Costo en puntos" required />

            <Button type="submit">Crear reward</Button>
            <div className="text-xs text-muted-foreground">
              Tip: arrancá con 2–3 rewards “gancho” y 1 premium.
            </div>
          </form>
        </Card>
      </div>

      {/* Tabla rewards */}
      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-base font-semibold">Listado</div>
            <div className="text-sm text-muted-foreground">
              {formatInt(rewards.length)} rewards • {formatInt(activeCount)} activos
            </div>
          </div>
          <Badge variant="secondary">v1</Badge>
        </div>

        <Separator className="my-4" />

        {rewards.length === 0 ? (
          <div className="rounded-2xl border bg-muted/20 p-6">
            <div className="text-sm font-semibold">Todavía no tenés rewards</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Creá uno desde plantillas (recomendado) o personalizado.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Reward</th>
                  <th className="px-3 py-2">Costo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Creado</th>
                  <th className="px-3 py-2">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {rewards
                  .slice()
                  .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
                  .map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-3 align-top">
                        <div className="text-sm font-semibold">{r.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {r.description ?? "Sin descripción"}
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground font-mono">
                          {r.id}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-sm font-semibold tabular-nums">{formatInt(r.points_cost)} pts</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <StatusBadge active={r.is_active} />
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                        {shortDate(r.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                        {shortDate(r.updated_at)}
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