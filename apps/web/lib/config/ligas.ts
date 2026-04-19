// Config de ligas whitelisteadas para el auto-import de partidos.
//
// El job periódico (apps/web/instrumentation.ts) recorre esta lista cada
// 6h y para cada liga:
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

export type LigaConfig = {
  apiFootballId: number;
  nombre: string; /* se guarda en Partido.liga — fuente de verdad del nombre */
  tipoTorneo: "EXPRESS" | "ESTANDAR" | "PREMIUM" | "GRAN_TORNEO";
  entradaLukas: number; /* entrada por ticket del torneo auto-creado */
};

export const LIGAS_ACTIVAS: LigaConfig[] = [
  { apiFootballId: 281, nombre: "Liga 1 Perú",       tipoTorneo: "EXPRESS",  entradaLukas: 5 },
  { apiFootballId: 2,   nombre: "Champions League",  tipoTorneo: "ESTANDAR", entradaLukas: 10 },
  { apiFootballId: 13,  nombre: "Copa Libertadores", tipoTorneo: "ESTANDAR", entradaLukas: 10 },
  { apiFootballId: 39,  nombre: "Premier League",    tipoTorneo: "EXPRESS",  entradaLukas: 5 },
  { apiFootballId: 140, nombre: "La Liga",           tipoTorneo: "EXPRESS",  entradaLukas: 5 },
  { apiFootballId: 1,   nombre: "Mundial 2026",      tipoTorneo: "PREMIUM",  entradaLukas: 30 },
];

export const DIAS_VENTANA_IMPORT = 14;
export const INTERVALO_IMPORT_MS = 6 * 60 * 60 * 1000; /* 6h */
export const INTERVALO_REFRESH_SEASONS_MS = 24 * 60 * 60 * 1000; /* 24h */
