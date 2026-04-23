// /auth/completar-perfil — el usuario llega aquí tras su primer OAuth
// Google (usernameLocked=false). Debe elegir @handle + aceptar T&C.
//
// Guards:
//  - Sin sesión → redirect a /auth/signin.
//  - Si ya tiene usernameLocked=true → redirect a callbackUrl o /.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { CompletarPerfilForm } from "@/components/auth/CompletarPerfilForm";

interface PageProps {
  searchParams: { callbackUrl?: string };
}

export const dynamic = "force-dynamic";

export default async function CompletarPerfilPage({ searchParams }: PageProps) {
  const session = await auth();
  const callbackUrl = searchParams.callbackUrl ?? "/";

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/auth/completar-perfil")}`);
  }

  if (session.user.usernameLocked) {
    redirect(callbackUrl);
  }

  return (
    <div className="w-full max-w-[480px]">
      <div className="rounded-lg border border-light bg-card p-10 shadow-lg">
        <div aria-hidden className="text-center text-[56px] leading-none">
          🎯
        </div>
        <h1 className="mt-4 text-center font-display text-[30px] font-black uppercase tracking-wide text-dark">
          Elegí tu @handle
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-d">
          Así te van a ver los otros jugadores en el ranking y en la lista de
          inscritos.
        </p>

        <div className="mt-5 rounded-sm border border-urgent-high/30 bg-urgent-high-bg px-3 py-2 text-[12px] text-urgent-high-dark">
          <strong>Importante:</strong> el @handle no se puede cambiar después.
          Elegilo con calma.
        </div>

        <div className="mt-5">
          <CompletarPerfilForm callbackUrl={callbackUrl} />
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-d">
          Entraste con{" "}
          <strong className="text-dark">{session.user.email}</strong>. Si no
          sos vos,{" "}
          <Link
            href="/api/auth/signout"
            className="font-semibold text-brand-blue-main hover:underline"
          >
            cerrá sesión
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
