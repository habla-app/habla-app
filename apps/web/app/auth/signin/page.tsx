// /auth/signin — "Bienvenido de vuelta" (cuenta existente). Lote B v3.1.
// Spec: docs/ux-spec/02-pista-usuario-publica/auth.spec.md.
//
// Flujo: Google OAuth (botón primario) o email magic link. El form de
// email NO crea usuario — si el email no está registrado, el server-action
// redirige a /auth/signup con `hint=no-account` para que el visitante vea
// un CTA hacia "Crear cuenta gratis".

import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { prisma } from "@habla/db";
import { Button } from "@/components/ui";
import { GoogleButton } from "@/components/auth/GoogleButton";

interface PageProps {
  searchParams: { callbackUrl?: string; hint?: string };
}

export const dynamic = "force-dynamic";

export default function SignInPage({ searchParams }: PageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/";
  const hint = searchParams.hint ?? null;

  async function enviarMagicLink(formData: FormData) {
    "use server";
    const emailRaw = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!emailRaw) return;

    const existente = await prisma.usuario.findUnique({
      where: { email: emailRaw },
      select: { id: true },
    });
    if (!existente) {
      redirect(
        `/auth/signup?email=${encodeURIComponent(emailRaw)}&hint=no-account`,
      );
    }

    await signIn("resend", {
      email: emailRaw,
      redirectTo: callbackUrl,
    });
  }

  return (
    <>
      <div className="rounded-lg border border-light bg-card p-6 shadow-lg md:p-8">
        <h1 className="text-center font-display text-display-lg uppercase tracking-wide text-dark">
          Bienvenido de vuelta
        </h1>
        <p className="mt-2 text-center text-body-sm leading-relaxed text-muted-d">
          Continúa donde lo dejaste.
        </p>

        {hint === "no-account" ? (
          <div className="mt-5 rounded-sm border border-alert-warning-border bg-alert-warning-bg px-3 py-2 text-body-sm text-alert-warning-text">
            Este email no tiene cuenta aún.{" "}
            <Link
              href="/auth/signup"
              className="font-bold underline-offset-2 hover:underline"
            >
              Crear cuenta gratis →
            </Link>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <GoogleButton
            callbackUrl={callbackUrl}
            label="Ingresar con Google"
          />
          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-light" />
            <span className="text-label-sm text-soft">o</span>
            <span className="h-px flex-1 bg-border-light" />
          </div>

          <form action={enviarMagicLink} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-label-sm text-muted-d"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                className="touch-target w-full rounded-sm border-[1.5px] border-light bg-card px-3.5 py-3 text-body-md text-dark outline-none placeholder:text-soft transition-all focus:border-brand-blue-main focus:ring-4 focus:ring-brand-blue-main/10"
              />
              <p className="mt-1.5 text-body-xs text-muted-d">
                Te enviamos un enlace mágico. Sin contraseñas.
              </p>
            </div>

            <Button type="submit" variant="primary" size="xl">
              Ingresar con email
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-body-xs leading-relaxed text-muted-d">
          ¿No tienes cuenta?{" "}
          <Link
            href={`/auth/signup${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="font-bold text-brand-blue-main hover:underline"
          >
            Crear una gratis →
          </Link>
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-body-xs font-semibold text-white/70 transition-colors hover:text-brand-gold"
        >
          ← Volver al inicio
        </Link>
      </div>
    </>
  );
}
