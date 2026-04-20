"use client";
// useMinutoEnVivo — reloj local del minuto del partido en vivo.
// Hotfix #8 Bug #22 + Ítems 3/4 (refactor post-feedback del PO).
//
// Diseño final:
//   - El server envía `{ statusShort, elapsed, elapsedAgeMs }` en cada
//     render (SSR) y en cada ranking:update (WS). `elapsedAgeMs` es la
//     edad del snapshot del cache al momento en que el server armó el
//     payload (calculada con el reloj del server — inmune a clock skew).
//   - El cliente anchora el reloj al momento REAL en que el server
//     capturó el elapsed: `elapsedAnchorAt = Date.now() - elapsedAgeMs`.
//     Esto evita el desfase de +5 min que veía el PO cuando abría la
//     pestaña y el cache del server tenía un snapshot de varios minutos.
//   - Si `elapsed` o `elapsedAgeMs` cambian (nuevo tick del poller llegó
//     vía WS), el hook re-ancla usando el valor nuevo.
//   - Fases avanzables (1H/2H/ET): proyectamos `elapsed + delta local`
//     con cap 45/90/120. Si el server reporta `elapsed >= cap` (descuento
//     largo), respetamos el server sin proyectar.
//   - Fases fijas (HT/FT/AET/PEN/NS/...) delegan al mapper
//     `formatMinutoLabel` sin interval.
//   - Sin `elapsed` (cache totalmente frío): devolvemos "—". NO usamos
//     heurística basada en `fechaInicio` porque ese cálculo asume HT
//     de 15 min — si el HT real fue diferente, genera desfase constante
//     (ese era el bug del Ítem 4). Preferimos ser honestos con el usuario
//     durante los ≤30s hasta que el primer tick del poller traiga datos.
//
// Diferencias vs. versiones anteriores:
//   - Ítem original: usaba `snapshotUpdatedAt` timestamp absoluto (clock
//     skew problemático).
//   - Simplificación post-feedback: usaba `fechaInicio` como ancla y
//     heurística de HT fijo (causó desfase real reportado por el PO).
//   - Esta versión: `elapsedAgeMs` calculado server-side en el emit →
//     independiente del reloj del cliente, inmune al clock skew, y
//     refleja la edad REAL del snapshot.

import { useEffect, useRef, useState } from "react";
import { formatMinutoLabel } from "@/lib/utils/minuto-label";

export interface MinutoEnVivoInput {
  /** `fixture.status.short` del snapshot del server. Null hasta el primer
   *  tick del poller. */
  statusShort: string | null;
  /** `fixture.status.elapsed` numérico — minuto anclado al momento en
   *  que el server capturó el snapshot. Ancla del reloj local. */
  elapsed: number | null;
  /** Edad del snapshot al momento en que el server armó el payload
   *  (calculada con el reloj del server). El cliente anchora
   *  `elapsedAnchorAt = Date.now() - elapsedAgeMs`. Null si el server
   *  no tenía snapshot — el reloj no corre hasta que llegue uno. */
  elapsedAgeMs: number | null;
}

/** Statuses donde el minuto avanza cronológicamente (disparan interval). */
const STATUSES_AVANZANDO = new Set(["1H", "2H", "ET"]);

/** Cap del minuto local por status. Si el server reporta más, respeta
 *  el valor del server (prórroga extendida, descuento largo). */
const CAP_POR_STATUS: Record<string, number> = {
  "1H": 45,
  "2H": 90,
  ET: 120,
};

/**
 * Función pura: dado el snapshot del server + cuándo lo recibimos localmente,
 * devuelve el label a mostrar. Testeable sin fake timers.
 */
export function computeMinutoLabel(input: {
  statusShort: string | null;
  elapsed: number | null;
  /** Epoch ms en que el cliente determinó que el `elapsed` actual fue
   *  capturado por el server — ya NO es "cuando el cliente lo recibió",
   *  sino "cuando el server lo puso en el cache" (ajustado vía
   *  `elapsedAgeMs`). */
  elapsedAnchorAt: number;
  now: number;
}): string {
  const { statusShort, elapsed, elapsedAnchorAt, now } = input;

  // Sin statusShort del server → nada que mostrar con confianza. "—".
  // No fabricamos heurística basada en el kickoff porque el HT es
  // variable y el partido puede arrancar tarde.
  if (!statusShort) return "—";

  // Fases fijas: el mapper decide el label (sin interval en el hook).
  if (!STATUSES_AVANZANDO.has(statusShort)) {
    return formatMinutoLabel({ statusShort, elapsed });
  }

  // Fases avanzables: 1H/2H/ET.
  if (elapsed === null) {
    // Fase avanzable pero sin elapsed crudo — delegamos al mapper, que
    // devuelve "1T"/"2T"/"Prórroga" como placeholder legible.
    return formatMinutoLabel({ statusShort, elapsed: null });
  }

  const cap = CAP_POR_STATUS[statusShort] ?? 200;
  // Si el server ya superó el cap (1H con elapsed=48 por descuento; 2H
  // con elapsed=94), respetamos el server tal cual — el partido está
  // cerca del corte de fase, proyectar más allá es riesgoso.
  if (elapsed >= cap) {
    return statusShort === "ET" ? `Prór. ${elapsed}'` : `${elapsed}'`;
  }
  const delta = Math.max(0, Math.floor((now - elapsedAnchorAt) / 60_000));
  const final = Math.min(cap, elapsed + delta);
  return statusShort === "ET" ? `Prór. ${final}'` : `${final}'`;
}

/**
 * Hook: retorna el label del minuto, actualizado cada segundo en
 * statuses avanzables. En estados fijos retorna un string estable
 * sin levantar interval.
 */
export function useMinutoEnVivo(input: MinutoEnVivoInput): string {
  const { statusShort, elapsed, elapsedAgeMs } = input;

  // Ancla del elapsed: `Date.now() - elapsedAgeMs` da el epoch ms local
  // correspondiente al momento en que el SERVER capturó el elapsed.
  // Al mount: lo inicializamos con los valores actuales.
  // Al cambiar cualquier input del server: re-anclamos.
  const elapsedAnchorAt = useRef<number>(
    elapsedAgeMs !== null ? Date.now() - elapsedAgeMs : Date.now(),
  );
  const prevElapsedRef = useRef<number | null>(elapsed);
  const prevStatusRef = useRef<string | null>(statusShort);
  const prevAgeRef = useRef<number | null>(elapsedAgeMs);
  if (
    elapsed !== prevElapsedRef.current ||
    statusShort !== prevStatusRef.current ||
    elapsedAgeMs !== prevAgeRef.current
  ) {
    elapsedAnchorAt.current =
      elapsedAgeMs !== null ? Date.now() - elapsedAgeMs : Date.now();
    prevElapsedRef.current = elapsed;
    prevStatusRef.current = statusShort;
    prevAgeRef.current = elapsedAgeMs;
  }

  // `tick` fuerza re-render en cada segundo cuando estamos en fase
  // avanzable con elapsed conocido. `computeMinutoLabel` lee `Date.now()`
  // directo — el render siempre refleja el estado real al instante.
  const [, setTick] = useState(0);

  const esAvanzable =
    !!statusShort &&
    STATUSES_AVANZANDO.has(statusShort) &&
    elapsed !== null;

  useEffect(() => {
    if (!esAvanzable) return;
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, 1_000);
    return () => clearInterval(id);
  }, [esAvanzable]);

  return computeMinutoLabel({
    statusShort,
    elapsed,
    elapsedAnchorAt: elapsedAnchorAt.current,
    now: Date.now(),
  });
}
