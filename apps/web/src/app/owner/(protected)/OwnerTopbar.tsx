"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RangeKey = "today" | "7d" | "30d" | "custom";

const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Hoy",
  "7d": "7d",
  "30d": "30d",
  custom: "Custom",
};

function setParam(url: URL, key: string, value: string | null) {
  if (!value || value === "all") url.searchParams.delete(key);
  else url.searchParams.set(key, value);
}

export default function OwnerTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const range = (sp.get("range") as RangeKey) || "7d";
  const branch = sp.get("branch") || "all";
  const q = sp.get("q") || "";

  const [search, setSearch] = React.useState(q);

  React.useEffect(() => setSearch(q), [q]);

  function apply(next: { range?: RangeKey; branch?: string; q?: string }) {
    const url = new URL(window.location.href);
    url.pathname = pathname;

    setParam(url, "range", next.range ?? range);
    setParam(url, "branch", next.branch ?? branch);
    setParam(url, "q", (next.q ?? q).trim() || null);

    router.push(url.pathname + url.search);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply({ q: search });
  }

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">Panel</div>
        <div className="text-xs text-muted-foreground">(Owner)</div>
      </div>

      <div className="flex items-center gap-2">
        {/* Período */}
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={range}
          onChange={(e) => apply({ range: e.target.value as RangeKey })}
          title="Período"
        >
          {Object.entries(RANGE_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        {/* Sucursal (placeholder hasta tener branches reales) */}
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={branch}
          onChange={(e) => apply({ branch: e.target.value })}
          title="Sucursal"
        >
          <option value="all">Todas</option>
          <option value="soon" disabled>
            (Sucursales próximamente)
          </option>
        </select>

        {/* Búsqueda */}
        <form onSubmit={onSubmit} className="hidden md:flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente / reward / staff (próximo)"
            className="w-[320px]"
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <div className="hidden md:block">
          <div className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            ⌘K (próximo)
          </div>
        </div>

        <a href="/owner/rewards">
          <Button size="sm">Nuevo reward</Button>
        </a>
      </div>
    </div>
  );
}