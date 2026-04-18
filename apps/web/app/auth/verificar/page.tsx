import Link from "next/link";

export default function VerificarPage() {
  return (
    <div className="w-full max-w-[460px] text-center">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-6xl">
          📧
        </div>
        <h1 className="mt-4 font-display text-3xl font-black uppercase tracking-wide text-dark">
          ¡Revisa tu correo!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-body">
          Te enviamos un link de acceso a tu email. Haz clic en el link para
          entrar.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-d">
          ¿No llegó? Revisa la carpeta de spam.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-sm border border-strong px-5 py-2.5 text-sm font-semibold text-body transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}
