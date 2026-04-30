// Layout del grupo `(public)` — Lote B (rewrite mobile-first del Lote 8).
// Spec: docs/ux-spec/02-pista-usuario-publica/00-layout-y-nav.spec.md.
//
// Decisión arquitectónica v3.1: el layout público y el autenticado comparten
// shell (MobileHeader + BottomNav). La única diferencia es el ítem "Perfil":
// si hay session linkea a /perfil, si no a /auth/signin. Esto unifica la
// experiencia entre visitante anónimo y registrado y elimina dos layouts
// divergentes.
//
// El header público sigue mostrando barra desktop (68px navy) en lg+ — el
// SEO/desktop necesita los nav links horizontales para descubrir secciones.

import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { logger } from "@/lib/services/logger";
import { PublicHeaderV31 } from "@/components/layout/PublicHeaderV31";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";

async function obtenerLiveCount(): Promise<number> {
  try {
    return await contarLiveMatches();
  } catch (err) {
    logger.error({ err }, "(public) layout: contarLiveMatches falló");
    return 0;
  }
}

export const revalidate = 3600;

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const liveCount = await obtenerLiveCount();
  const isAuthenticated = !!session?.user;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <PublicHeaderV31 />
      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <Footer />
      <BottomNav liveDot={liveCount > 0} isAuthenticated={isAuthenticated} />
    </div>
  );
}
