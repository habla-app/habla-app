// Distribución de premios — Hotfix #6 (reemplaza 35/20/12/33%).
//
// Regla de negocio (CLAUDE.md §2, §6):
//   - Pagan el 10% de inscritos, con cortes especiales para torneos chicos.
//   - Curva top-heavy: el 1° se lleva exactamente 45% del pozo neto; el
//     55% restante se reparte entre los demás pagados con decaimiento
//     geométrico.
//   - Empates: los tickets con puntaje idéntico reparten equitativamente
//     la suma de los premios de las posiciones que ocupan como grupo.
//     Si el grupo empatado se extiende más allá de M, todos cobran
//     igualmente su parte del pool acotado a M (decisión PO).
//   - Desempates adicionales: NO existen. Mismos puntos = mismo premio.
//     El orden de inscripción queda como tiebreaker cosmético estable
//     para la UI, pero no afecta premios.
//
// Redondeo: Math.floor sobre cada share individual. El residual por
// redondeo se suma al 1° lugar para que `sum(premios) === pozoNeto`.
// Decisión: floor (no banker's rounding) — es conservador, determinístico,
// y el residual va al ganador que ya es el más favorecido. Documentado
// en el PR del Hotfix #6.

/**
 * Cortes de posiciones pagadas según total de inscritos.
 *
 * Los primeros 5 brackets usan tablas fijas (M=1, 2, 3, 5). Desde N=50
 * se pasa a la curva geométrica (M=10 fijo hasta N=99, después
 * `round(N*0.10)`).
 */
export function calcularPagados(totalInscritos: number): number {
  if (totalInscritos < 2) return 0;
  if (totalInscritos <= 9) return 1;
  if (totalInscritos <= 19) return 2;
  if (totalInscritos <= 29) return 3;
  if (totalInscritos <= 49) return 5;
  if (totalInscritos <= 99) return 10;
  return Math.round(totalInscritos * 0.1);
}

/**
 * Tablas fijas para brackets chicos (M ≤ 5). Suman exactamente 1.0.
 *
 * Propiedades:
 *   - share[0] siempre ≥ 0.45 (curva top-heavy).
 *   - shares estrictamente decrecientes.
 */
const FIXED_SHARES: Record<number, number[]> = {
  1: [1.0],
  2: [0.65, 0.35],
  3: [0.5, 0.3, 0.2],
  5: [0.4, 0.25, 0.18, 0.1, 0.07],
};

/**
 * Calcula los shares (en unidades enteras de Luka) para cada posición
 * pagada. `result[0]` es el premio del 1°, `result[M-1]` el del último
 * puesto pagado.
 *
 * Para M ≥ 10 usa la fórmula geométrica:
 *   share[1] = P * 0.45
 *   r = 1 - 2.8/M
 *   B = (P * 0.55) * (1 - r) / (1 - r^(M-1))
 *   share[i] = B * r^(i - 2)   para i en 2..M
 *
 * El residual por `Math.floor` se suma al 1° para que la suma de shares
 * enteros coincida exactamente con `pozoNeto`.
 */
export function calcularShares(M: number, pozoNeto: number): number[] {
  if (M < 1 || pozoNeto < 0) return [];
  if (M === 1) return [pozoNeto];

  const sharesFloat = calcularSharesFloat(M);
  const sharesInt = sharesFloat.map((s) => Math.floor(s * pozoNeto));
  const asignado = sharesInt.reduce((a, b) => a + b, 0);
  const residual = pozoNeto - asignado;
  if (residual > 0 && sharesInt[0] !== undefined) {
    sharesInt[0] += residual;
  }
  return sharesInt;
}

/**
 * Porcentajes de shares en float (suman 1.0). Exportado para tests.
 */
export function calcularSharesFloat(M: number): number[] {
  if (M < 1) return [];
  const fixed = FIXED_SHARES[M];
  if (fixed) return [...fixed];

  // Curva geométrica para M ≥ 10 (y cualquier M no fijo, ej. M=20, 50, 100)
  const shares: number[] = new Array(M);
  shares[0] = 0.45;
  const r = 1 - 2.8 / M;
  // calibration constant B such that share[2..M] sum to 0.55
  const denom = 1 - Math.pow(r, M - 1);
  const B = denom > 0 ? (0.55 * (1 - r)) / denom : 0;
  for (let i = 2; i <= M; i++) {
    shares[i - 1] = B * Math.pow(r, i - 2);
  }
  return shares;
}

// ---------------------------------------------------------------------------
// distribuirPremios — función pura, entrada tickets → salida asignaciones
// ---------------------------------------------------------------------------

export interface TicketParaDistribuir {
  id: string;
  puntosTotal: number;
  /** Sólo usado como orden cosmético estable para la UI (tiebreaker
   *  secundario ASC). NO afecta el premio. */
  creadoEn: Date;
}

export interface AsignacionPremio {
  ticketId: string;
  /** Posición final 1-indexed. Tickets empatados comparten posicionFinal
   *  (ej. los 3 empatados en 1° reciben posicionFinal=1 todos). */
  posicionFinal: number;
  /** Lukas que le corresponden. 0 si quedó fuera de los puestos pagados. */
  premioLukas: number;
}

/**
 * Distribuye premios entre los tickets según la nueva curva del Hotfix #6.
 *
 * Algoritmo:
 *   1. Ordena tickets por puntosTotal DESC, creadoEn ASC (cosmético).
 *   2. Calcula M = pagados, shares enteros.
 *   3. Agrupa tickets empatados en puntaje.
 *   4. Para cada grupo que arranca en P_start:
 *        - Si P_start > M → todos reciben 0.
 *        - Si P_start ≤ M → P_end = min(P_start + grupo.size - 1, M);
 *          reparte la suma de shares[P_start..P_end] entre los
 *          tickets del grupo (floor + residual al primero del grupo).
 *   5. Todos los tickets del grupo comparten posicionFinal = P_start.
 *
 * Caso borde: si grupo se extiende más allá de M (ej. 1 puntero solo +
 * 15 empatados en 2° con M=10), los 15 reparten sum(shares[2..10])/15
 * cada uno. Todos cobran — decisión PO explícita.
 */
export function distribuirPremios(
  tickets: TicketParaDistribuir[],
  totalInscritos: number,
  pozoNeto: number,
): AsignacionPremio[] {
  const M = calcularPagados(totalInscritos);
  const shares = calcularShares(M, pozoNeto);

  // Orden: puntos DESC, creadoEn ASC (cosmético para estabilidad UI).
  const ordenados = [...tickets].sort((a, b) => {
    if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
    return a.creadoEn.getTime() - b.creadoEn.getTime();
  });

  const resultado: AsignacionPremio[] = [];

  let i = 0;
  while (i < ordenados.length) {
    // Detectar el grupo de tickets con mismos puntos que empiezan en i
    const puntosGrupo = ordenados[i]!.puntosTotal;
    let j = i;
    while (j < ordenados.length && ordenados[j]!.puntosTotal === puntosGrupo) {
      j++;
    }
    const grupoSize = j - i;
    const posStart = i + 1; // 1-indexed

    // Suma de shares que abarca el grupo (acotado a M).
    let sumaShares = 0;
    if (posStart <= M) {
      const posEnd = Math.min(posStart + grupoSize - 1, M);
      for (let p = posStart; p <= posEnd; p++) {
        sumaShares += shares[p - 1] ?? 0;
      }
    }

    // Reparto: cada ticket del grupo recibe floor(suma / grupoSize); el
    // residual va al primero del grupo (estable por orden de inscripción).
    if (sumaShares > 0 && grupoSize > 0) {
      const base = Math.floor(sumaShares / grupoSize);
      const residual = sumaShares - base * grupoSize;
      for (let k = 0; k < grupoSize; k++) {
        const t = ordenados[i + k]!;
        resultado.push({
          ticketId: t.id,
          posicionFinal: posStart,
          premioLukas: base + (k === 0 ? residual : 0),
        });
      }
    } else {
      // Grupo fuera de los puestos pagados — todos reciben 0.
      for (let k = 0; k < grupoSize; k++) {
        const t = ordenados[i + k]!;
        resultado.push({
          ticketId: t.id,
          posicionFinal: posStart,
          premioLukas: 0,
        });
      }
    }

    i = j;
  }

  return resultado;
}

/**
 * Calcula el premio que recibiría un ticket en una posición dada,
 * asumiendo NO HAY empates. Útil para mostrar "premio estimado" en el
 * ranking en vivo. Si hay empates reales, usar `distribuirPremios` para
 * obtener los valores correctos.
 */
export function premioEstimadoSinEmpate(
  posicion: number,
  totalInscritos: number,
  pozoNeto: number,
): number {
  if (posicion < 1) return 0;
  const M = calcularPagados(totalInscritos);
  if (posicion > M) return 0;
  const shares = calcularShares(M, pozoNeto);
  return shares[posicion - 1] ?? 0;
}
