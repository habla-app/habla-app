import Link from "next/link";

export default function VerificarPage() {
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <div className="rounded-2xl border border-brand-border bg-brand-card p-8">
        <div className="mb-4 text-6xl">&#128231;</div>
        <h1 className="mb-2 font-display text-2xl font-black uppercase text-white">
          &iexcl;Revisa tu correo!
        </h1>
        <p className="mb-6 text-sm text-brand-muted">
          Te enviamos un link de acceso a tu email. Haz clic en el link para
          entrar.
        </p>
        <p className="mb-6 text-xs text-brand-muted/70">
          &iquest;No lleg&oacute;? Revisa la carpeta de spam.
        </p>
        <Link
          href="/auth/login"
          className="inline-block rounded-lg border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-text transition-colors hover:border-brand-gold hover:text-brand-gold"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}
