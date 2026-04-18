// Auth login — réplica de `.auth-box` del mockup (docs/habla-mockup-completo.html
// líneas 811-820, 3836-3849). Card centrada light + form con magic link Resend
// (lógica heredada del Sprint 1 intacta).
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui";

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
    <div className="w-full max-w-[460px]">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-center text-[56px] leading-none">
          ⊕
        </div>
        <h1 className="mt-4 text-center font-display text-[34px] font-black uppercase tracking-wide text-dark">
          Entra a Habla!
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-d">
          Te enviaremos un enlace mágico. Sin contraseñas.
        </p>

        <form action={enviarMagicLink} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-muted-d"
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
              className="w-full rounded-sm border-[1.5px] border-light bg-card px-3.5 py-[13px] text-sm text-dark outline-none placeholder:text-soft transition-all focus:border-brand-blue-main focus:ring-4 focus:ring-brand-blue-main/10"
            />
            <p className="mt-1.5 text-[11px] text-muted-d">
              Revisa tu carpeta de spam si no llega en un minuto.
            </p>
          </div>

          <Button type="submit" variant="primary" size="xl">
            Enviar enlace mágico
          </Button>
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
