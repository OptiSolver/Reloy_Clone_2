// apps/web/src/app/owner/(protected)/page.tsx
export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/* =========================
   TIPOS
========================= */

type OnboardingStatus = {
  ok: boolean;
  onboarding?: { step: number; is_complete: boolean };
  error?: string;
};

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

type OwnerDashboardFilters = {
  range: string;
  start: string;
  end: string;
  branch_id: string;
};

type OwnerDashboardKpis = {
  total_customers: string;
  total_events: string;
  total_staff: string;

  visits: string;
  redeems: string;

  new_customers: string;
  recurrent_customers: string;
  at_risk_customers: string;
  lost_customers: string;
};

type OwnerDashboardResponse = {
  ok: boolean;
  error?: string;
  owner?: { id: string; name: string };
  merchants?: Array<{ id: string; name: string }>;
  filters?: OwnerDashboardFilters;
  kpis?: OwnerDashboardKpis;
};

type OwnerDashboardActivityResponse = {
  ok: boolean;
  error?: string;
  last_event_at?: string | null;
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

async function fetchOwnerDashboard(authUserId: string, range: string, branch: string) {
  const url = new URL("/api/owner/dashboard", BASE_URL);
  url.searchParams.set("range", range);
  url.searchParams.set("branch", branch);
  return apiFetchJson<OwnerDashboardResponse>(url.pathname + "?" + url.searchParams.toString(), authUserId);
}

async function fetchOwnerDashboardActivity(authUserId: string) {
  return apiFetchJson<OwnerDashboardActivityResponse>("/api/owner/dashboard/activity", authUserId);
}

/* =========================
   UI helpers
========================= */

function formatInt(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

function toInt(v: string | number | null | undefined) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function SectionHeader(props: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="text-base font-semibold">{props.title}</div>
        {props.subtitle ? (
          <div className="text-sm text-muted-foreground">{props.subtitle}</div>
        ) : null}
      </div>
      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  size?: "big" | "normal";
  right?: React.ReactNode;
}) {
  const tone =
    props.tone === "good"
      ? "bg-[hsl(var(--primary)/0.08)] border-[hsl(var(--primary)/0.22)]"
      : props.tone === "warn"
        ? "bg-[hsl(var(--accent)/0.08)] border-[hsl(var(--accent)/0.22)]"
        : props.tone === "bad"
          ? "bg-[hsl(var(--destructive)/0.06)] border-[hsl(var(--destructive)/0.20)]"
          : "bg-background";

  const valSize = props.size === "big" ? "text-3xl" : "text-2xl";

  return (
    <div
      className={[
        "rounded-3xl border p-4 shadow-sm",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md",
        tone,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-muted-foreground">{props.label}</div>
        {props.right ? <div>{props.right}</div> : null}
      </div>
      <div className={`mt-2 ${valSize} font-semibold tabular-nums`}>{props.value}</div>
      {props.hint ? <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}

/* =========================
   PAGE
========================= */

export default async function OwnerHomePage({
  searchParams,
}: {
  searchParams?: { range?: string; branch?: string; q?: string };
}) {
  const authUserId = await getDevAuthUserId();
  if (!authUserId) redirect("/owner/login");

  const range = searchParams?.range ?? "30d";
  const branch = searchParams?.branch ?? "all";
  const q = (searchParams?.q ?? "").trim();

  const [onboarding, rewardsRes, dashRes, activityRes] = await Promise.all([
    fetchOnboardingStatus(authUserId),
    fetchOwnerRewards(authUserId),
    fetchOwnerDashboard(authUserId, range, branch),
    fetchOwnerDashboardActivity(authUserId),
  ]);

  const onboardingStep = onboarding.ok ? onboarding.onboarding?.step ?? 1 : 1;
  const onboardingDone = onboarding.ok ? Boolean(onboarding.onboarding?.is_complete) : false;

  const rewards = rewardsRes.ok ? rewardsRes.data.rewards ?? [] : [];
  const rewardsCount = rewardsRes.ok ? rewardsRes.data.count ?? rewards.length : rewards.length;

  const topRewards = [...rewards]
    .sort((a, b) => (a.points_cost ?? 0) - (b.points_cost ?? 0))
    .slice(0, 5);

  const dashData = dashRes.ok ? dashRes.data : null;
  const kpis = dashData?.kpis;

  const merchantName = dashData?.merchants?.[0]?.name ?? "Tu negocio";

  const totalCustomers = toInt(kpis?.total_customers);
  const visits = toInt(kpis?.visits);
  const redeems = toInt(kpis?.redeems);

  const newCustomers = toInt(kpis?.new_customers);
  const recurrentCustomers = toInt(kpis?.recurrent_customers);
  const atRisk = toInt(kpis?.at_risk_customers);
  const lost = toInt(kpis?.lost_customers);

  const lastEventAt = activityRes.ok ? activityRes.data.last_event_at ?? null : null;

  const isFirstDayLike = !onboardingDone || visits === 0;

  return (
    <div className="space-y-6">
      {/* HERO (foco primario) */}
      <Card className="relative overflow-hidden rounded-3xl border bg-background/70 p-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 loop-hero opacity-90" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {isFirstDayLike ? "Onboarding" : "Activo"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Período: <span className="text-foreground font-medium">{range}</span> • Sucursal:{" "}
                <span className="text-foreground font-medium">{branch}</span>
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Buenos días, <span className="text-foreground">{merchantName}</span> 👋
            </h1>

            <div className="text-sm text-muted-foreground max-w-xl">
              {isFirstDayLike ? (
                <>
                  Tu negocio está en modo onboarding. Para “darle vida” al dashboard: necesitás
                  <span className="text-foreground font-medium"> 1 reward activo</span> y
                  <span className="text-foreground font-medium"> 1 staff registrando eventos</span>.
                </>
              ) : (
                <>
                  Ya hay actividad registrada. Próximo: tendencias + insights accionables (recurrentes / riesgo / conversión).
                </>
              )}
            </div>

            {q ? (
              <div className="text-xs text-muted-foreground">
                Búsqueda: <span className="text-foreground font-medium">{q}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/owner/rewards">
              <Button size="lg" className="rounded-2xl">
                Crear reward
              </Button>
            </Link>
            <Link href="/owner/onboarding">
              <Button size="lg" variant="secondary" className="rounded-2xl">
                Abrir checklist
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-2xl" disabled>
              Invitar staff (próx.)
            </Button>
          </div>
        </div>

        <Separator className="my-5 relative" />

        <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Clientes</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatInt(totalCustomers)}</div>
          </div>
          <div className="rounded-2xl border bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Visitas</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatInt(visits)}</div>
          </div>
          <div className="rounded-2xl border bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Canjes</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatInt(redeems)}</div>
          </div>
          <div className="rounded-2xl border bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Último evento</div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">
              {lastEventAt ? lastEventAt : "—"}
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs jerárquicos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
        {/* Fila 1 (grandes) */}
        <div className="lg:col-span-2">
          <KpiCard
            label="Nuevos"
            value={formatInt(newCustomers)}
            hint="primeras visitas"
            tone="neutral"
            size="big"
            right={<Badge variant="secondary">v1</Badge>}
          />
        </div>
        <div className="lg:col-span-2">
          <KpiCard
            label="Recurrentes"
            value={formatInt(recurrentCustomers)}
            hint="vuelven seguido"
            tone="good"
            size="big"
            right={<Badge variant="secondary">v1</Badge>}
          />
        </div>
        <div className="lg:col-span-2">
          <KpiCard
            label="En riesgo"
            value={formatInt(atRisk)}
            hint="a recuperar"
            tone="warn"
            size="big"
            right={<Badge variant="secondary">v1</Badge>}
          />
        </div>

        {/* Fila 2 (medianos) */}
        <div className="lg:col-span-2">
          <KpiCard
            label="Visitas"
            value={formatInt(visits)}
            hint="check-ins"
            tone="neutral"
            right={<Badge variant="secondary">OK</Badge>}
          />
        </div>
        <div className="lg:col-span-2">
          <KpiCard
            label="Canjes"
            value={formatInt(redeems)}
            hint="redeems"
            tone="neutral"
            right={<Badge variant="secondary">v1</Badge>}
          />
        </div>
        <div className="lg:col-span-2">
          <KpiCard
            label="Perdidos"
            value={formatInt(lost)}
            hint="inactivos"
            tone="bad"
            right={<Badge variant="secondary">v1</Badge>}
          />
        </div>
      </div>

      {/* Tendencias */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="rounded-3xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <SectionHeader
            title="Tendencia de actividad"
            subtitle="Visitas por día/semana (próximo)"
            right={<Badge variant="secondary">Próximamente</Badge>}
          />
          <Separator className="my-4" />
          <div className="h-44 rounded-2xl border bg-muted/20" />
          <div className="mt-3 text-xs text-muted-foreground">
            Cuando haya eventos suficientes, acá aparece el gráfico.
          </div>
        </Card>

        <Card className="rounded-3xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <SectionHeader
            title="Tendencia de canjes"
            subtitle="Canjes por día/semana (próximo)"
            right={<Badge variant="secondary">Próximamente</Badge>}
          />
          <Separator className="my-4" />
          <div className="h-44 rounded-2xl border bg-muted/20" />
          <div className="mt-3 text-xs text-muted-foreground">
            Te va a mostrar si los rewards convierten o no.
          </div>
        </Card>
      </div>

      {/* Insights + Quick actions */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="rounded-3xl p-4 shadow-sm lg:col-span-2 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <SectionHeader
            title="Alertas / Insights"
            subtitle="Lo que importa ahora (accionable)"
            right={<Badge variant="secondary">v1</Badge>}
          />
          <Separator className="my-4" />

          <div className="space-y-3">
            {isFirstDayLike ? (
              <>
                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">
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
                      <Button size="sm" variant="secondary" className="rounded-xl">
                        Abrir checklist
                      </Button>
                    </Link>
                    <Link href="/owner/rewards">
                      <Button size="sm" variant="outline" className="rounded-xl">
                        Crear reward
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">
                        Sin actividad todavía
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Cuando entren eventos, vas a ver segmentación real.
                      </div>
                    </div>
                    <Badge variant="secondary">Esperando</Badge>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">
                      ✅ Actividad detectada
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Próximo: alertas reales (baja de recurrentes / sucursal sin actividad / reward que no convierte).
                    </div>
                  </div>
                  <Badge variant="secondary">OK</Badge>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <SectionHeader
            title="Acciones rápidas"
            subtitle="Para no quedar en blanco"
          />
          <Separator className="my-4" />

          <div className="grid gap-2">
            <Link href="/owner/rewards">
              <Button className="w-full rounded-2xl">Crear recompensa</Button>
            </Link>

            <Link href="/owner/customers">
              <Button className="w-full rounded-2xl" variant="secondary">
                Ver clientes
              </Button>
            </Link>

            <Link href="/owner/onboarding">
              <Button className="w-full rounded-2xl" variant="outline">
                Ir a onboarding
              </Button>
            </Link>

            <Button className="w-full rounded-2xl" variant="outline" disabled>
              Generar QR / Link (próximo)
            </Button>

            <Button className="w-full rounded-2xl" variant="outline" disabled>
              Invitar staff (próximo)
            </Button>
          </div>
        </Card>
      </div>

      {/* Funnel + System health + Ranking */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="rounded-3xl p-4 shadow-sm lg:col-span-2 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <SectionHeader
            title="Embudo del período"
            subtitle="Visitas → Puntos → Rewards vistas → Canjes"
            right={<Badge variant="secondary">Próximamente</Badge>}
          />
          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {[
              { label: "Visitas", value: formatInt(visits) },
              { label: "Puntos otorgados", value: "—" },
              { label: "Rewards vistas", value: "—" },
              { label: "Canjes", value: formatInt(redeems) },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">{x.label}</div>
                <div className="mt-1 text-xl font-semibold">{x.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Esto te va a decir rápido si hay actividad pero no canjes (rewards flojas) o si falta captación.
          </div>
        </Card>

        <Card className="rounded-3xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
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
              <span className="font-medium">{formatInt(rewardsCount)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Último evento</span>
              <span className="text-muted-foreground">
                {lastEventAt ? lastEventAt : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Visitas</span>
              <span className="font-medium">{formatInt(visits)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-3xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <SectionHeader
          title="Ranking"
          subtitle="Top rewards (por ahora ordenado por menor costo)"
          right={
            <Link href="/owner/rewards">
              <Button size="sm" variant="outline" className="rounded-xl">
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
                className="flex items-center justify-between rounded-2xl border bg-background/60 p-3 transition-all hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.title}</div>
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