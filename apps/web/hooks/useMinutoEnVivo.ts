"use client";
// useMinutoEnVivo — reloj local del minuto del partido en vivo.
// Hotfix #8 Bug #22 (refactor simplificado post-feedback del PO).
//
// Diseño:
//   - `Partido.fechaInicio` (persistido en BD desde el import del fixture)
//     es el ancla PERMANENTE del reloj. Disponible SIEMPRE desde el SSR,
//     aun con el cache in-memory vacío post-restart.
//   - `fixture.status.short` del poller nos dice la fase actual:
//     NS → 1H → HT → 2H → (ET → BT → ET)? → FT/AET/PEN.
//   - Cuando la fase es 1H, el cliente proyecta desde `fechaInicio`:
//     minuto = clamp(1, 45, floor((now - fechaInicio) / 60000) + 1).
//     Esto funciona aunque el poller no haya escrito al cache todavía.
//   - Cuando la fase es 2H o ET, NO podemos usar `fechaInicio` directo
//     (el descanso del HT es variable — 10 a 25 min). Acá el `elapsed`
//     del server es el ancla y el reloj local proyecta desde él usando
//     un `useRef` que trackea cuándo lo recibimos por última vez.
//   - Los estados fijos (HT, FT, AET, PEN, NS, SUSP, ABD, ...) delegan
//     al mapper `formatMinutoLabel` y no levantan interval (sin gasto
//     de CPU).
//
// Diferencia vs. la versión original del Hotfix #8:
//   - Eliminamos `snapshotUpdatedAt` del payload del server. El 1H se
//     ancla a `fechaInicio` (persistido, no depende del cache); el 2H/ET
//     se ancla a un `useRef` que se resetea cuando cambia `elapsed` o
//     `statusShort`.
//   - Beneficio: `⏱` avanza DESDE EL PRIMER RENDER aunque el poller no
//     haya escrito al cache, mientras la hora de kickoff del partido sea
//     la programada (caso normal). Si el partido arranca tarde, el
//     primer tick del poller corrige con `elapsed` real.

import { useEffect, useRef, useState } from "react";
import { formatMinutoLabel } from "@/lib/utils/minuto-label";

export interface MinutoEnVivoInput {
  /** Kickoff programado del partido (ISO string o Date). Persistido en
   *  BD desde el import del fixture — disponible desde el primer render. */
  fechaInicio: string | Date;
  /** `fixture.status.short` del snapshot del server. Null hasta el primer
   *  tick del poller. El hook tolera null para no bloquear el render. */
  statusShort: string | null;
  /** `fixture.status.elapsed` numérico — minuto anclado al momento en
   *  que el server lo capturó. Ancla primaria del reloj en 2H/ET. */
  elapsed: number | null;
}

/** Statuses donde el minuto avanza cronológicamente (disparan interval). */
const STATUSES_AVANZANDO = new Set(["1H", "2H", "ET"]);

/** Cap del minuto proyectado local por status. No se aplica al valor
 *  directo del server: si el API reporta `elapsed > cap` por descuento
 *  largo, respetamos el server. El cap solo limita la extensión LOCAL. */
const CAP_POR_STATUS: Record<string, number> = {
  "1H": 45,
  "2H": 90,
  ET: 120,
};

/**
 * Función pura: dado el kickoff + status + elapsed opcional + "cuándo
 * vimos el último elapsed" + now, devuelve el label a mostrar.
 * Testeable sin fake timers.
 */
export function computeMinutoLabel(input: {
  fechaInicio: string | Date;
  statusShort: string | null;
  elapsed: number | null;
  /** Epoch ms en que el cliente recibió el `elapsed` actual. Se resetea
   *  cada vez que el server envía un valor nuevo. Se usa para proyectar
   *  en 2H/ET. Ignorado en 1H (el ancla es `fechaInicio`). */
  elapsedAnchorAt: number;
  now: number;
}): string {
  const { fechaInicio, statusShort, elapsed, elapsedAnchorAt, now } = input;

  // Sin status del server: heurística basada solo en fechaInicio —
  // útil para SSR antes del primer tick del poller.
  if (!statusShort) {
    return heuristicaSinStatus(fechaInicio, now);
  }

  // Statuses fijos: delegar al mapper, no hay reloj que correr.
  if (!STATUSES_AVANZANDO.has(statusShort)) {
    return formatMinutoLabel({ statusShort, elapsed });
  }

  // Statuses avanzables: 1H, 2H, ET.
  // Regla unificada: si el server reporta `elapsed`, ESE es la fuente de
  // verdad — proyectamos localmente sumando el tiempo transcurrido desde
  // que lo recibimos (`elapsedAnchorAt`). Si NO hay `elapsed` (primer
  // render antes del primer tick del poller, cache vacío post-restart),
  // caemos a `fechaInicio` como heurística solo para 1H — en 2H/ET no
  // podemos usar fechaInicio porque el HT es variable.
  const cap = CAP_POR_STATUS[statusShort] ?? 200;

  if (elapsed !== null) {
    // Server-anclado: `elapsed + delta local`. Si el server ya superó
    // el cap (p.ej. 1H con elapsed=48 por descuento largo del PT o 2H
    // con elapsed=94), respetamos el server tal cual.
    const delta = Math.max(0, Math.floor((now - elapsedAnchorAt) / 60_000));
    const final = elapsed >= cap ? elapsed : Math.min(cap, elapsed + delta);
    return statusShort === "ET" ? `Prór. ${final}'` : `${final}'`;
  }

  // Sin `elapsed` del server:
  if (statusShort === "1H") {
    // Heurística basada en fechaInicio mientras esperamos el primer tick
    // del poller. Se corrige automáticamente cuando llegue `elapsed`.
    const start = toEpochMs(fechaInicio);
    const mFromKickoff = Math.floor((now - start) / 60_000) + 1;
    return `${Math.max(1, Math.min(45, mFromKickoff))}'`;
  }
  // 2H/ET sin elapsed: no podemos derivar del kickoff (HT variable).
  // Delegar al mapper → devuelve "2T" / "Prórroga".
  return formatMinutoLabel({ statusShort, elapsed: null });
}

/**
 * Heurística cuando el server no envió statusShort todavía (SSR inicial,
 * cache vacío post-restart). Deriva una estimación basada solo en
 * `fechaInicio` asumiendo ritmo estándar: 45 min 1T + 15 min HT + 45 min 2T.
 * Mejor que mostrar "—". Se corrige en el próximo tick del poller (≤30s).
 */
function heuristicaSinStatus(fechaInicio: string | Date, now: number): string {
  const start = toEpochMs(fechaInicio);
  const deltaMin = Math.floor((now - start) / 60_000);
  if (deltaMin < 0) return "Por empezar";
  if (deltaMin < 45) return `${Math.max(1, deltaMin + 1)}'`;
  if (deltaMin < 60) return "ENT";
  if (deltaMin < 105) return `${Math.min(90, deltaMin - 15 + 1)}'`;
  return "—";
}

function toEpochMs(d: string | Date): number {
  return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}

/**
 * Hook: retorna el label del minuto, actualizado cada segundo en
 * statuses avanzables. En estados fijos retorna un string estable
 * sin levantar interval.
 */
export function useMinutoEnVivo(input: MinutoEnVivoInput): string {
  const { fechaInicio, statusShort, elapsed } = input;

  // Ancla del elapsed para 2H/ET: cuándo el cliente vio el valor actual.
  // Resetea cuando `elapsed` o `statusShort` cambian.
  const elapsedAnchorAt = useRef<number>(Date.now());
  const prevElapsedRef = useRef<number | null>(elapsed);
  const prevStatusRef = useRef<string | null>(statusShort);
  if (
    elapsed !== prevElapsedRef.current ||
    statusShort !== prevStatusRef.current
  ) {
    elapsedAnchorAt.current = Date.now();
    prevElapsedRef.current = elapsed;
    prevStatusRef.current = statusShort;
  }

  // `tick` no se usa en el cómputo — solo fuerza re-render en cada tick
  // del interval. `computeMinutoLabel` lee `Date.now()` directo para
  // que SSR y CSR coincidan con el estado real.
  const [, setTick] = useState(0);

  const esAvanzable =
    !!statusShort && STATUSES_AVANZANDO.has(statusShort);

  useEffect(() => {
    if (!esAvanzable && statusShort !== null) return;
    // Si no hay statusShort, también corremos el interval — la heurística
    // (`heuristicaSinStatus`) cruza las fases (1T → ENT → 2T) conforme
    // pasa el tiempo real.
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, 1_000);
    return () => clearInterval(id);
  }, [esAvanzable, statusShort]);

  return computeMinutoLabel({
    fechaInicio,
    statusShort,
    elapsed,
    elapsedAnchorAt: elapsedAnchorAt.current,
    now: Date.now(),
  });
}
