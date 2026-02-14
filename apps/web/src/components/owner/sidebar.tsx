"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Gift,
    UsersRound,
    Settings,
} from "lucide-react";

const navigation = [
    { name: "Panel", href: "/owner/dashboard", icon: LayoutDashboard },
    { name: "Clientes", href: "/owner/customers", icon: Users },
    { name: "Recompensas", href: "/owner/rewards", icon: Gift },
    { name: "Personal", href: "/owner/staff", icon: UsersRound },
    { name: "Configuración", href: "/owner/settings", icon: Settings },
];

export function OwnerSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 min-h-screen bg-card/40 border-r border-white/[0.06] backdrop-blur-xl p-6 flex flex-col">
            {/* Logo */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                    LOOP
                </h1>
                <p className="text-xs text-muted-foreground mt-1">Owner Portal</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-primary/20 text-primary shadow-lg shadow-primary/20"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer info */}
            <div className="mt-auto pt-6 border-t border-white/10">
                <p className="text-xs text-muted-foreground">Sesión iniciada como</p>
                <p className="text-sm font-semibold text-foreground mt-1">Administrador</p>
            </div>
        </aside>
    );
}
