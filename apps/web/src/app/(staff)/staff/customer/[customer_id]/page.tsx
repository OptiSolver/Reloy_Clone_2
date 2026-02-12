"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

type EventType = "checkin" | "checkout" | "purchase" | "redeem";

export default function StaffCustomerPage() {
  const { customer_id } = useParams<{ customer_id: string }>();
  const router = useRouter();
  const [type, setType] = useState<EventType>("checkin");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/staff/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id, type, payload: {} }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "No se pudo registrar el evento");
        return;
      }

      router.push("/staff/success");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button className="text-sm underline" onClick={() => router.push("/staff/scan")}>
        ← Volver
      </button>

      <h1 className="text-xl font-semibold">Registrar evento</h1>

      <div className="rounded-lg border p-3">
        <div className="text-sm text-muted-foreground">Cliente</div>
        <div className="font-mono text-sm">{customer_id}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["checkin", "checkout", "purchase", "redeem"] as EventType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={[
              "rounded-md border px-3 py-3 text-sm font-medium",
              type === t ? "bg-primary text-primary-foreground" : "bg-background",
            ].join(" ")}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        onClick={confirm}
        disabled={loading}
        className="w-full rounded-md bg-primary py-3 text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Confirmando…" : "Confirmar"}
      </button>
    </div>
  );
}