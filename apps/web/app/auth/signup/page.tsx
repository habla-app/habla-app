// /auth/signup — "Únete gratis a la Liga Habla!" (usuario nuevo). Lote B v3.1.
// Spec: docs/ux-spec/02-pista-usuario-publica/auth.spec.md.
//
// Copy motivacional: el sign-up es la conversión más importante de la
// pista pública (visitante → free). El hero ahora muestra el premio y
// el social proof de tipsters compitiendo este mes.
//
// Flujo Google: GoogleButton → NextAuth crea user con username temporal →
// middleware lo manda a /auth/completar-perfil.
// Flujo email: SignupForm → POST /api/v1/auth/signup → magic link → /auth/verificar.

import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { obtenerLeaderboardMesActual } from "@/lib/services/leaderboard.service";

interface PageProps {
  searchParams: { callbackUrl?: string; email?: string; hint?: string };
}

export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: PageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/";
  const emailInicial = searchParams.email ?? "";
  const hint = searchParams.hint ?? null;

  // Social proof: count de tipsters únicos del mes en curso. Si la query
  // falla (raro), fallback a un texto sin número.
  let tipstersCount = 0;
  try {
    const lb = await obtenerLeaderboardMesActual();
    tipstersCount = lb.totalUsuarios;
  } catch {
    tipstersCount = 0;
  }

  return (
    <>
      <TrackOnMount event="signup_started" />

      <div className="rounded-lg border border-light bg-card p-6 shadow-lg md:p-8">
        <h1 className="text-center font-display text-display-lg uppercase leading-tight text-dark">
          Únete gratis a la Liga Habla!
        </h1>
        <p className="mt-2 text-center text-body-md leading-relaxed text-body">
          Compite por <strong className="text-dark">S/ 1,250 al mes</strong> en
          premios reales — sin gastar un sol.
        </p>

        {tipstersCount > 0 ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-sm bg-brand-gold-dim px-3 py-2">
            <span aria-hidden className="text-base">
              🔥
            </span>
            <p className="text-body-sm font-bold text-brand-gold-dark">
              {tipstersCount.toLocaleString("es-PE")} tipsters compitiendo este
              mes
            </p>
          </div>
        ) : null}

        {hint === "no-account" && emailInicial ? (
          <div className="mt-5 rounded-sm border border-alert-info-border bg-alert-info-bg px-3 py-2 text-body-sm text-alert-info-text">
            No encontramos cuenta con <strong>{emailInicial}</strong>. Crea una
            en segundos abajo.
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <GoogleButton
            callbackUrl={callbackUrl}
            label="Crear cuenta con Google"
          />
          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-light" />
            <span className="text-label-sm text-soft">o</span>
            <span className="h-px flex-1 bg-border-light" />
          </div>

          <SignupForm emailInicial={emailInicial} callbackUrl={callbackUrl} />
        </div>

        <p className="mt-5 text-center text-body-xs leading-relaxed text-muted-d">
          Al registrarte aceptas nuestros{" "}
          <Link
            href="/legal/terminos"
            className="font-bold underline-offset-2 hover:underline"
          >
            Términos
          </Link>{" "}
          y{" "}
          <Link
            href="/legal/privacidad"
            className="font-bold underline-offset-2 hover:underline"
          >
            Privacidad
          </Link>
          .
        </p>

        <p className="mt-4 text-center text-body-xs leading-relaxed text-muted-d">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/auth/signin${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="font-bold text-brand-blue-main hover:underline"
          >
            Iniciar sesión →
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
