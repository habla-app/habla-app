// Layout /ayuda/* — Lote B v3.1 (refactor del Lote 0).
// Spec: docs/ux-spec/02-pista-usuario-publica/suscribir-y-aux.spec.md.
//
// Comparte el shell público (MobileHeader mobile + NavBar desktop +
// Footer + BottomNav). Las rutas /ayuda/* no están en el grupo (public)
// del App Router por razones históricas, pero la experiencia de
// navegación debe ser idéntica.

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
    logger.error({ err }, "/ayuda layout: contarLiveMatches falló");
    return 0;
  }
}

export default async function AyudaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const liveCount = await obtenerLiveCount();
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <PublicHeaderV31 />
      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <Footer />
      <BottomNav liveDot={liveCount > 0} isAuthenticated={!!session?.user} />
    </div>
  );
}
