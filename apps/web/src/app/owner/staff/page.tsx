"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsersRound, Plus, MapPin } from "lucide-react";

interface StaffMember {
    id: string;
    fullName: string;
    role: string;
    branchName: string; // Viene del backend enriquecido
    isActive: boolean;
}

export default function OwnerStaffPage() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchStaff() {
            try {
                const merchantId = "550e8400-e29b-41d4-a716-446655440000"; // Fixed ID from seed
                const res = await fetch(`/api/staff?merchant_id=${merchantId}`);
                const data = await res.json();

                if (data.ok) {
                    setStaff(data.staff || []);
                } else {
                    setError(data.error || "Error desconocido");
                }
            } catch (err) {
                console.error("Error fetching staff:", err);
                setError("Error al cargar personal");
            } finally {
                setLoading(false);
            }
        }

        fetchStaff();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground">Cargando personal...</div>
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

    // Calcular sucursales únicas
    const uniqueBranches = new Set(staff.map(s => s.branchName)).size;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold mb-2">Personal</h1>
                    <p className="text-muted-foreground">
                        Gestiona los empleados y su asignación a sucursales
                    </p>
                </div>
                <Button disabled className="gap-2">
                    <Plus className="w-4 h-4" />
                    Agregar Personal
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Empleados</p>
                            <h3 className="text-3xl font-bold mt-2">{staff.length}</h3>
                        </div>
                        <UsersRound className="w-8 h-8 text-primary" />
                    </div>
                </Card>

                <Card className="p-6">
                    <div>
                        <p className="text-sm text-muted-foreground">Activos</p>
                        <h3 className="text-3xl font-bold mt-2">
                            {staff.filter((s) => s.isActive).length}
                        </h3>
                    </div>
                </Card>

                <Card className="p-6">
                    <div>
                        <p className="text-sm text-muted-foreground">Sucursales</p>
                        <h3 className="text-3xl font-bold mt-2">{uniqueBranches}</h3>
                    </div>
                </Card>
            </div>

            {/* Staff List */}
            {staff.length === 0 ? (
                <Card className="p-12 text-center">
                    <UsersRound className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">No hay personal</h2>
                    <p className="text-muted-foreground">
                        No se encontró personal para este comercio. Ejecuta el seed para generar datos.
                    </p>
                </Card>
            ) : (
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-6">Lista de Personal</h2>
                    <div className="space-y-4">
                        {staff.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                        <UsersRound className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{member.fullName}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <MapPin className="w-3 h-3" />
                                                {member.branchName}
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                {member.role}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Badge variant={member.isActive ? "default" : "secondary"}>
                                        {member.isActive ? "Activo" : "Inactivo"}
                                    </Badge>
                                    <Button size="sm" variant="outline" disabled>
                                        Editar
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Info Message */}
            <Card className="p-6 bg-muted/50">
                <div className="flex items-start gap-3">
                    <UsersRound className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                        <h3 className="font-semibold mb-1">Funcionalidad en desarrollo</h3>
                        <p className="text-sm text-muted-foreground">
                            La gestión completa de personal estará disponible próximamente.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
