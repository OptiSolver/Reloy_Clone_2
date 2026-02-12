"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/staff/scan"), 900);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="space-y-2 py-10 text-center">
      <div className="text-4xl">✅</div>
      <div className="text-xl font-semibold">Registrado</div>
      <div className="text-sm text-muted-foreground">Volviendo…</div>
    </div>
  );
}