"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Plus, Coins } from "lucide-react";

interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  isActive: boolean;
}

export default function OwnerRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRewards() {
      try {
        const merchantId = "550e8400-e29b-41d4-a716-446655440000"; // Fixed ID from seed
        const res = await fetch(`/api/rewards?merchant_id=${merchantId}`);
        const data = await res.json();

        if (data.ok) {
          setRewards(data.rewards || []);
        } else {
          setError(data.error || "Error desconocido");
        }
      } catch (err) {
        console.error("Error fetching rewards:", err);
        setError("Error al cargar recompensas");
      } finally {
        setLoading(false);
      }
    }

    fetchRewards();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando recompensas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Recompensas</h1>
          <p className="text-muted-foreground">
            Gestiona el catálogo de recompensas disponibles para tus clientes
          </p>
        </div>
        <Button disabled className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Recompensa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Recompensas</p>
              <h3 className="text-3xl font-bold mt-2">{rewards.length}</h3>
            </div>
            <Gift className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Activas</p>
            <h3 className="text-3xl font-bold mt-2">
              {rewards.filter((r) => r.isActive).length}
            </h3>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Costo Promedio</p>
            <h3 className="text-3xl font-bold mt-2 flex items-center gap-2">
              {rewards.length > 0
                ? Math.round(
                  rewards.reduce((acc, r) => acc + r.pointsCost, 0) / rewards.length
                )
                : 0}
              <Coins className="w-5 h-5 text-secondary" />
            </h3>
          </div>
        </Card>
      </div>

      {/* Rewards List */}
      {rewards.length === 0 ? (
        <Card className="p-12 text-center">
          <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No hay recompensas</h2>
          <p className="text-muted-foreground">
            No se encontraron recompensas para este comercio. Ejecuta el seed para generar datos.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((reward) => (
            <Card key={reward.id} className="p-6 hover:scale-[1.02] transition-transform">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Gift className="w-6 h-6 text-primary" />
                </div>
                <Badge variant={reward.isActive ? "default" : "secondary"}>
                  {reward.isActive ? "Activa" : "Inactiva"}
                </Badge>
              </div>

              <h3 className="text-xl font-bold mb-2">{reward.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {reward.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-secondary" />
                  <span className="text-lg font-bold">{reward.pointsCost}</span>
                  <span className="text-sm text-muted-foreground">puntos</span>
                </div>
                <Button size="sm" variant="outline" disabled>
                  Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info Message */}
      <Card className="p-6 bg-muted/50">
        <div className="flex items-start gap-3">
          <Gift className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Funcionalidad en desarrollo</h3>
            <p className="text-sm text-muted-foreground">
              La edición y creación de recompensas estará disponible próximamente.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}