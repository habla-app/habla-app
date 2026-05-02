// Layout del grupo (main) — Lote B (rewrite del Lote 0/3).
//
// El grupo (main) cubre vistas autenticadas: comunidad, perfil, mis-
// predicciones, live-match, torneo. Comparte BottomNav con (public),
// pero usa NavBar desktop (con widget en vivo) en lugar del header
// público. Las rutas /auth/* y /admin/* tienen sus propios layouts.

import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { logger } from "@/lib/services/logger";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { MobileHeader } from "@/components/ui/mobile";
import Link from "next/link";

async function obtenerLiveCount(): Promise<number> {
  try {
    return await contarLiveMatches();
  } catch (err) {
    logger.error({ err }, "(main) layout: contarLiveMatches falló");
    return 0;
  }
}

function iniciales(username: string, email: string): string {
  const base = username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const usuario = session?.user ?? null;
  const liveCount = await obtenerLiveCount();
  const isAuthenticated = !!usuario;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      {/* MOBILE — header simple (logo + avatar/entrar) */}
      <div className="lg:hidden">
        <MobileHeader
          variant="main"
          showLogo
          rightActions={
            usuario ? (
              <Link
                href="/perfil"
                aria-label="Mi cuenta"
                className="touch-target inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold-diagonal font-display text-[12px] font-black text-black"
              >
                {iniciales(usuario.username ?? "", usuario.email ?? "")}
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="touch-target inline-flex h-10 items-center rounded-sm bg-brand-gold px-3 text-[12px] font-bold text-black"
              >
                Entrar
              </Link>
            )
          }
        />
      </div>

      {/* DESKTOP — NavBar logueado con widget en vivo */}
      <div className="hidden lg:block">
        <NavBar initialLiveCount={liveCount} />
      </div>

      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <Footer />
      <BottomNav liveDot={liveCount > 0} isAuthenticated={isAuthenticated} />
    </div>
  );
}
