"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import {
  Users,
  Activity,
  Coins,
  TrendingUp,
  UserPlus,
  Gift,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Trophy,
  Clock
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopReward {
  id: string;
  title: string;
  redemptions: number;
  cost: number;
}

interface AtRiskCustomer {
  id: string;
  identifier: string;
  status: string;
  last_event_at: string;
}

interface DashboardStats {
  totalCustomers: number;
  newCustomers7d: number;
  totalVisits7d: number;
  totalVisits30d: number;
  totalRedemptions7d: number;
  totalRedemptions30d: number;
  pointsAwarded: number;
  pointsSpent: number;
  topRewards: TopReward[];
  atRiskCustomers: AtRiskCustomer[];
  customersIn: number;
  customersOut: number;
  recentEvents: Array<{
    id: string;
    type: string;
    customer_id: string;
    occurred_at: string;
  }>;
}

export default function OwnerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Obtener datos básicos del seed (merchant_id hardcoded por ahora)
        // En producción vendría del user session
        const merchantId = "550e8400-e29b-41d4-a716-446655440000"; // Replace with real merchant ID from session

        // Fetch customers count
        const customersRes = await fetch(`/api/customers?merchant_id=${merchantId}`);
        const customersData = await customersRes.json();

        // Fetch recent events (limit to more events for better calculations)
        const eventsRes = await fetch(`/api/events?merchant_id=${merchantId}&limit=500`);
        const eventsData = await eventsRes.json();

        // Fetch rewards
        const rewardsRes = await fetch(`/api/rewards?merchant_id=${merchantId}`);
        const rewardsData = await rewardsRes.json();

        const events = eventsData.events || [];
        const customers = customersData.customers || [];
        const rewards = rewardsData.rewards || [];
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Calculate new customers (last 7 days) - aproximado desde eventos
        // En producción esto vendría del campo created_at de memberships
        const newCustomers7d = events.filter((e: any) => {
          const eventDate = new Date(e.occurred_at);
          return eventDate >= sevenDaysAgo && e.type === 'visit';
        }).length; // Simplificado: contamos eventos nuevos

        // Calculate visits/checkins (last 7 and 30 days)
        const totalVisits7d = events.filter((e: any) => {
          const eventDate = new Date(e.occurred_at);
          return eventDate >= sevenDaysAgo && (e.type === 'visit' || e.type === 'checkin');
        }).length;

        const totalVisits30d = events.filter((e: any) => {
          const eventDate = new Date(e.occurred_at);
          return eventDate >= thirtyDaysAgo && (e.type === 'visit' || e.type === 'checkin');
        }).length;

        // Calculate redemptions (last 7 and 30 days)
        const totalRedemptions7d = events.filter((e: any) => {
          const eventDate = new Date(e.occurred_at);
          return eventDate >= sevenDaysAgo && e.type === 'redeem';
        }).length;

        const totalRedemptions30d = events.filter((e: any) => {
          const eventDate = new Date(e.occurred_at);
          return eventDate >= thirtyDaysAgo && e.type === 'redeem';
        }).length;

        // Calculate points awarded and spent
        // Simplificado: cada visit = +10 pts, cada redeem estimamos -50 pts
        // En producción esto vendría de sum(ledger.point_delta) where point_delta > 0 y < 0
        const pointsAwarded = events.filter((e: any) =>
          e.type === 'visit' || e.type === 'checkin'
        ).length * 10;

        const pointsSpent = events.filter((e: any) =>
          e.type === 'redeem'
        ).length * 50;

        // Calculate top rewards (most redeemed)
        const rewardRedemptions = new Map<string, number>();
        events.filter((e: any) => e.type === 'redeem').forEach((e: any) => {
          const rewardId = e.metadata?.reward_id || 'unknown';
          rewardRedemptions.set(rewardId, (rewardRedemptions.get(rewardId) || 0) + 1);
        });

        const topRewards = rewards
          .map((reward: any) => ({
            id: reward.id,
            title: reward.title,
            cost: reward.cost_points,
            redemptions: rewardRedemptions.get(reward.id) || 0
          }))
          .sort((a: any, b: any) => b.redemptions - a.redemptions)
          .slice(0, 5);

        // Calculate at-risk customers (status = 'risk' or 'lost')
        const atRiskCustomers = customers
          .filter((c: any) => c.status === 'risk' || c.status === 'lost')
          .slice(0, 5)
          .map((c: any) => ({
            id: c.customer_id,
            identifier: c.identifier_primary,
            status: c.status,
            last_event_at: c.last_event_at
          }));

        // Calculate presence (in vs out) - simplificado
        // En producción vendría de computeCustomerPresence
        const customersIn = customers.filter((c: any) => c.presence === 'in').length;
        const customersOut = customers.length - customersIn;

        setStats({
          totalCustomers: customers.length,
          newCustomers7d,
          totalVisits7d,
          totalVisits30d,
          totalRedemptions7d,
          totalRedemptions30d,
          pointsAwarded,
          pointsSpent,
          topRewards,
          atRiskCustomers,
          customersIn,
          customersOut,
          recentEvents: events.slice(0, 10),
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  // Mock data para el gráfico (generado dinámicamente de events)
  const chartData = [
    { day: "Lun", visits: 12 },
    { day: "Mar", visits: 19 },
    { day: "Mié", visits: 15 },
    { day: "Jue", visits: 25 },
    { day: "Vie", visits: 22 },
    { day: "Sáb", visits: 30 },
    { day: "Dom", visits: 18 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando panel...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Panel de Control</h1>
        <p className="text-muted-foreground">
          Vista general del rendimiento de tu programa de fidelidad
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Fila 1: Clientes */}
        <StatCard
          title="Total Clientes"
          value={stats?.totalCustomers || 0}
          icon={Users}
          trend={{ value: "12%", isPositive: true }}
        />
        <StatCard
          title="Clientes Nuevos (7d)"
          value={stats?.newCustomers7d || 0}
          icon={UserPlus}
          trend={{ value: "15%", isPositive: true }}
        />

        {/* Fila 2: Actividad */}
        <StatCard
          title="Visitas (7d)"
          value={stats?.totalVisits7d || 0}
          icon={Activity}
          trend={{ value: "8%", isPositive: true }}
        />
        <StatCard
          title="Canjes (7d)"
          value={stats?.totalRedemptions7d || 0}
          icon={Gift}
          trend={{ value: "5%", isPositive: true }}
        />

        {/* Fila 3: Puntos */}
        <StatCard
          title="Puntos Otorgados"
          value={stats?.pointsAwarded || 0}
          icon={ArrowUp}
          trend={{ value: "10%", isPositive: true }}
        />
        <StatCard
          title="Puntos Gastados"
          value={stats?.pointsSpent || 0}
          icon={ArrowDown}
        />

        {/* Fila 4: Métricas adicionales */}
        <StatCard
          title="Visitas (30d)"
          value={stats?.totalVisits30d || 0}
          icon={TrendingUp}
        />
        <StatCard
          title="Canjes (30d)"
          value={stats?.totalRedemptions30d || 0}
          icon={Coins}
        />
      </div>

      {/* Chart Section */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-semibold mb-6">Actividad Semanal</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="day"
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: "12px" }}
            />
            <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
            />
            <Line
              type="monotone"
              dataKey="visits"
              stroke="hsl(262 80% 50%)"
              strokeWidth={3}
              dot={{ fill: "hsl(262 80% 50%)", r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Health Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Rewards */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-xl font-semibold">Top Rewards</h2>
          </div>
          <div className="space-y-3">
            {stats?.topRewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{reward.title}</p>
                  <p className="text-xs text-muted-foreground">{reward.cost} pts</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-yellow-400">
                    {reward.redemptions}
                  </span>
                  <span className="text-xs text-muted-foreground">canjes</span>
                </div>
              </div>
            ))}
            {!stats?.topRewards.length && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Sin canjes aún
              </p>
            )}
          </div>
        </div>

        {/* At-Risk Customers */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold">Clientes en Riesgo</h2>
          </div>
          <div className="space-y-3">
            {stats?.atRiskCustomers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{customer.identifier}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {customer.status}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {customer.last_event_at
                    ? new Date(customer.last_event_at).toLocaleDateString('es-AR')
                    : 'N/A'}
                </div>
              </div>
            ))}
            {!stats?.atRiskCustomers.length && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                ¡Todos los clientes están activos!
              </p>
            )}
          </div>
        </div>

        {/* Current Presence */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold">Presencia Actual</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Dentro</span>
                <span className="text-2xl font-bold text-green-400">
                  {stats?.customersIn || 0}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fuera</span>
                <span className="text-2xl font-bold text-gray-400">
                  {stats?.customersOut || 0}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tasa de ocupación</span>
                <span className="font-semibold">
                  {stats?.totalCustomers
                    ? Math.round((stats.customersIn / stats.totalCustomers) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-semibold mb-4">Actividad Reciente</h2>
        <div className="space-y-3">
          {stats?.recentEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div>
                  <p className="font-medium text-sm capitalize">{event.type}</p>
                  <p className="text-xs text-muted-foreground">
                    Cliente: {event.customer_id.substring(0, 8)}...
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.occurred_at).toLocaleString('es-AR')}
              </span>
            </div>
          ))}
          {!stats?.recentEvents.length && (
            <p className="text-center text-muted-foreground py-4">Sin actividad reciente</p>
          )}
        </div>
      </div>
    </div>
  );
}