// Helper de matching de nombres de equipos para discovery automático
// (sección 5.1 del plan Lote V).
//
// Cada casa nombra a los equipos a su modo: "Universidad Técnica de
// Cajamarca" en Coolbet, "UTC" en otras, "U. T. de Cajamarca" en una
// tercera. Para que el discovery asocie el partido del scraper con
// `Partido.equipoLocal/equipoVisita` (el nombre canónico que importamos
// de api-football), normalizamos texto y consultamos la tabla
// `AliasEquipo` del Lote V.1.
//
// Estrategia de match (Lote V.7 — actualizada):
//   1. Normalización: NFD + lowercase + trim + colapsar espacios.
//   2. Match directo normalizado contra el canónico del partido. Si pega,
//      no consultamos BD (caso optimista — la mayoría de casas usa el
//      mismo nombre que api-football).
//   3. Si no pega directo, consultamos `AliasEquipo` con
//      `OR: [{ alias, casa }, { alias, casa: null }]` (la fila específica
//      para la casa gana sobre la global, en caso de duplicados).
//   4. Si tampoco pega vía AliasEquipo, fallback a similitud fuzzy
//      (Jaro-Winkler, umbral 0.88 default). Si matchea, write-back a
//      AliasEquipo fire-and-forget para que la próxima vez sea exact-hit.
//
// La tabla `AliasEquipo` ya no depende de seed manual: se autoalimenta vía
// el paso 4 (fuzzy en discovery) y vía `aprenderAlias()` invocado desde el
// worker tras capturas exitosas que exponen los nombres del candidato
// (Lote V.7). El primer mes en producción debería resolver >90% de casos
// sin intervención del admin.

import { prisma } from "@habla/db";
import { logger } from "../logger";
import type { CasaCuotas } from "./types";
import {
  similitudEquipos,
  UMBRAL_FUZZY_DEFAULT,
  UMBRAL_FUZZY_BAJA_CONFIANZA,
} from "./fuzzy-match";

/**
 * Normaliza un nombre de equipo a su forma canónica de comparación.
 * Quita acentos, fuerza lowercase, colapsa espacios. NO toca puntuación
 * (ej. "U.T.C." sigue siendo "u.t.c." normalizado).
 *
 * Exportada también para que los scrapers la usen en match de listas
 * (filtrar partidos del JSON por nombre normalizado antes de pegar BD).
 */
export function normalizarNombreEquipo(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacríticos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Resuelve el nombre canónico de un alias usado por una casa específica.
 * Retorna `null` si no hay alias registrado — el caller debe decidir si
 * cae al match directo o asume "sin discovery".
 *
 * Prefiere el alias específico de la casa sobre el alias global (casa=null).
 * Si ambos existen, gana el específico.
 */
export async function resolverNombreCanonico(
  alias: string,
  casa: CasaCuotas,
): Promise<string | null> {
  const norm = normalizarNombreEquipo(alias);
  if (!norm) return null;

  // Buscamos las dos variantes con OR; en JS decidimos cuál gana.
  const filas = await prisma.aliasEquipo.findMany({
    where: {
      alias: norm,
      OR: [{ casa }, { casa: null }],
    },
    select: { casa: true, equipoCanonicoNombre: true },
  });
  if (filas.length === 0) return null;

  const especifica = filas.find((f) => f.casa === casa);
  return (especifica ?? filas[0]).equipoCanonicoNombre;
}

/**
 * Persiste un alias en `AliasEquipo` (Lote V.7 — auto-aprendizaje).
 *
 * Idempotente: el unique `(alias, casa)` evita duplicados; segundo
 * llamado actualiza `equipoCanonicoNombre` si cambió. Fire-and-forget en
 * los callers — no re-lanza errores; loggea y sigue.
 *
 * Reglas:
 *   - Normaliza el alias antes de persistir (single source of truth para
 *     futuros lookups).
 *   - Si el alias normalizado coincide con el canónico normalizado, NO
 *     persiste (no aporta información nueva).
 *   - Persiste con `casa = casa` (no global) — evita que un alias
 *     aprendido de Coolbet contamine Stake.
 */
export async function aprenderAlias(
  aliasRaw: string,
  casa: CasaCuotas,
  canonico: string,
): Promise<void> {
  const aliasNorm = normalizarNombreEquipo(aliasRaw);
  const canonNorm = normalizarNombreEquipo(canonico);
  if (!aliasNorm || !canonNorm) return;
  if (aliasNorm === canonNorm) return;

  try {
    await prisma.aliasEquipo.upsert({
      where: { alias_casa: { alias: aliasNorm, casa } },
      create: {
        alias: aliasNorm,
        casa,
        equipoCanonicoNombre: canonico,
      },
      update: {
        equipoCanonicoNombre: canonico,
      },
    });
    logger.info(
      {
        alias: aliasNorm,
        casa,
        canonico,
        source: "alias-equipo:aprender",
      },
      "alias aprendido y persistido",
    );
  } catch (err) {
    logger.warn(
      {
        alias: aliasNorm,
        casa,
        canonico,
        err: (err as Error)?.message,
        source: "alias-equipo:aprender",
      },
      "aprenderAlias — upsert falló (no crítico)",
    );
  }
}

/**
 * Compara los nombres de equipos del candidato (los que devolvió la API
 * de la casa) contra el `Partido` canónico. Devuelve true si los DOS
 * matchean — el orden local/visita debe ser el mismo (las casas peruanas
 * respetan home/away consistentemente con api-football, validado en POC).
 *
 * Estrategia (Lote V.7):
 *   1. Match directo normalizado. Si pega → true (sin BD).
 *   2. Resolver via AliasEquipo. Si pega → true.
 *   3. Fuzzy Jaro-Winkler con umbral configurable. Si pega → true +
 *      write-back fire-and-forget a AliasEquipo (auto-aprendizaje).
 *   4. Si nada pega → false.
 *
 * El write-back del paso 3 es crítico: evita que el mismo equipo dispare
 * fuzzy una y otra vez. Tras la primera resolución, el mismo nombre pega
 * en el paso 2 directamente.
 */
export async function matchearEquiposContraPartido(
  partido: { equipoLocal: string; equipoVisita: string },
  candidato: { local: string; visita: string },
  casa: CasaCuotas,
): Promise<boolean> {
  const targetLocal = normalizarNombreEquipo(partido.equipoLocal);
  const targetVisita = normalizarNombreEquipo(partido.equipoVisita);

  const candLocal = normalizarNombreEquipo(candidato.local);
  const candVisita = normalizarNombreEquipo(candidato.visita);

  // Paso 1 — match directo normalizado.
  if (candLocal === targetLocal && candVisita === targetVisita) {
    return true;
  }

  // Paso 2 — resolver aliases en paralelo.
  const [aliasLocal, aliasVisita] = await Promise.all([
    resolverNombreCanonico(candidato.local, casa),
    resolverNombreCanonico(candidato.visita, casa),
  ]);

  const resueltoLocal = aliasLocal
    ? normalizarNombreEquipo(aliasLocal)
    : candLocal;
  const resueltoVisita = aliasVisita
    ? normalizarNombreEquipo(aliasVisita)
    : candVisita;

  if (resueltoLocal === targetLocal && resueltoVisita === targetVisita) {
    return true;
  }

  // Paso 3 — fallback fuzzy Jaro-Winkler. Solo aplica si AMBOS lados
  // pegan por encima del umbral (no aceptamos un equipo exacto + un equipo
  // dudoso, sería ambiguo). El write-back se hace solo si el alias real
  // difiere del canónico.
  const scoreLocal = similitudEquipos(candidato.local, partido.equipoLocal);
  const scoreVisita = similitudEquipos(candidato.visita, partido.equipoVisita);
  const fuzzyOk =
    scoreLocal >= UMBRAL_FUZZY_DEFAULT && scoreVisita >= UMBRAL_FUZZY_DEFAULT;

  if (!fuzzyOk) return false;

  // Log de baja confianza para revisión manual durante las primeras
  // semanas. Encima del umbral de baja confianza, no loggeamos para
  // mantener el ruido bajo.
  if (
    scoreLocal < UMBRAL_FUZZY_BAJA_CONFIANZA ||
    scoreVisita < UMBRAL_FUZZY_BAJA_CONFIANZA
  ) {
    logger.info(
      {
        casa,
        partidoCanonico: `${partido.equipoLocal} vs ${partido.equipoVisita}`,
        candidatoCasa: `${candidato.local} vs ${candidato.visita}`,
        scoreLocal: Number(scoreLocal.toFixed(3)),
        scoreVisita: Number(scoreVisita.toFixed(3)),
        umbral: UMBRAL_FUZZY_DEFAULT,
        source: "alias-equipo:fuzzy",
      },
      "match fuzzy con baja confianza — revisar si es falso positivo",
    );
  }

  // Auto-aprendizaje: persistir aliases para que la próxima vuelta pegue
  // por exact-match. Fire-and-forget — un fallo de upsert no debe
  // contaminar el discovery en curso.
  void aprenderAlias(candidato.local, casa, partido.equipoLocal);
  void aprenderAlias(candidato.visita, casa, partido.equipoVisita);

  return true;
}

/**
 * Verifica que la fecha del candidato esté dentro de la ventana ±N min
 * respecto a la fecha del partido canónico. Sección 5.1 del plan: "filtra
 * por liga + fecha (±24h)" en discovery; cierre fino por partido es ±60min
 * (Te Apuesto muestra 18:00 cuando otras casas muestran 19:00 — diferencia
 * tipica menor a 1h).
 */
export function fechasCercanas(
  a: Date | string,
  b: Date | string,
  ventanaMin: number,
): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) <= ventanaMin * 60_000;
}
