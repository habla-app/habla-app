// /auth/verificar — pantalla "revisa tu correo" tras enviar magic link.
// Lote B v3.1. Spec: docs/ux-spec/02-pista-usuario-publica/auth.spec.md.

import Link from "next/link";

export default function VerificarPage() {
  return (
    <>
      <div className="rounded-lg border border-light bg-card p-6 text-center shadow-lg md:p-8">
        <div aria-hidden className="text-[56px] leading-none">
          📧
        </div>
        <h1 className="mt-4 font-display text-display-lg uppercase tracking-wide text-dark">
          Revisa tu email
        </h1>
        <p className="mt-3 text-body-md leading-relaxed text-body">
          Te enviamos un link mágico. Click ahí para entrar.
        </p>
        <p className="mt-2 text-body-xs leading-relaxed text-muted-d">
          ¿No llegó? Revisa la carpeta de spam o promociones.
        </p>
        <Link
          href="/auth/signin"
          className="touch-target mt-6 inline-flex items-center rounded-sm border-[1.5px] border-strong px-5 py-2.5 text-body-sm font-semibold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Cambiar de email
        </Link>
      </div>
    </>
  );
}
