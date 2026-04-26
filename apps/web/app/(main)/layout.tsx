// Layout del grupo (main) — envuelve landing, wallet, perfil, tienda, torneos,
// torneo/:id con NavBar arriba y BottomNav fijo en mobile. Fondo light bg-page.
//
// Las rutas /auth/* y /admin/* tienen sus propios layouts y NO heredan de éste.
//
// Llama `auth()` para hidratar el `useLukasStore` con el balance real del
// usuario en el primer mount via `LukasBalanceHydrator`. Sin esto el store
// quedaba en 0 hasta la primera mutación y el ComboModal mostraba "Balance
// después: -<entrada>" para usuarios sin tickets previos en ese torneo.
//
// Bug #12 (Hotfix #5): llamamos `contarLiveMatches()` una sola vez y lo
// pasamos como `initialLiveCount` tanto al NavBar (desktop) como al
// BottomNav (mobile). Antes el NavBar hardcodeaba "2" y el BottomNav no
// tenía badge; ahora ambos muestran el count real y se ocultan cuando 0.
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { logger } from "@/lib/services/logger";
import { obtenerBalanceGanadas } from "@/lib/usuarios";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { LukasBalanceHydrator } from "@/components/auth/LukasBalanceHydrator";

async function obtenerLiveCount(): Promise<number> {
  try {
    return await contarLiveMatches();
  } catch (err) {
    logger.error({ err }, "(main) layout: contarLiveMatches falló");
    return 0;
  }
}

export default async function MainLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const initialBalance = session?.user?.balanceLukas ?? null;

  // Fetch liveCount y balanceGanadas en paralelo (ambos son cheap y
  // no dependen entre sí). Lote 6C: balanceGanadas para el badge del header.
  const [liveCount, initialBalanceGanadas] = await Promise.all([
    obtenerLiveCount(),
    userId ? obtenerBalanceGanadas(userId) : Promise.resolve(0),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar initialLiveCount={liveCount} initialBalanceGanadas={initialBalanceGanadas} />
      <LukasBalanceHydrator initialBalance={initialBalance} />
      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <Footer />
      <BottomNav initialLiveCount={liveCount} />
    </div>
  );
}
