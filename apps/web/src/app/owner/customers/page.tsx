"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";

interface Customer {
  customer_id: string;
  identifier_type: string | null;
  identifier_value_raw: string | null;
  identifier_value_normalized: string | null;
  balance: number;
  last_event_type: string | null;
  last_event_at: string | null;
}

export default function OwnerCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const merchantId = "550e8400-e29b-41d4-a716-446655440000"; // hardcoded por ahora
        const res = await fetch(`/api/customers?merchant_id=${merchantId}&limit=100`);
        const data = await res.json();

        if (data.ok) {
          setCustomers(data.customers || []);
        } else {
          setError(data.error || "Error desconocido");
        }
      } catch (err) {
        setError("Error al cargar clientes");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando clientes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Error al cargar datos</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </Card>
      </div>
    );
  }

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.identifier_value_raw?.toLowerCase().includes(query) ||
      c.identifier_value_normalized?.toLowerCase().includes(query) ||
      c.customer_id.toLowerCase().includes(query)
    );
  });

  const totalBalance = customers.reduce((acc, c) => acc + (c.balance || 0), 0);
  const recentCustomers = customers.filter((c) => {
    if (!c.last_event_at) return false;
    const daysSinceLastEvent = (Date.now() - new Date(c.last_event_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastEvent <= 30;
  }).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Clientes</h1>
        <p className="text-muted-foreground">
          Gestiona y visualiza la información de tus {customers.length} clientes
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <h3 className="text-3xl font-bold mt-2">{customers.length}</h3>
            </div>
            <Users className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Activos (30d)</p>
            <h3 className="text-3xl font-bold mt-2">{recentCustomers}</h3>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Con Saldo</p>
            <h3 className="text-3xl font-bold mt-2">
              {customers.filter((c) => c.balance > 0).length}
            </h3>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Puntos Totales</p>
            <h3 className="text-3xl font-bold mt-2">{totalBalance.toLocaleString()}</h3>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, teléfono o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          {searchQuery && (
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {/* Customers Table */}
      {filteredCustomers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {searchQuery ? "No se encontraron resultados" : "No hay clientes aún"}
          </h2>
          <p className="text-muted-foreground">
            {searchQuery
              ? "Intenta con otro término de búsqueda"
              : "Los clientes aparecerán aquí cuando se registren eventos"}
          </p>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">
            Lista de Clientes ({filteredCustomers.length})
          </h2>
          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {customer.identifier_value_raw || customer.customer_id.substring(0, 8)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {customer.identifier_type && (
                          <Badge variant="secondary" className="text-xs">
                            {customer.identifier_type}
                          </Badge>
                        )}
                        <span className="font-mono text-xs">
                          {customer.customer_id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Puntos</p>
                    <p className="text-lg font-bold">{customer.balance}</p>
                  </div>

                  {customer.last_event_at && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Última visita</p>
                      <p className="text-sm">
                        {new Date(customer.last_event_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}