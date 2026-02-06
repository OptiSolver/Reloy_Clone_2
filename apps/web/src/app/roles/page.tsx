"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, Shield, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RoleCardProps = {
  href: string;
  title: string;
  desc: string;
  tag: string;
  Icon: React.ComponentType<{ className?: string }>;
};

function RoleCard({ href, title, desc, tag, Icon }: RoleCardProps) {
  return (
    <Link href={href} className="block focus:outline-none">
      <Card
        className="
          group relative overflow-hidden
          border-border/60 bg-background/70 backdrop-blur
          shadow-[0_18px_45px_-35px_rgba(0,0,0,0.35)]
          transition-all
          hover:-translate-y-0.5
          hover:shadow-[0_28px_70px_-45px_rgba(0,0,0,0.45)]
          active:translate-y-0
          focus-visible:ring-2 focus-visible:ring-primary/30
        "
      >
        {/* Glow SaaS */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="absolute -top-28 left-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        </div>

        {/* Sheen */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <div className="absolute -left-24 top-0 h-full w-64 rotate-12 bg-linear-to-r from-transparent via-black to-transparent" />
        </div>

        <CardHeader className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="
                  grid h-11 w-11 place-items-center rounded-2xl
                  border bg-background shadow-sm
                  transition
                  group-hover:scale-[1.03]
                "
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="space-y-1">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-sm">{desc}</CardDescription>
              </div>
            </div>

            <Badge variant="secondary" className="rounded-full">
              {tag}
            </Badge>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
            Entrar
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardHeader>

        <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />
      </Card>
    </Link>
  );
}

export default function RolesPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Fondo SaaS moderno */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_120px,hsl(var(--primary)/0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_10%_80%,rgba(0,0,0,0.06),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,transparent,rgba(0,0,0,0.03))]" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-16">
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              LOOP
            </Badge>
            <span className="text-xs text-muted-foreground">v0 • UI base</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Elegí tu rol
          </h1>

          <p className="text-sm text-muted-foreground sm:text-base">
            La landing solo decide el mundo. Cada mundo tiene su login y su flujo propio.
          </p>
        </div>

        <div className="rounded-3xl border bg-background/40 p-3 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.35)] backdrop-blur sm:p-4">
          <div className="grid gap-3">
            <RoleCard href="/owner/login" title="Owner" desc="Dueño / Admin del comercio" tag="Admin" Icon={Building2} />
            <RoleCard href="/staff/login" title="Staff" desc="Operación rápida en sucursal" tag="Operación" Icon={Shield} />
            <RoleCard href="/app/login" title="Cliente" desc="Wallet, misiones, recompensas" tag="App" Icon={Smartphone} />
          </div>

          <div className="mt-4 flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Next.js + Tailwind + shadcn/ui</span>
            <span className="rounded-full border bg-background/70 px-2 py-1">UI System</span>
          </div>
        </div>
      </div>
    </main>
  );
}