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
    <>
      <div className="rounded-lg border border-light bg-card p-6 shadow-lg md:p-8">
        <div aria-hidden className="text-center text-[56px] leading-none">
          🎯
        </div>
        <h1 className="mt-4 text-center font-display text-display-lg uppercase tracking-wide text-dark">
          Casi listo
        </h1>
        <p className="mt-2 text-center text-body-sm leading-relaxed text-muted-d">
          Elige cómo te van a ver otros tipsters en el ranking.
        </p>

        <div className="mt-5 rounded-sm border border-alert-warning-border bg-alert-warning-bg px-3 py-2 text-body-xs text-alert-warning-text">
          <strong>Importante:</strong> el @handle no se puede cambiar después.
        </div>

        <div className="mt-5">
          <CompletarPerfilForm callbackUrl={callbackUrl} />
        </div>

        <p className="mt-5 text-center text-body-xs leading-relaxed text-muted-d">
          Entraste con{" "}
          <strong className="text-dark">{session.user.email}</strong>. Si no
          eres tú,{" "}
          <Link
            href="/api/auth/signout"
            className="font-semibold text-brand-blue-main hover:underline"
          >
            cerrar sesión
          </Link>
          .
        </p>
      </div>
    </>
  );
}
