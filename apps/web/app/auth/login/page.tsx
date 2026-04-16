import { signIn } from "@/lib/auth";
import Link from "next/link";

interface LoginPageProps {
  searchParams: { callbackUrl?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/";

  async function enviarMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) return;

    await signIn("resend", {
      email,
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      {/* Logo */}
      <Link
        href="/"
        className="mb-8 flex items-center justify-center gap-1.5 font-display text-[32px] font-black text-white"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold text-base font-black text-black">
          H
        </span>
        Habla!
      </Link>

      {/* Card */}
      <div className="rounded-2xl border border-brand-border bg-brand-card p-6">
        <h1 className="mb-2 text-center font-display text-2xl font-black uppercase text-white">
          Ingresa tu email
        </h1>
        <p className="mb-6 text-center text-sm text-brand-muted">
          Te enviamos un link de acceso. Sin contrase&ntilde;a.
        </p>

        <form action={enviarMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            className="w-full rounded-lg border border-brand-border bg-brand-blue-pale px-4 py-3 text-sm text-white placeholder:text-brand-muted focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-gold px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-brand-gold-light"
          >
            Enviar link de acceso
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-brand-muted">
          Al registrarte aceptas los <span className="text-brand-gold">T&eacute;rminos</span>
          {" "}&middot; Mayores de 18 a&ntilde;os
        </p>
      </div>

      {/* Link volver */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-xs font-semibold text-brand-muted hover:text-brand-gold"
        >
          &larr; Volver a los torneos
        </Link>
      </div>
    </div>
  );
}
