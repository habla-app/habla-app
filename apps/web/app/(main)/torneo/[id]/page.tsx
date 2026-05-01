// /torneo/[id] — Lote C v3.1: redirect SSR 301 al nuevo URL del Lote C.
// Spec: docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// El URL viejo `/torneo/[id]` (Lote 0) usa el `Torneo.id` (cuid). El URL
// nuevo `/comunidad/torneo/[slug]` usa el `Partido.id`. Como Next.js
// redirects sincrónicos en `next.config.js` no pueden hacer lookups de
// BD para mapear el id, este Server Component hace el lookup vía Prisma
// y emite un redirect 301 server-side.
//
// Si el torneoId no existe, redirige a /comunidad (la home del Producto C).
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
  const destino = partidoId
    ? `/comunidad/torneo/${partidoId}`
    : "/comunidad";
  permanentRedirect(destino);
}
