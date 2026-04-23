// /auth/signin — "Ingresar" (cuenta existente).
//
// Flujo: Google OAuth (botón) o email magic link. El form de email NO crea
// usuario — si el email no está registrado, el server-action redirige a
// /auth/signup?email=<email>&hint=no-account.
//
// Para /auth/login (nombre anterior), no hay redirect: eliminamos esa ruta
// y NextAuth queda configurada con pages.signIn = "/auth/signin".

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
    const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!emailRaw) return;

    // Registro formal: si no existe usuario con ese email, no mandamos
    // magic link — redirigimos a /auth/signup con el email pre-cargado.
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
    <div className="w-full max-w-[460px]">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-center text-[56px] leading-none">
          ⊕
        </div>
        <h1 className="mt-4 text-center font-display text-[34px] font-black uppercase tracking-wide text-dark">
          Entrá a Habla!
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-d">
          ¿Ya tenés cuenta? Usá Google o tu email.
        </p>

        {hint === "no-account" ? (
          <div className="mt-5 rounded-sm border border-urgent-high bg-urgent-high-bg px-3 py-2 text-[13px] text-urgent-high-dark">
            No encontramos una cuenta con ese email. Creá una en segundos.
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <GoogleButton callbackUrl={callbackUrl} label="Entrar con Google" />
          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-light" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-soft">
              o
            </span>
            <span className="h-px flex-1 bg-border-light" />
          </div>

          <form action={enviarMagicLink} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-muted-d"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                defaultValue={searchParams.hint === "no-account" ? "" : ""}
                placeholder="tu@correo.com"
                className="w-full rounded-sm border-[1.5px] border-light bg-card px-3.5 py-[13px] text-sm text-dark outline-none placeholder:text-soft transition-all focus:border-brand-blue-main focus:ring-4 focus:ring-brand-blue-main/10"
              />
              <p className="mt-1.5 text-[11px] text-muted-d">
                Te enviamos un enlace mágico. Sin contraseñas.
              </p>
            </div>

            <Button type="submit" variant="primary" size="xl">
              Enviarme el enlace
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted-d">
          ¿Es tu primera vez?{" "}
          <Link
            href={`/auth/signup${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="font-bold text-brand-blue-main hover:underline"
          >
            Creá tu cuenta →
          </Link>
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-xs font-semibold text-muted-d transition-colors hover:text-brand-gold-dark"
        >
          ← Volver a los torneos
        </Link>
      </div>
    </div>
  );
}
