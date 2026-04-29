// Layout del grupo (main) — envuelve landing, perfil, torneos, torneo/:id
// con NavBar arriba y BottomNav fijo en mobile. Fondo light bg-page.
//
// Las rutas /auth/* y /admin/* tienen sus propios layouts y NO heredan de éste.
//
// Lote 3 (Abr 2026): el BottomNav ya no muestra el badge "🔴 En vivo"
// (los items son Inicio/Partidos/Pronósticos/Comunidad/Perfil). El badge
// sigue presente en el NavBar desktop, así que `contarLiveMatches()` se
// mantiene como prop sólo para él.

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
      <BottomNav />
    </div>
  );
}
