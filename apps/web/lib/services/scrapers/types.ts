// Tipos compartidos del motor de captura de cuotas (Lote V.11 — May 2026).
//
// Reescritura completa del approach: ahora cada scraper hace fetch HTTP
// directo a la API B2B del proveedor de la casa (Altenar / Kambi /
// Coreix / Octonovus / Danae / propio Coolbet) en lugar de scrapeo via
// Playwright headless. Resultado: motor server-side puro, sin browser,
// con latencias <2s en lugar de 12-22s.
//
// Stake fue removido del motor en este lote — quedó como referencia en
// `scripts/validacion-geo/` por si en el futuro se reactiva con un
// approach específico (Playwright stealth en Railway o agente local).

import type { Partido } from "@habla/db";

/**
 * Casas peruanas cubiertas por el motor de captura. Lote V.11 reduce de
 * 7 a 6 casas (Stake removido). Cada casa tiene API HTTP directa
 * confirmada el 2026-05-05 desde Railway US sin geo-block.
 */
export const CASAS_CUOTAS = [
  "doradobet",
  "apuesta_total",
  "coolbet",
  "betano",
  "inkabet",
  "te_apuesto",
] as const;

export type CasaCuotas = (typeof CASAS_CUOTAS)[number];

export function esCasaCuotasValida(casa: string): casa is CasaCuotas {
  return (CASAS_CUOTAS as readonly string[]).includes(casa);
}

/**
 * Mercados que el motor captura. El orden de claves debe mantener paridad
 * con la sección 6.1 del plan ("interfaz uniforme").
 */
export type MercadoKey = "1x2" | "doble_op" | "mas_menos_25" | "btts";

export interface Cuotas1X2 {
  local: number;
  empate: number;
  visita: number;
}

export interface CuotasDobleOp {
  /** "1X" — local o empate. */
  x1: number;
  /** "12" — local o visita (no empate). */
  x12: number;
  /** "X2" — empate o visita. */
  xx2: number;
}

export interface CuotasMasMenos {
  over: number;
  under: number;
}

export interface CuotasBtts {
  si: number;
  no: number;
}

/**
 * Cuotas capturadas por un scraper para un partido. Cualquier mercado
 * puede venir undefined si la casa no lo expone para ese partido o si el
 * mercado está suspendido. Nunca number=0 ni NaN — un valor presente
 * implica cuota efectivamente disponible al público.
 */
export interface CuotasCapturadas {
  "1x2"?: Cuotas1X2;
  doble_op?: CuotasDobleOp;
  mas_menos_25?: CuotasMasMenos;
  btts?: CuotasBtts;
}

/**
 * Resultado completo de un ciclo de scraping. `fuente` permite trazar
 * desde dónde se leyó (URL del endpoint API) y cuándo, lo que alimenta
 * tanto el debug como la UI admin "última captura".
 *
 * Lote V.11: el campo `equipos` opcional sigue presente para que el
 * worker alimente `AliasEquipo` automáticamente cuando los nombres en
 * el JSON de la casa difieran del canónico de api-football.
 */
export interface ResultadoScraper {
  cuotas: CuotasCapturadas;
  fuente: { url: string; capturadoEn: Date };
  /** ID interno del evento en la casa (descubierto por el scraper al matchear). */
  eventIdCasa?: string;
  /** Nombres de equipos como la casa los publica. Alimenta AliasEquipo. */
  equipos?: { local: string; visita: string };
}

/**
 * Contrato uniforme del scraper. Cada casa expone un módulo que cumple
 * con esta interfaz y se registra en el dispatcher del worker.
 *
 * Lote V.11: único método `capturarPorApi`. Recibe el ID interno de la
 * liga en la casa (resuelto por `ligas-id-map.ts`). Si la liga no está
 * mapeada para esa casa, el orquestador NO encola job. Si el scraper
 * llega y no encuentra el partido, retorna null (no es ERROR técnico).
 * Si falla técnicamente (timeout, 5xx, JSON inválido), lanza Error.
 */
export interface Scraper {
  nombre: CasaCuotas;
  capturarPorApi(
    partido: Partido,
    ligaIdCasa: string,
  ): Promise<ResultadoScraper | null>;
}

/**
 * Payload que viaja por la cola BullMQ. Se serializa como JSON, así que
 * sólo primitivos + strings — nada de Date, Map, RegExp, etc.
 *
 * Lote V.11: `eventIdExterno` (legacy) reemplazado por `ligaIdCasa`
 * (ID interno de la liga en la casa, calculado por el mapeo).
 */
export interface CuotasJobData {
  partidoId: string;
  casa: CasaCuotas;
  ligaIdCasa: string;
  /** true si viene del cron diario, false si es trigger admin (Filtro 1 ON). */
  esRefresh: boolean;
}

/**
 * Estados de captura agregados a nivel partido. Reflejan el state
 * machine documentado en sección 4 del plan.
 */
export type EstadoCapturaPartido =
  | "INACTIVA"
  | "INICIANDO"
  | "PARCIAL"
  | "COMPLETA"
  | "DETENIDA"
  | "FALLIDA";

/**
 * Estados de captura por casa que viven en la fila de `cuotas_casa`.
 * Más granular que `EstadoCapturaPartido` — el de partido se calcula
 * agregando los 6 estados por casa.
 */
export type EstadoCuotasCasa =
  | "OK"
  | "STALE"
  | "ERROR"
  | "BLOQUEADO"
  | "SIN_DATOS";

/**
 * Mercado en el formato que persiste `AlertaCuota.mercado`.
 */
export type MercadoAlerta = "1X2" | "DOBLE_OP" | "MAS_MENOS_25" | "BTTS";

export type SeleccionAlerta =
  | "local"
  | "empate"
  | "visita"
  | "1x"
  | "12"
  | "x2"
  | "over25"
  | "under25"
  | "btts_si"
  | "btts_no";

/**
 * Señal que un scraper emite cuando la casa no expone cuotas de la
 * variante canónica para ese partido en ese momento. El worker la
 * detecta y persiste la fila con `estado = "SIN_DATOS"` SIN penalizar
 * `SaludScraper` y SIN re-throwear (no hay retry de BullMQ).
 */
export class CapturaSinDatosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapturaSinDatosError";
  }
}

/**
 * Lista canónica de los 4 mercados que el motor exige para considerar
 * una captura "completa" (Lote V.12.3 — May 2026).
 *
 * Decisión del producto: NO mostrar cuotas parciales en la UI admin —
 * un partido con 3/4 mercados se ve incompleto y rompe el comparador.
 * Si una casa no expone alguno de estos 4, persistimos como SIN_DATOS
 * (no penaliza salud del scraper) hasta que el parser se ajuste.
 */
export const MERCADOS_REQUERIDOS: readonly MercadoKey[] = [
  "1x2",
  "doble_op",
  "mas_menos_25",
  "btts",
];

/**
 * Devuelve los mercados faltantes para considerar la captura completa.
 * Array vacío significa "todos los mercados presentes".
 */
export function mercadosFaltantes(cuotas: CuotasCapturadas): MercadoKey[] {
  return MERCADOS_REQUERIDOS.filter((m) => !cuotas[m]);
}
