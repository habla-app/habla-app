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
// Estrategia de match:
//   1. Normalización: NFD + lowercase + trim + colapsar espacios.
//   2. Match directo normalizado contra el canónico del partido. Si pega,
//      no consultamos BD (caso optimista — la mayoría de casas usa el
//      mismo nombre que api-football).
//   3. Si no pega directo, consultamos `AliasEquipo` con
//      `OR: [{ alias, casa }, { alias, casa: null }]` (la fila específica
//      para la casa gana sobre la global, en caso de duplicados).
//
// La tabla `AliasEquipo` no garantiza completitud — el primer mes en
// producción habrá nombres no resueltos. La sección 9.2 del plan habilita
// el fallback manual: el admin pega la URL del partido y bypassea el
// matching automático. La tabla crece con cada vinculación manual que
// expone un alias nuevo.

import { prisma } from "@habla/db";
import type { CasaCuotas } from "./types";

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
 * Compara los nombres de equipos del candidato (los que devolvió la API
 * de la casa) contra el `Partido` canónico. Devuelve true si los DOS
 * matchean — el orden local/visita debe ser el mismo (las casas peruanas
 * respetan home/away consistentemente con api-football, validado en POC).
 *
 * Hace primero el match directo normalizado para ahorrar DB. Si no pega,
 * resuelve aliases.
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

  if (candLocal === targetLocal && candVisita === targetVisita) {
    return true;
  }

  // Resolver aliases en paralelo.
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

  return resueltoLocal === targetLocal && resueltoVisita === targetVisita;
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
