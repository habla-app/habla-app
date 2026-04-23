// Pantalla de error cuando NextAuth rechaza el magic link (token vencido,
// config rota, etc.). Mapea `?error=…` a un mensaje en español.
import Link from "next/link";
import { Button } from "@/components/ui";

interface ErrorPageProps {
  searchParams: { error?: string };
}

const MENSAJES_ERROR: Record<string, string> = {
  Configuration:
    "El servidor de autenticación no está configurado correctamente. Contacta a soporte.",
  AccessDenied:
    "No tienes permiso para acceder. Verifica tu email o intenta de nuevo.",
  Verification:
    "El link de acceso ya venció o fue usado. Solicita uno nuevo.",
  Default: "Algo salió mal al procesar tu acceso. Intenta de nuevo.",
};

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const tipo = searchParams.error ?? "Default";
  const mensaje = MENSAJES_ERROR[tipo] ?? MENSAJES_ERROR.Default;

  return (
    <div className="w-full max-w-[460px] text-center">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-[56px] leading-none">
          ⚠️
        </div>
        <h1 className="mt-4 font-display text-[34px] font-black uppercase tracking-wide text-dark">
          Algo salió mal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-body">{mensaje}</p>
        <Link href="/auth/signin" className="mt-6 inline-block">
          <Button variant="primary" size="lg">
            Intentar de nuevo
          </Button>
        </Link>
      </div>
    </div>
  );
}
