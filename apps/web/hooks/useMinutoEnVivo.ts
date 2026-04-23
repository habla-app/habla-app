"use client";
// useMinutoEnVivo — reloj local del minuto del partido en vivo.
// Reimplementación simplificada (Abr 2026) — referencia Google Live Match.
//
// Diseño:
//   - El server envía `{ statusShort, minuto, extra, elapsedAgeMs }` en
//     cada render (SSR) y en cada ranking:update (WS).
//     `elapsedAgeMs` = edad del snapshot del cache al momento en que el
//     server armó el payload (calculada con el reloj del server — inmune
//     a clock skew entre cliente y server).
//   - El cliente anchora el reloj al momento REAL en que el server capturó
//     el `minuto`: `anchoredAt = Date.now() - elapsedAgeMs`. Así el reloj
//     local proyecta correctamente aunque el snapshot del server tenga
//     varios minutos de antigüedad.
//   - Si cualquier input cambia (nuevo tick del poller vía WS), el hook
//     re-ancla con el valor nuevo.
//   - Fases avanzables (1H / 2H / ET): proyectamos `minuto + delta local`
//     con cap 45 / 90 / 120. Si el server reporta `minuto >= cap`, pasamos
//     el valor del server tal cual al mapper (injury time / prórroga
//     extendida).
//   - Fases fijas (HT / BT / NS / FT / AET / PEN / ...) delegan al mapper
//     `getMinutoLabel` sin levantar interval — el label queda congelado.

import { useEffect, useRef, useState } from "react";
import { getMinutoLabel } from "@/lib/utils/minuto-label";

export interface MinutoEnVivoInput {
  /** `fixture.status.short` del snapshot del server. Null hasta el primer
   *  tick del poller. */
  statusShort: string | null;
  /** `fixture.status.elapsed` numérico — minuto cursando anclado al momento
   *  en que el server capturó el snapshot. */
  minuto: number | null;
  /** `fixture.status.extra` — minutos de descuento/añadido (1H/2H). */
  extra: number | null;
  /** Edad del snapshot al momento en que el server armó el payload
   *  (calculada con el reloj del server). El cliente anchora
   *  `anchoredAt = Date.now() - elapsedAgeMs`. Null si el server no
   *  tenía snapshot — el reloj no corre hasta que llegue uno. */
  elapsedAgeMs: number | null;
}

/** Statuses donde el minuto avanza cronológicamente (disparan interval). */
const STATUSES_AVANZANDO = new Set(["1H", "2H", "ET"]);

/** Cap del minuto local por status. Si el server reporta más, respetamos
 *  el valor del server (prórroga extendida, descuento largo). */
const CAP_POR_STATUS: Record<string, number> = {
  "1H": 45,
  "2H": 90,
  ET: 120,
};

/**
 * Función pura: dado el snapshot del server + cuándo lo ancló el cliente,
 * devuelve el label a mostrar. Testeable sin fake timers.
 */
export function computeMinutoLabel(input: {
  statusShort: string | null;
  minuto: number | null;
  extra: number | null;
  /** Epoch ms que representa "cuando el server capturó el minuto actual"
   *  (ajustado vía `elapsedAgeMs` al recibir el payload). */
  anchoredAt: number;
  now: number;
}): string {
  const { statusShort, minuto, extra, anchoredAt, now } = input;

  if (!statusShort) {
    return getMinutoLabel({ statusShort, minuto, extra });
  }

  // Fases fijas: el mapper decide el label (sin interval en el hook).
  if (!STATUSES_AVANZANDO.has(statusShort)) {
    return getMinutoLabel({ statusShort, minuto, extra });
  }

  // Fases avanzables: 1H / 2H / ET.
  if (minuto === null) {
    return getMinutoLabel({ statusShort, minuto: null, extra });
  }

  const cap = CAP_POR_STATUS[statusShort] ?? 200;
  // Si el server ya reporta minuto >= cap (descuento largo / injury time),
  // respetamos el server y dejamos que el mapper formatee con extra.
  if (minuto >= cap) {
    return getMinutoLabel({ statusShort, minuto, extra });
  }
  const delta = Math.max(0, Math.floor((now - anchoredAt) / 60_000));
  const proyectado = Math.min(cap, minuto + delta);
  return getMinutoLabel({ statusShort, minuto: proyectado, extra });
}

/**
 * Hook: retorna el label del minuto, actualizado cada segundo en statuses
 * avanzables. En estados fijos retorna un string estable sin levantar
 * interval.
 */
export function useMinutoEnVivo(input: MinutoEnVivoInput): string {
  const { statusShort, minuto, extra, elapsedAgeMs } = input;

  // Ancla: `Date.now() - elapsedAgeMs` da el epoch ms local correspondiente
  // al momento en que el SERVER capturó el minuto. Al mount lo inicializamos
  // con los valores actuales; si cualquier input cambia, re-anclamos.
  const anchoredAt = useRef<number>(
    elapsedAgeMs !== null ? Date.now() - elapsedAgeMs : Date.now(),
  );
  const prevMinutoRef = useRef<number | null>(minuto);
  const prevStatusRef = useRef<string | null>(statusShort);
  const prevExtraRef = useRef<number | null>(extra);
  const prevAgeRef = useRef<number | null>(elapsedAgeMs);
  if (
    minuto !== prevMinutoRef.current ||
    statusShort !== prevStatusRef.current ||
    extra !== prevExtraRef.current ||
    elapsedAgeMs !== prevAgeRef.current
  ) {
    anchoredAt.current =
      elapsedAgeMs !== null ? Date.now() - elapsedAgeMs : Date.now();
    prevMinutoRef.current = minuto;
    prevStatusRef.current = statusShort;
    prevExtraRef.current = extra;
    prevAgeRef.current = elapsedAgeMs;
  }

  // `tick` fuerza re-render cada segundo cuando estamos en fase avanzable
  // con minuto conocido. `computeMinutoLabel` lee `Date.now()` directo.
  const [, setTick] = useState(0);

  const esAvanzable =
    !!statusShort &&
    STATUSES_AVANZANDO.has(statusShort) &&
    minuto !== null;

  useEffect(() => {
    if (!esAvanzable) return;
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, 1_000);
    return () => clearInterval(id);
  }, [esAvanzable]);

  return computeMinutoLabel({
    statusShort,
    minuto,
    extra,
    anchoredAt: anchoredAt.current,
    now: Date.now(),
  });
}
