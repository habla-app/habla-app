import Link from "next/link";

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
        <div aria-hidden className="text-6xl">
          ⚠️
        </div>
        <h1 className="mt-4 font-display text-3xl font-black uppercase tracking-wide text-dark">
          Algo salió mal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-body">{mensaje}</p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-sm bg-brand-gold px-5 py-3 text-sm font-bold text-black shadow-gold transition-all hover:-translate-y-0.5 hover:bg-brand-gold-light"
        >
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
