// Layout para todas las rutas /legal/* — provee chrome común (NavBar +
// fondo light + footer global heredado del root). El renderizado del
// documento (con TOC + back-to-top) lo hace cada page.tsx; este layout
// solo da la envoltura.

import type { ReactNode } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { logger } from "@/lib/services/logger";

async function obtenerLiveCount(): Promise<number> {
  try {
    return await contarLiveMatches();
  } catch (err) {
    logger.error({ err }, "/legal layout: contarLiveMatches falló");
    return 0;
  }
}

export default async function LegalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const liveCount = await obtenerLiveCount();

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar initialLiveCount={liveCount} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
