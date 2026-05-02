// /torneo/[id] — Legacy redirect 301 (Lote 0 → v3.2).
//
// Histórico:
//   - Lote 0:  URL original `/torneo/[id]` con `Torneo.id` (cuid).
//   - Lote C:  rebrand a `/comunidad/torneo/[slug]` (slug = `Partido.id`).
//   - Lote K v3.2: rebrand final a `/liga/[slug]` (slug = `Partido.id`).
//
// Como Next.js redirects sincrónicos no pueden hacer lookups de BD para
// mapear `Torneo.id` → `Partido.id`, este Server Component hace el lookup
// vía Prisma y emite un redirect 301 server-side.
//
// Si el torneoId no existe, redirige a /liga (la home de la Liga Habla!).
// Esta page NO renderiza UI — solo redirige.

import { permanentRedirect } from "next/navigation";
import { partidoIdDeTorneoLegacy } from "@/lib/services/torneos.service";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function TorneoLegacyRedirect({ params }: Props) {
  let partidoId: string | null = null;
  try {
    partidoId = await partidoIdDeTorneoLegacy(params.id);
  } catch {
    partidoId = null;
  }
  const destino = partidoId ? `/liga/${partidoId}` : "/liga";
  permanentRedirect(destino);
}
