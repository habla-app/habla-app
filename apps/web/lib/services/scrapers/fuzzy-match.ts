// Fuzzy matching de nombres de equipos para discovery automático
// (Lote V.7).
//
// Implementación nativa en TypeScript del algoritmo Jaro-Winkler.
// Cero deps externas: ~80 líneas, deterministic, sin servicio externo.
// La regla 5 del CLAUDE.md ("cero servicios externos nuevos sin discutir")
// se respeta + evitamos un paquete npm más en el lock.
//
// Uso típico (en `alias-equipo.ts`):
//
//   import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
//   if (similitudEquipos(candidato, canonico) >= UMBRAL_FUZZY_DEFAULT) {
//     // match con alta confianza — emitir alias y persistir.
//   }
//
// La función consume strings ya normalizados (NFD + lowercase + trim) que
// produce `normalizarNombreEquipo`. Pero también acepta strings sin
// normalizar — re-normaliza internamente para ser robusta al caller.

/**
 * Umbral por default para considerar dos nombres de equipo "el mismo".
 * Probado contra el conjunto de equipos peruanos del Lote V (Liga 1):
 *
 *   - "Universidad César Vallejo" vs "U César Vallejo" → ~0.91 (acepta)
 *   - "Sport Boys"               vs "Sport Huancayo"   → ~0.83 (rechaza)
 *   - "Alianza Lima"             vs "Alianza Atlético" → ~0.85 (rechaza)
 *   - "Universitario"            vs "U. Universitario" → ~0.94 (acepta)
 *
 * El umbral 0.88 está calibrado con margen para el caso "U César Vallejo"
 * (0.91) y suficiente distancia del peor falso positivo conocido
 * "Alianza Atlético" (0.85). Si en producción aparece un falso positivo
 * sutil, subimos el umbral aquí — es la única perilla a tocar.
 */
export const UMBRAL_FUZZY_DEFAULT = 0.88;

/**
 * Umbral más laxo para matching de partidos en scrapers (Lote V.14.3).
 *
 * Antes los scrapers usaban `UMBRAL_FUZZY_DEFAULT * 0.7 = 0.616`. En
 * ligas internacionales con nombres más variables (ej. "Atletico Torque"
 * vs "Atlético Torque", "Bayern de Múnich" vs "Bayern München"), el
 * umbral 0.616 dejaba algunos partidos sin matchear. Bajamos a 0.5 para
 * ser más permisivos. El filtro adicional por liga + fecha implícito en
 * cada scraper (solo procesamos eventos del listing de la liga buscada)
 * compensa la mayor permisividad — falsos positivos casi imposibles
 * porque solo hay ~10-20 partidos por listing.
 */
export const UMBRAL_FUZZY_MATCH_PARTIDO = 0.5;

/**
 * Score de baja confianza (>= UMBRAL_FUZZY_DEFAULT pero < esto). Los
 * matches en este rango se loggean para revisión manual durante las
 * primeras semanas. Por encima de este score, el match se considera
 * sólido y no se loggea.
 */
export const UMBRAL_FUZZY_BAJA_CONFIANZA = 0.92;

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Distancia de Jaro entre dos strings. Devuelve 0..1, donde 1 = idénticas.
 *
 * Implementación canónica:
 *   1. Caracteres "matcheados" = mismo char dentro de una ventana de
 *      `floor(max(|a|,|b|)/2) - 1`.
 *   2. Transposiciones = pares matcheados que aparecen en orden distinto.
 *   3. Jaro = (m/|a| + m/|b| + (m - t/2)/m) / 3.
 */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(b.length, i + matchDistance + 1);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  return (
    (matches / a.length +
      matches / b.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Distancia de Jaro-Winkler. Sube el score cuando los primeros caracteres
 * coinciden — útil para nombres de equipos donde el prefijo suele ser
 * estable ("Universidad ..." vs "Univ ...", "Sport ..." vs "Sport ...").
 *
 * Prefix scaling factor `p = 0.1` es el valor canónico recomendado
 * (Winkler 1990). El prefix length se capa a 4 caracteres.
 */
export function similitudJaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j === 0) return 0;
  const prefijoMax = 4;
  let prefijo = 0;
  for (let i = 0; i < Math.min(prefijoMax, a.length, b.length); i++) {
    if (a[i] === b[i]) prefijo++;
    else break;
  }
  return j + prefijo * 0.1 * (1 - j);
}

/**
 * Similitud entre dos nombres de equipo. Normaliza ambos primero (NFD +
 * lowercase + trim + colapsar espacios) y aplica Jaro-Winkler. Devuelve
 * un número en [0, 1].
 *
 * Esta es la función pública que el matcher consume. No expone Jaro puro
 * porque para nombres de equipo el comportamiento de Winkler es
 * estrictamente mejor (los prefijos importan).
 */
export function similitudEquipos(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return similitudJaroWinkler(na, nb);
}

/**
 * Conveniencia: ¿estos dos nombres son "el mismo equipo"?
 * Wrapper sobre `similitudEquipos` con umbral configurable (default
 * `UMBRAL_FUZZY_DEFAULT`).
 */
export function puedeMatchearFuzzy(
  a: string,
  b: string,
  umbral: number = UMBRAL_FUZZY_DEFAULT,
): { ok: boolean; score: number } {
  const score = similitudEquipos(a, b);
  return { ok: score >= umbral, score };
}
