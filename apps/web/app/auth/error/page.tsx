// /auth/error — pantalla de error de NextAuth. Lote B v3.1.
// Spec: docs/ux-spec/02-pista-usuario-publica/auth.spec.md.
//
// Mapea `?error=…` a mensajes humanos. CTA "Volver a Iniciar sesión".

import Link from "next/link";
import { Button } from "@/components/ui";

interface ErrorPageProps {
  searchParams: { error?: string };
}

const MENSAJES_ERROR: Record<string, string> = {
  Configuration:
    "El servidor de autenticación no está configurado correctamente. Contacta a soporte.",
  AccessDenied:
    "Acceso denegado. Verifica que tu email sea el correcto e intenta de nuevo.",
  Verification:
    "El link mágico expiró o ya fue usado. Solicita uno nuevo.",
  OAuthCallback:
    "Hubo un problema al ingresar con Google. Inténtalo de nuevo.",
  OAuthSignin:
    "No pudimos iniciar el flujo de Google. Inténtalo de nuevo.",
  OAuthCreateAccount:
    "Tuvimos un problema creando tu cuenta. Contacta a soporte.",
  Default: "Algo salió mal al procesar tu acceso. Intenta de nuevo.",
};

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const tipo = searchParams.error ?? "Default";
  const mensaje = MENSAJES_ERROR[tipo] ?? MENSAJES_ERROR.Default;

  return (
    <>
      <div className="rounded-lg border border-light bg-card p-6 text-center shadow-lg md:p-8">
        <div aria-hidden className="text-[56px] leading-none">
          ⚠️
        </div>
        <h1 className="mt-4 font-display text-display-lg uppercase tracking-wide text-dark">
          Algo salió mal
        </h1>
        <p className="mt-3 text-body-md leading-relaxed text-body">
          {mensaje}
        </p>
        <Link href="/auth/signin" className="mt-6 inline-block">
          <Button variant="primary" size="lg">
            Volver a iniciar sesión
          </Button>
        </Link>
      </div>
    </>
  );
}
