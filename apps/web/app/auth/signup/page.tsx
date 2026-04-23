// /auth/signup — "Crear cuenta" (usuario nuevo).
//
// Flujo Google: click GoogleButton → NextAuth crea user con username
// temporal → middleware lo manda a /auth/completar-perfil.
// Flujo email: form (email + username + T&C) → POST /api/v1/auth/signup
// (crea user con username definitivo + bonus 500) → signIn("resend", {email})
// client-side dispara magic link → /auth/verificar.

import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

interface PageProps {
  searchParams: { callbackUrl?: string; email?: string };
}

export const dynamic = "force-dynamic";

export default function SignUpPage({ searchParams }: PageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/";
  const emailInicial = searchParams.email ?? "";

  return (
    <div className="w-full max-w-[460px]">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-center text-[56px] leading-none">
          ⊕
        </div>
        <h1 className="mt-4 text-center font-display text-[34px] font-black uppercase tracking-wide text-dark">
          Creá tu cuenta
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-d">
          Registrate y recibí{" "}
          <strong className="text-brand-gold-dark">500 Lukas</strong> de
          bienvenida.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <GoogleButton callbackUrl={callbackUrl} label="Continuar con Google" />
          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-light" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-soft">
              o
            </span>
            <span className="h-px flex-1 bg-border-light" />
          </div>

          <SignupForm emailInicial={emailInicial} callbackUrl={callbackUrl} />
        </div>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted-d">
          ¿Ya tenés cuenta?{" "}
          <Link
            href={`/auth/signin${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="font-bold text-brand-blue-main hover:underline"
          >
            Iniciá sesión →
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
