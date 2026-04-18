import { signIn } from "@/lib/auth";
import Link from "next/link";

interface LoginPageProps {
  searchParams: { callbackUrl?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = searchParams.callbackUrl ?? "/";

  async function enviarMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!email) return;

    await signIn("resend", {
      email,
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="w-full max-w-[460px]">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-center text-6xl">
          ⊕
        </div>
        <h1 className="mt-4 text-center font-display text-3xl font-black uppercase tracking-wide text-dark">
          Entra a Habla!
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-d">
          Te enviaremos un enlace mágico. Sin contraseñas.
        </p>

        <form action={enviarMagicLink} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-d"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              className="w-full rounded-sm border-[1.5px] border-light bg-card px-3.5 py-3 text-sm text-dark placeholder:text-soft focus:border-brand-blue-main focus:outline-none focus:ring-4 focus:ring-brand-blue-main/10"
            />
            <p className="mt-1.5 text-[11px] text-muted-d">
              Revisa tu carpeta de spam si no llega en un minuto.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-brand-gold px-4 py-4 font-display text-base font-extrabold uppercase tracking-wider text-black shadow-gold transition-all hover:-translate-y-0.5 hover:bg-brand-gold-light"
          >
            Enviar enlace mágico
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-d">
          Al registrarte aceptas los{" "}
          <span className="font-semibold text-brand-blue-main">Términos</span>
          {" · "}Mayores de 18 años
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
