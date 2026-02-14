import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    className?: string;
}

export function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    className,
}: StatCardProps) {
    return (
        <div
            className={cn(
                "glass-card p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300",
                className
            )}
        >
            {/* Gradient overlay */}
            <div className="absolute inset-0 stat-gradient opacity-50 group-hover:opacity-70 transition-opacity" />

            {/* Content */}
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-primary/20 text-primary">
                        <Icon className="w-6 h-6" />
                    </div>

                    {trend && (
                        <div
                            className={cn(
                                "text-sm font-semibold px-2 py-1 rounded-md",
                                trend.isPositive ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
                            )}
                        >
                            {trend.isPositive ? "+" : ""}{trend.value}
                        </div>
                    )}
                </div>

                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    {title}
                </h3>
                <p className="text-3xl font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}
