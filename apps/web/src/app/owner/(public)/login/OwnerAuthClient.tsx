"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Mail,
  ShieldCheck,
  UserPlus,
  Wrench,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Props = {
  error?: string;
  isDev: boolean;
  doOwnerLogin: (formData: FormData) => void;
  doOwnerRegister: (formData: FormData) => void;
  doDevLoginById: (formData: FormData) => void;
};

type Flow = "login" | "register";
type Step = 1 | 2 | 3;

function stepToProgress(step: Step) {
  if (step === 1) return 33;
  if (step === 2) return 66;
  return 100;
}

export default function OwnerAuthClient(props: Props) {
  const [open, setOpen] = React.useState(false);
  const [flow, setFlow] = React.useState<Flow>("login");
  const [step, setStep] = React.useState<Step>(1);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");

  const [showDev, setShowDev] = React.useState(false);

  function resetFor(nextFlow: Flow) {
    setFlow(nextFlow);
    setStep(1);
    setEmail("");
    setPassword("");
    setPassword2("");
    setShowDev(false);
  }

  function openLogin() {
    resetFor("login");
    setOpen(true);
  }

  function openRegister() {
    resetFor("register");
    setOpen(true);
  }

  function goBack() {
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  function goNext() {
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  }

  const title = flow === "login" ? "Iniciar sesión" : "Crear cuenta";
  const stepLabel = step === 1 ? "Elegí método" : step === 2 ? "Tu email" : "Confirmación";

  return (
    <main className="min-h-screen bg-background">
      {/* Fondo “SaaS / App moderna” */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_120px,hsl(var(--primary)/0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_12%_80%,rgba(0,0,0,0.06),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,transparent,rgba(0,0,0,0.03))]" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-14">
        {/* HEADER */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              LOOP • Owner
            </Badge>
            <span className="text-xs text-muted-foreground">acceso</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Entrá al panel</h1>

          <p className="text-sm text-muted-foreground sm:text-base">
            Login / registro rápido, sin pantallas largas. Estilo “app grande”.
          </p>
        </div>

        {/* CTA CARD */}
        <Card className="border-border/60 bg-background/70 backdrop-blur shadow-[0_20px_60px_-45px_rgba(0,0,0,0.35)]">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Acceso</CardTitle>
            <CardDescription>Elegí una opción. Todo el flujo vive en un popup.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {props.error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Error: <span className="font-medium">{props.error}</span>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="w-full" onClick={openLogin}>
                Iniciar sesión
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button className="w-full" variant="secondary" onClick={openRegister}>
                Crear cuenta
                <UserPlus className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="bg-background/60">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Experiencia “producto grande”
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Feedback inmediato, estados claros y módulos.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-background/60">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Setup guiado
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Si es primera vez: comercio → sucursales → defaults (antes del Home).
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <div className="pt-1 text-xs text-muted-foreground">
              <Link href="/" className="underline underline-offset-4 hover:text-foreground">
                Volver a roles
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SHEET */}
        <Sheet
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setShowDev(false);
              setStep(1);
            }
          }}
        >
          <SheetContent
            side="bottom"
            className="
              p-0
              sm:mx-auto sm:my-8 sm:max-w-3xl
              sm:rounded-3xl
              rounded-t-3xl
              overflow-hidden
            "
          >
            {/* wrapper para centrar/agrandar bien */}
            <div className="p-6 sm:p-8">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="flex items-center gap-2 text-xl">
                      <KeyRound className="h-5 w-5" />
                      Acceso Owner
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-sm">
                      {title} • Step {step} / 3 — {stepLabel}
                    </SheetDescription>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full cursor-pointer"
                    onClick={() => setOpen(false)}
                  >
                    <span className="sr-only">Cerrar</span>
                    ✕
                  </Button>
                </div>
              </SheetHeader>

              <div className="mt-4">
                <Progress value={stepToProgress(step)} />
              </div>

              <div className="mt-6 space-y-5">
                {/* STEP 1 */}
                {step === 1 ? (
                  <>
                    <div className="rounded-2xl border bg-background/70 p-4">
                      <div className="text-sm font-semibold">Elegí método</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Por ahora Email + Password. Después migramos a OTP/magic link sin cambiar UX.
                      </div>
                    </div>

                    {/* CLICKEABLE fuerte */}
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="
                        group w-full rounded-2xl border bg-background px-4 py-4 text-left
                        transition
                        hover:bg-muted/50
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30
                        cursor-pointer
                      "
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-background">
                            <Mail className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">Continuar con e-mail</div>
                            <div className="text-xs text-muted-foreground">
                              {flow === "login" ? "Solo si ya tenés cuenta." : "Creá tu cuenta en 30 segundos."}
                            </div>
                          </div>
                        </div>

                        <span className="text-muted-foreground transition group-hover:translate-x-0.5">→</span>
                      </div>
                    </button>

                    {/* NOTA: sacamos Google y sacamos botones de flow aquí */}
                  </>
                ) : null}

                {/* STEP 2 */}
                {step === 2 ? (
                  <>
                    <div className="rounded-2xl border bg-background/70 p-4">
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Primero tu email.</div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Email</div>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="tu@comercio.com"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant="secondary" onClick={goBack} className="w-full cursor-pointer">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Atrás
                      </Button>

                      <Button
                        type="button"
                        onClick={goNext}
                        className="w-full cursor-pointer"
                        disabled={!email.trim()}
                      >
                        Continuar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : null}

                {/* STEP 3 */}
                {step === 3 ? (
                  <>
                    <div className="rounded-2xl border bg-background/70 p-4">
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Email: <span className="font-medium text-foreground">{email || "-"}</span>
                      </div>
                    </div>

                    {flow === "login" ? (
                      <>
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Contraseña</div>
                          <Input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            placeholder="Contraseña"
                          />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button type="button" variant="secondary" onClick={goBack} className="w-full cursor-pointer">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Atrás
                          </Button>

                          <form
                            action={(fd) => {
                              fd.set("email", email);
                              fd.set("password", password);
                              props.doOwnerLogin(fd);
                            }}
                          >
                            <Button
                              type="submit"
                              className="w-full cursor-pointer"
                              disabled={!email.trim() || !password.trim()}
                            >
                              Entrar
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </form>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          (Luego: OTP / magic link — mismo flow, mejor UX.)
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Contraseña</div>
                          <Input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            placeholder="Contraseña (mín 8)"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Repetir contraseña</div>
                          <Input
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            type="password"
                            placeholder="Repetir contraseña"
                          />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button type="button" variant="secondary" onClick={goBack} className="w-full cursor-pointer">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Atrás
                          </Button>

                          <form
                            action={(fd) => {
                              fd.set("email", email);
                              fd.set("password", password);
                              fd.set("password_confirm", password2);
                              props.doOwnerRegister(fd);
                            }}
                          >
                            <Button
                              type="submit"
                              className="w-full cursor-pointer"
                              disabled={!email.trim() || !password.trim() || password.length < 8 || password2 !== password}
                            >
                              Crear cuenta
                              <CheckCircle2 className="ml-2 h-4 w-4" />
                            </Button>
                          </form>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Después de registrarte: onboarding del comercio (antes del Home).
                        </div>
                      </>
                    )}
                  </>
                ) : null}
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground cursor-pointer"
                >
                  Cancelar
                </button>

                <span className="rounded-full border bg-background/70 px-2 py-1 text-xs text-muted-foreground">
                  PedidosYa-style
                </span>
              </div>

              {/* DEV tools dentro del modal */}
              {props.isDev ? (
                <>
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowDev((v) => !v)}
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      DEV tools
                    </button>

                    <span className="text-xs text-muted-foreground">solo local</span>
                  </div>

                  {showDev ? (
                    <div className="mt-3 rounded-2xl border bg-background/50 p-4">
                      <div className="text-sm font-medium">Entrar pegando auth_user_id</div>
                      <div className="mt-3">
                        <form action={props.doDevLoginById} className="grid gap-3">
                          <Input
                            name="user_id"
                            placeholder="db72b6e2-385e-4938-8faf-acaae8ad7318"
                            defaultValue={process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID ?? ""}
                          />
                          <Button type="submit" variant="secondary" className="w-full cursor-pointer">
                            Entrar (DEV)
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}