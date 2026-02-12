"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffScanPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;

    setLoading(true);
    try {
      const res = await fetch("/api/staff/resolve-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "No se pudo resolver el cliente");
        return;
      }

      router.push(`/staff/customer/${data.customer_id}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (document.getElementById("scan-input") as HTMLInputElement | null)?.focus();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Staff</div>
        <div className="text-xs text-muted-foreground">Scan</div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          id="scan-input"
          className="w-full rounded-md border px-3 py-3 text-base"
          placeholder="Escaneá / pegá código (QR o teléfono)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoCapitalize="none"
        />

        <button
          className="w-full rounded-md bg-primary py-3 text-primary-foreground disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Buscando…" : "Continuar"}
        </button>
      </form>

      <div className="text-xs text-muted-foreground">
        Scanner inalámbrico = teclado: tipea acá + Enter.
      </div>
    </div>
  );
}