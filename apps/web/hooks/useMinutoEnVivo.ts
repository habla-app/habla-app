"use client";
// useMinutoEnVivo — reloj local del minuto del partido en vivo.
// Hotfix #8 Bug #22.
//
// El poller corre cada 30s y actualiza el cache in-memory con
// `{ statusShort, elapsed, updatedAt }` del fixture. Antes el LiveHero
// se quedaba pegado al último snapshot entre ticks (siempre mostrando
// "23'" por 30s aunque el partido avanzara). Este hook mantiene la UX
// de reloj de estadio: cada segundo re-evalúa cuánto tiempo pasó desde
// el snapshot del server y recalcula el minuto localmente.
//
// Contrato:
//   - Recibe el snapshot del server (statusShort + elapsed + updatedAt).
//   - Solo avanza el minuto local si statusShort es "activo" (1H/2H/ET).
//     En HT/FT/NS/PEN/P/SUSP/etc. el label es fijo y no se incrementa.
//   - Cap por tiempo: 45' en 1H, 90' en 2H, 120' en ET. Si el API
//     reporta más minutos (prórroga largas, descuento), respetamos el
//     valor del server — el cap solo aplica a la extensión LOCAL.
//   - Al llegar un snapshot nuevo (nuevo `updatedAt`), el hook reinicia
//     el cómputo y ancla al nuevo valor.
//   - El interval se limpia al unmount y al cambiar de status inactivo.

import { useEffect, useState } from "react";
import {
  formatMinutoLabel,
  renderMinutoLabel,
} from "@/lib/utils/minuto-label";

export interface MinutoEnVivoInput {
  /** `fixture.status.short` del snapshot del server. */
  statusShort: string | null;
  /** `fixture.status.elapsed` numérico (minuto anclado al snapshot). */
  elapsed: number | null;
  /** Timestamp epoch ms en que el server capturó el snapshot. */
  snapshotUpdatedAt: number | null;
  /** Label server-rendered como fallback: si el hook no corre (SSR o
   *  status no-avanzable), se usa este. Evita flicker entre hydration
   *  y primer tick del interval. */
  fallbackLabel: string | null;
}

/** Status codes de api-football que representan un partido avanzando
 *  cronológicamente. En estos el reloj local incrementa segundo a
 *  segundo (convertido a minutos enteros). */
const STATUSES_AVANZANDO = new Set(["1H", "2H", "ET"]);

/** Cap del minuto local por status. Si el server reporta más, respeta
 *  el valor del server (prórroga extendida, descuento largo). */
const CAP_POR_STATUS: Record<string, number> = {
  "1H": 45,
  "2H": 90,
  ET: 120,
};

/**
 * Calcula el minuto efectivo (server elapsed + tiempo local transcurrido)
 * capped al máximo del status. Función pura para testear sin fake timers.
 */
export function computeElapsedLocal(input: {
  statusShort: string | null;
  elapsed: number | null;
  snapshotUpdatedAt: number | null;
  now: number;
}): number | null {
  const { statusShort, elapsed, snapshotUpdatedAt, now } = input;
  if (!statusShort || !STATUSES_AVANZANDO.has(statusShort)) return elapsed;
  if (elapsed === null || snapshotUpdatedAt === null) return elapsed;
  const deltaMs = Math.max(0, now - snapshotUpdatedAt);
  const deltaMin = Math.floor(deltaMs / 60_000);
  const proyectado = elapsed + deltaMin;
  const cap = CAP_POR_STATUS[statusShort];
  // Si el server ya superó el cap (ej. 2H con elapsed=94 por descuento),
  // no revertimos — respetamos el server.
  if (cap !== undefined && elapsed >= cap) return elapsed;
  if (cap !== undefined) return Math.min(cap, proyectado);
  return proyectado;
}

/**
 * Hook: devuelve el label del minuto, actualizado segundo a segundo
 * cuando el status es avanzable. En estados fijos (HT/FT/PEN/...)
 * devuelve el label del mapper `formatMinutoLabel` o el fallback.
 */
export function useMinutoEnVivo(input: MinutoEnVivoInput): string {
  const { statusShort, elapsed, snapshotUpdatedAt, fallbackLabel } = input;

  // Si el status no avanza o falta data, el label es estático: usamos
  // el mapper o el fallback del server. No levantamos interval para no
  // quemar renders sin razón.
  const esAvanzable =
    !!statusShort &&
    STATUSES_AVANZANDO.has(statusShort) &&
    elapsed !== null &&
    snapshotUpdatedAt !== null;

  // Estado del minuto local efectivo. Iniciamos con el cómputo de
  // `Date.now()` al mount — evita que el primer render pinte el
  // `elapsed` raw si ya pasó tiempo desde `snapshotUpdatedAt`.
  const [elapsedLocal, setElapsedLocal] = useState<number | null>(() =>
    computeElapsedLocal({
      statusShort,
      elapsed,
      snapshotUpdatedAt,
      now: Date.now(),
    }),
  );

  useEffect(() => {
    // Reset al cambiar snapshot: recalculamos inmediatamente con el
    // nuevo ancla (`snapshotUpdatedAt`). Si el status dejó de ser
    // avanzable, el próximo render usará el path estático.
    setElapsedLocal(
      computeElapsedLocal({
        statusShort,
        elapsed,
        snapshotUpdatedAt,
        now: Date.now(),
      }),
    );

    if (!esAvanzable) return;

    // Reloj local: cada 1s re-evaluamos el minuto. Solo se re-rendera
    // cuando el minuto entero cambia (setState diffa contra prev).
    const id = setInterval(() => {
      const nuevo = computeElapsedLocal({
        statusShort,
        elapsed,
        snapshotUpdatedAt,
        now: Date.now(),
      });
      setElapsedLocal((prev) => (prev === nuevo ? prev : nuevo));
    }, 1000);
    return () => clearInterval(id);
  }, [statusShort, elapsed, snapshotUpdatedAt, esAvanzable]);

  if (!esAvanzable) {
    // Estado fijo: derivamos del mapper si tenemos statusShort, sino
    // usamos el fallback del server (para preservar label SSR).
    if (statusShort) {
      return formatMinutoLabel({ statusShort, elapsed });
    }
    return renderMinutoLabel(fallbackLabel);
  }

  // Estado avanzable: el label se deriva del minuto local computado.
  return formatMinutoLabel({ statusShort, elapsed: elapsedLocal });
}
