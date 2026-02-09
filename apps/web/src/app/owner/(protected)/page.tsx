export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
   Types
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
   Fetch helpers
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
  const r = await apiFetchJson<OnboardingStatus>(
    "/api/owner/onboarding/status",
    authUserId
  );
  if (!r.ok) return { ok: false, error: r.error };
  return r.data;
}

async function fetchOwnerRewards(authUserId: string) {
  return apiFetchJson<OwnerRewardsResponse>("/api/owner/rewards", authUserId);
}

/* =========================
   UI atoms
========================= */
function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
  badge?: { text: string; variant?: "default" | "secondary" | "destructive" };
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{props.label}</div>
          <div className="text-2xl font-semibold tracking-tight">
            {props.value}
          </div>
          {props.hint ? (
            <div className="text-xs text-muted-foreground">{props.hint}</div>
          ) : null}
        </div>
        {props.badge ? (
          <Badge variant={props.badge.variant ?? "secondary"} className="text-[11px]">
            {props.badge.text}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}

function SectionHeader(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-base font-semibold">{props.title}</div>
        {props.subtitle ? (
          <div className="text-sm text-muted-foreground">{props.subtitle}</div>
        ) : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

export default async function OwnerHomePage() {
  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  const [onboarding, rewardsRes] = await Promise.all([
    fetchOnboardingStatus(authUserId),
    fetchOwnerRewards(authUserId),
  ]);

  const rewards =
    rewardsRes.ok && rewardsRes.data.ok ? rewardsRes.data.rewards ?? [] : [];

  const rewardsCount =
    rewardsRes.ok && rewardsRes.data.ok ? rewardsRes.data.count ?? rewards.length : rewards.length;

  const onboardingStep = onboarding.ok ? onboarding.onboarding?.step ?? 0 : 0;
  const onboardingDone = onboarding.ok ? Boolean(onboarding.onboarding?.is_complete) : false;

  const topRewards = [...rewards]
    .sort((a, b) => Number(a.points_cost) - Number(b.points_cost))
    .slice(0, 5);

  const hasAnyRewards = rewardsCount > 0;

  // Estado “cero datos” (muy simple por ahora)
  const isFirstDayLike = !hasAnyRewards || !onboardingDone;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Home (Dashboard)</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estado del negocio
          </h1>
          <div className="text-sm text-muted-foreground">
            Un resumen rápido. Lo importante arriba. Lo accionable al centro.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFirstDayLike ? (
            <Badge variant="secondary">Modo onboarding</Badge>
          ) : (
            <Badge variant="secondary">Operando</Badge>
          )}
          <Link href="/owner/onboarding">
            <Button variant="outline" size="sm">
              Checklist
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          label="Clientes activos"
          value="—"
          hint="en el período"
          badge={{ text: "Próx.", variant: "secondary" }}
        />
        <KpiCard
          label="En riesgo"
          value="—"
          hint="a recuperar"
          badge={{ text: "Próx.", variant: "secondary" }}
        />
        <KpiCard
          label="Nuevos"
          value="—"
          hint="primeras visitas"
          badge={{ text: "Próx.", variant: "secondary" }}
        />
        <KpiCard
          label="Recurrentes"
          value="—"
          hint="vuelven seguido"
          badge={{ text: "Próx.", variant: "secondary" }}
        />
        <KpiCard
          label="Visitas"
          value="—"
          hint="check-ins"
          badge={{ text: "Próx.", variant: "secondary" }}
        />
        <KpiCard
          label="Canjes"
          value="—"
          hint="redeems"
          badge={{ text: "Próx.", variant: "secondary" }}
        />
      </div>

      {/* Tendencias (placeholder) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <SectionHeader
            title="Tendencia de actividad"
            subtitle="Visitas por día/semana (próximo)"
            right={<Badge variant="secondary">Próximamente</Badge>}
          />
          <Separator className="my-4" />
          <div className="h-44 rounded-xl border bg-muted/30" />
          <div className="mt-3 text-xs text-muted-foreground">
            Cuando haya eventos suficientes, acá aparece el gráfico.
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader
            title="Tendencia de canjes"
            subtitle="Canjes por día/semana (próximo)"
            right={<Badge variant="secondary">Próximamente</Badge>}
          />
          <Separator className="my-4" />
          <div className="h-44 rounded-xl border bg-muted/30" />
          <div className="mt-3 text-xs text-muted-foreground">
            Te va a mostrar si los rewards convierten o no.
          </div>
        </Card>
      </div>

      {/* Insights + Quick actions */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <SectionHeader
            title="Alertas / Insights"
            subtitle="Lo que importa ahora (accionable)"
          />
          <Separator className="my-4" />

          <div className="space-y-3">
            {isFirstDayLike ? (
              <>
                <div className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        Primeros pasos del sistema
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Para que el dashboard tenga vida: staff + QR/link + 1 reward listo.
                      </div>
                    </div>
                    <Badge variant="secondary">Onboarding</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/owner/onboarding">
                      <Button size="sm" variant="secondary">
                        Abrir checklist
                      </Button>
                    </Link>
                    <Link href="/owner/rewards">
                      <Button size="sm" variant="outline">
                        Crear reward
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        Sin actividad todavía
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Cuando entren los primeros eventos, vas a ver clientes nuevos / recurrentes / riesgo.
                      </div>
                    </div>
                    <Badge variant="secondary">Esperando</Badge>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        📉 Recurrentes bajaron (ejemplo)
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Si esto pasa, proponemos misión de 2da visita + reward gancho.
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Ver detalle
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader
            title="Acciones rápidas"
            subtitle="Para no quedar en blanco"
          />
          <Separator className="my-4" />

          <div className="grid gap-2">
            <Link href="/owner/rewards">
              <Button className="w-full">Crear recompensa</Button>
            </Link>

            <Link href="/owner/customers">
              <Button className="w-full" variant="secondary">
                Ver clientes
              </Button>
            </Link>

            <Link href="/owner/onboarding">
              <Button className="w-full" variant="outline">
                Ir a onboarding
              </Button>
            </Link>

            <Button className="w-full" variant="outline" disabled>
              Generar QR / Link (próximo)
            </Button>

            <Button className="w-full" variant="outline" disabled>
              Invitar staff (próximo)
            </Button>
          </div>
        </Card>
      </div>

      {/* Funnel + Rankings + System health */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <SectionHeader
            title="Embudo del período"
            subtitle="Visitas → Puntos → Rewards vistas → Canjes"
            right={<Badge variant="secondary">Próximamente</Badge>}
          />
          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {[
              { label: "Visitas", value: "—" },
              { label: "Puntos otorgados", value: "—" },
              { label: "Rewards vistas", value: "—" },
              { label: "Canjes", value: "—" },
            ].map((x) => (
              <div key={x.label} className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">{x.label}</div>
                <div className="mt-1 text-xl font-semibold">{x.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Esto te va a decir rápido si hay actividad pero no canjes (rewards flojas) o si falta captación.
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader
            title="Salud del sistema"
            subtitle="¿Está vivo o está muerto?"
          />
          <Separator className="my-4" />
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Onboarding</span>
              {onboardingDone ? (
                <Badge variant="secondary">Completo</Badge>
              ) : (
                <Badge variant="secondary">Paso {onboardingStep}</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rewards</span>
              <span className="font-medium">{rewardsCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Último evento</span>
              <span className="text-muted-foreground">— (próximo)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Staff activos</span>
              <span className="text-muted-foreground">— (próximo)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Ranking simple (usa rewards ya existentes) */}
      <Card className="p-4">
        <SectionHeader
          title="Ranking"
          subtitle="Top rewards (por ahora ordenado por menor costo)"
          right={
            <Link href="/owner/rewards">
              <Button size="sm" variant="outline">
                Ver todo
              </Button>
            </Link>
          }
        />
        <Separator className="my-4" />

        {topRewards.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Todavía no tenés rewards. Creá el primero y listo.
          </div>
        ) : (
          <div className="grid gap-2">
            {topRewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.title}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {r.description ?? "Sin descripción"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={r.is_active ? "secondary" : "destructive"}>
                    {r.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                  <div className="text-sm font-semibold tabular-nums">
                    {r.points_cost} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}