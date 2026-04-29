// Layout del grupo (main) — envuelve landing, perfil, tienda, torneos,
// torneo/:id con NavBar arriba y BottomNav fijo en mobile. Fondo light bg-page.
//
// Las rutas /auth/* y /admin/* tienen sus propios layouts y NO heredan de éste.
//
// Lote 2 (Abr 2026): se removió el hidratador del balance Lukas (sistema
// demolido) y la lectura de balanceGanadas. El NavBar ya no muestra chip
// de saldo.
//
// Bug #12 (Hotfix #5): llamamos `contarLiveMatches()` una sola vez y lo
// pasamos como `initialLiveCount` tanto al NavBar (desktop) como al
// BottomNav (mobile).

import type { ReactNode } from "react";
import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { logger } from "@/lib/services/logger";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";

async function obtenerLiveCount(): Promise<number> {
  try {
    return await contarLiveMatches();
  } catch (err) {
    logger.error({ err }, "(main) layout: contarLiveMatches falló");
    return 0;
  }
}

export default async function MainLayout({ children }: { children: ReactNode }) {
  const liveCount = await obtenerLiveCount();

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar initialLiveCount={liveCount} />
      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <Footer />
      <BottomNav initialLiveCount={liveCount} />
    </div>
  );
}
