"use client";
// TrackOnMount — Lote 6.
//
// Helper genérico para que server-components disparen un evento de
// analytics al montarse en el cliente. Patrón heredado del viejo
// wrapper de PostHog: importás este componente, le pasás el nombre del
// evento + props, y se encarga de llamar `track(...)` exactamente UNA
// vez por mount, con respeto al cookie consent.
//
// Edge case manejado (Lote 6 hotfix): si en mount el usuario todavía
// NO concedió consent (banner pendiente o recién rechazó), `track()`
// es no-op silencioso. Para no perder ese primer pageview, registramos
// un listener al evento `habla:cookie-consent-change`. Si después del
// mount el usuario acepta, disparamos el track UNA vez. Si nunca
// acepta o ya tenía consent, el listener se limpia al unmount.
//
// Uso:
//   import { TrackOnMount } from "@/components/analytics/TrackOnMount";
//   <TrackOnMount event="match_viewed" props={{ torneoId, partido }} />

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { hasAnalyticsConsent, listenConsent } from "@/lib/cookie-consent";

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

    let alreadyFired = false;
    const fireOnce = () => {
      if (alreadyFired) return;
      alreadyFired = true;
      track(event, props);
    };

    if (hasAnalyticsConsent()) {
      // Caso normal: consent ya aceptado, disparamos en este tick.
      fireOnce();
      return;
    }

    // Caso edge: sin consent en este mount. Esperamos al primer cambio
    // a `analytics: true` y disparamos. Si el usuario nunca acepta o
    // rechaza, el unsubscribe en cleanup garantiza que no quede listener
    // colgado.
    const unsubscribe = listenConsent((state) => {
      if (state.analytics) fireOnce();
    });
    return unsubscribe;
    // Intencional: trackeamos UNA vez por mount. `event` y `props` no van
    // como deps para evitar disparos múltiples por re-render con el mismo
    // objeto pero referencia nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
