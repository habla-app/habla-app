// Catálogo de ligas/competiciones soportadas (Lote 5 — Plan v6 §4.4).
//
// 19 ligas/competiciones. El job periódico (apps/web/instrumentation.ts)
// recorre `LIGAS_ACTIVAS` cada 6h y para cada liga:
//   1. Resuelve la temporada activa dinámicamente (nunca hardcodeada por
//      año — la obtenemos de /leagues?current=true).
//   2. Descarga los fixtures de hoy a hoy+14d.
//   3. Upsertea los partidos (unique por externalId).
//   4. Crea el torneo asociado si aún no existe (regla dura).
//
// IDs de liga: https://www.api-football.com/documentation-v3#tag/Leagues
//
// Agregar una liga = agregar una entrada acá. El import automático la
// recoge en la siguiente corrida, y el admin puede forzar con
// POST /api/v1/admin/partidos/importar.
//
// Lote 2 (Abr 2026): el campo `tipoTorneo` queda como etiqueta informativa
// (afecta sólo el badge visual). El sistema de Lukas se demolió y las
// inscripciones a torneos son gratuitas.
//
// Lote 5 (Plan v6 §4.4): ampliación a 19 ligas. Campos nuevos:
//   - slug: identificador URL (?liga=premier).
//   - chipLabel: etiqueta corta para el filtro de UI.
//   - categoria: para targeting de bots de marketing en Lote 10. Cuatro
//     valores; ver `LigaCategoria` abajo.
//   - prioridadDisplay: orden estable en filtros y sidebar (ascendente).
//   - activa: si false, el auto-import la salta sin borrarla del catálogo.
//
// Cobertura api-football validada Abr 2026: las 19 ligas existen y tienen
// `current=true` en /leagues. 15 están en temporada con fixtures futuros;
// 4 están en off-season hasta su próxima edición (Copa América 2027,
// Eurocopa 2028, Mundial de Clubes 2029, Eliminatorias CONMEBOL 2030).
// El poller las consulta igual — devuelve 0 fixtures hasta que api-football
// marque la nueva temporada como `current` y nuestra `seasons.cache` la
// recoja en el refresh de 24h.

/**
 * Categorías de liga para targeting de bots de marketing (Lote 10). Una
 * liga cae en exactamente una categoría; un bot apunta a usuarios cuyo
 * historial favorece cierta categoría.
 *
 *   - 'liga-1-peru': solo Liga 1 Perú.
 *   - 'liga-extranjera-top': top-5 europeas + Brasileirão + Argentina
 *      Primera (ligas locales de alto perfil internacional).
 *   - 'champions-clasicos-mundial-grupos': torneos de clubes
 *      internacionales (UCL/UEL/UECL/Libertadores/Sudamericana/Mundial
 *      Clubes) y Mundial fase de grupos.
 *   - 'etapas-finales': selecciones nacionales en torneos cumbre o
 *      definitorios (eliminatorias, Copa América, Eurocopa, Nations
 *      League, Final del Mundial).
 */
export type LigaCategoria =
  | "liga-1-peru"
  | "liga-extranjera-top"
  | "champions-clasicos-mundial-grupos"
  | "etapas-finales";

export type LigaConfig = {
  /** Identificador interno + slug de URL (?liga=premier). Inmutable. */
  slug: string;
  /** Nombre canónico que persistimos en Partido.liga. */
  nombre: string;
  /** Etiqueta corta para chips de filtro UI. */
  chipLabel: string;
  /** ID en api-football. */
  apiFootballId: number;
  /** Tipo (badge visual; Plan v6 — Lote 4: ya no afecta entrada/reglas). */
  tipoTorneo: "EXPRESS" | "ESTANDAR" | "PREMIUM" | "GRAN_TORNEO";
  /** Categoría para targeting de bots (Lote 10). */
  categoria: LigaCategoria;
  /** Orden estable para filtros y sidebar (ascendente). Liga 1 = 1. */
  prioridadDisplay: number;
  /** Si false, el auto-import la salta sin borrar la entrada. */
  activa: boolean;
};

/**
 * Catálogo completo de las 19 ligas. Sirve como fuente de verdad para:
 * auto-import, slugs de URL, chips de UI, y futuro targeting de bots.
 *
 * Para apagar temporalmente una liga del auto-import, marcar `activa: false`
 * en vez de borrar la entrada (preservar slug/categoría para historial).
 */
export const LIGAS: ReadonlyArray<LigaConfig> = [
  // ── 1. Liga local — siempre primera ──
  { slug: "liga-1-peru", nombre: "Liga 1 Perú", chipLabel: "Liga 1 Perú",
    apiFootballId: 281, tipoTorneo: "EXPRESS",
    categoria: "liga-1-peru", prioridadDisplay: 1, activa: true },

  // ── 2. El evento que justifica el lanzamiento ──
  { slug: "mundial", nombre: "Mundial 2026", chipLabel: "Mundial",
    apiFootballId: 1, tipoTorneo: "GRAN_TORNEO",
    categoria: "etapas-finales", prioridadDisplay: 2, activa: true },

  // ── 10-19: Top extranjeras (5 europeas + Brasil + Argentina) ──
  { slug: "premier", nombre: "Premier League", chipLabel: "Premier",
    apiFootballId: 39, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 10, activa: true },
  { slug: "la-liga", nombre: "La Liga", chipLabel: "La Liga",
    apiFootballId: 140, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 11, activa: true },
  { slug: "serie-a", nombre: "Serie A", chipLabel: "Serie A",
    apiFootballId: 135, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 12, activa: true },
  { slug: "bundesliga", nombre: "Bundesliga", chipLabel: "Bundesliga",
    apiFootballId: 78, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 13, activa: true },
  { slug: "ligue-1", nombre: "Ligue 1", chipLabel: "Ligue 1",
    apiFootballId: 61, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 14, activa: true },
  { slug: "brasileirao", nombre: "Brasileirão", chipLabel: "Brasileirão",
    apiFootballId: 71, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 15, activa: true },
  { slug: "argentina-primera", nombre: "Liga Profesional Argentina",
    chipLabel: "Argentina", apiFootballId: 128, tipoTorneo: "EXPRESS",
    categoria: "liga-extranjera-top", prioridadDisplay: 16, activa: true },

  // ── 20-29: Copas internacionales de clubes ──
  { slug: "champions", nombre: "Champions League", chipLabel: "Champions",
    apiFootballId: 2, tipoTorneo: "ESTANDAR",
    categoria: "champions-clasicos-mundial-grupos",
    prioridadDisplay: 20, activa: true },
  { slug: "europa-league", nombre: "Europa League", chipLabel: "Europa",
    apiFootballId: 3, tipoTorneo: "ESTANDAR",
    categoria: "champions-clasicos-mundial-grupos",
    prioridadDisplay: 21, activa: true },
  { slug: "conference-league", nombre: "Conference League",
    chipLabel: "Conference", apiFootballId: 848, tipoTorneo: "ESTANDAR",
    categoria: "champions-clasicos-mundial-grupos",
    prioridadDisplay: 22, activa: true },
  { slug: "libertadores", nombre: "Copa Libertadores",
    chipLabel: "Libertadores", apiFootballId: 13, tipoTorneo: "ESTANDAR",
    categoria: "champions-clasicos-mundial-grupos",
    prioridadDisplay: 23, activa: true },
  { slug: "sudamericana", nombre: "Copa Sudamericana",
    chipLabel: "Sudamericana", apiFootballId: 11, tipoTorneo: "ESTANDAR",
    categoria: "champions-clasicos-mundial-grupos",
    prioridadDisplay: 24, activa: true },
  // Mundial de Clubes — última edición jul-2025; próxima 2029. La dejamos
  // activa: el poller devuelve 0 fixtures hasta que api-football active
  // la temporada 2029. Sin pérdida operativa, sólo ~1 call/6h vacía.
  { slug: "mundial-clubes", nombre: "Mundial de Clubes",
    chipLabel: "Mundial Clubes", apiFootballId: 15, tipoTorneo: "PREMIUM",
    categoria: "champions-clasicos-mundial-grupos",
    prioridadDisplay: 25, activa: true },

  // ── 30-39: Selecciones nacionales (eliminatorias, copas) ──
  // Eliminatorias CONMEBOL — ciclo 2026 cerró sep-2025; ciclo 2030 aún
  // sin fixtures. Misma situación que Mundial Clubes: activa, 0 fixtures
  // hasta que api-football inicie la nueva temporada.
  { slug: "eliminatorias-conmebol", nombre: "Eliminatorias Sudamericanas",
    chipLabel: "Eliminatorias", apiFootballId: 34, tipoTorneo: "ESTANDAR",
    categoria: "etapas-finales", prioridadDisplay: 30, activa: true },
  // Copa América — última ed: 2024. Próxima: 2027.
  { slug: "copa-america", nombre: "Copa América", chipLabel: "Copa América",
    apiFootballId: 9, tipoTorneo: "PREMIUM",
    categoria: "etapas-finales", prioridadDisplay: 31, activa: true },
  // Eurocopa — última ed: 2024. Próxima: 2028.
  { slug: "eurocopa", nombre: "Eurocopa", chipLabel: "Eurocopa",
    apiFootballId: 4, tipoTorneo: "PREMIUM",
    categoria: "etapas-finales", prioridadDisplay: 32, activa: true },
  { slug: "nations-league", nombre: "UEFA Nations League",
    chipLabel: "Nations League", apiFootballId: 5, tipoTorneo: "ESTANDAR",
    categoria: "etapas-finales", prioridadDisplay: 33, activa: true },
];

/**
 * View derivada: ligas que el auto-import debe procesar. Se usa en
 * partidos-import.service.ts y seasons.cache.ts. Mantener este nombre
 * exportado para compat con código pre-Lote 5.
 */
export const LIGAS_ACTIVAS: ReadonlyArray<LigaConfig> = LIGAS.filter(
  (l) => l.activa,
);

export const DIAS_VENTANA_IMPORT = 14;
export const INTERVALO_IMPORT_MS = 6 * 60 * 60 * 1000; /* 6h */
export const INTERVALO_REFRESH_SEASONS_MS = 24 * 60 * 60 * 1000; /* 24h */
