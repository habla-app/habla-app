"use client";
// TrackOnMount — Lote 6.
//
// Helper genérico para que server-components disparen un evento de
// analytics al montarse en el cliente. Patrón heredado del viejo
// wrapper de PostHog: importás este componente, le pasás el nombre del
// evento + props, y se encarga de llamar `track(...)` exactamente UNA
// vez por mount, con respeto al cookie consent.
//
// Uso:
//   import { TrackOnMount } from "@/components/analytics/TrackOnMount";
//   ...
//   return <>
//     <TrackOnMount event="match_viewed" props={{ torneoId, partido }} />
//     ...resto de la page...
//   </>;
//
// Por qué un componente y no un useEffect inline: las pages son server
// components y no pueden usar useEffect. Separar el track en un client
// child es el camino más simple sin convertir toda la page a client.

import { useEffect } from "react";
import { track } from "@/lib/analytics";

interface Props {
  event: string;
  props?: Record<string, unknown>;
  /** Si false, no se trackea (útil para evitar el track según un guard
   *  que sólo conoce el server, ej: usuario admin que no quiere contarse). */
  enabled?: boolean;
}

export function TrackOnMount({ event, props, enabled = true }: Props) {
  useEffect(() => {
    if (!enabled) return;
    track(event, props);
    // Intencional: trackeamos UNA vez por mount. Si la URL cambia y la
    // page re-renderea con props nuevos, seguirá trackeando una vez por
    // mount. No metemos `event` y `props` como deps para evitar disparos
    // múltiples por re-render con el mismo objeto pero referencia nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
