import Link from "next/link";

interface ErrorPageProps {
  searchParams: { error?: string };
}

const MENSAJES_ERROR: Record<string, string> = {
  Configuration:
    "El servidor de autenticaci\u00F3n no est\u00E1 configurado correctamente. Contacta a soporte.",
  AccessDenied: "No tienes permiso para acceder. Verifica tu email o intenta de nuevo.",
  Verification:
    "El link de acceso ya venci\u00F3 o fue usado. Solicita uno nuevo.",
  Default: "Algo sali\u00F3 mal al procesar tu acceso. Intenta de nuevo.",
};

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const tipo = searchParams.error ?? "Default";
  const mensaje = MENSAJES_ERROR[tipo] ?? MENSAJES_ERROR.Default;

  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <div className="rounded-2xl border border-brand-border bg-brand-card p-8">
        <div className="mb-4 text-6xl">&#9888;&#65039;</div>
        <h1 className="mb-2 font-display text-2xl font-black uppercase text-white">
          Algo sali&oacute; mal
        </h1>
        <p className="mb-6 text-sm text-brand-muted">{mensaje}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-gold-light"
        >
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
