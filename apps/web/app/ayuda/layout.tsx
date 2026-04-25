// Layout para /ayuda/* — chrome común (NavBar + Footer). Muy similar al
// de /legal/* pero con su propio archivo para que la metadata y el
// contenido se versionen aparte.

import type { ReactNode } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { contarLiveMatches } from "@/lib/services/live-matches.service";
import { logger } from "@/lib/services/logger";

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
  const liveCount = await obtenerLiveCount();
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar initialLiveCount={liveCount} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
