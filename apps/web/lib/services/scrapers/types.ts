// Tipos compartidos del motor de captura de cuotas (Lote V.12 — May 2026).
//
// V.12 reemplaza el approach API-only de V.11 por scraping headless con
// browser real (Playwright + XHR intercept). Razón: las APIs B2B B2C de
// algunas casas (Doradobet, Apuesta Total, Inkabet) NO publican todos los
// mercados que la UI muestra — los frontend SPAs construyen URLs detalle
// que disparan XHRs adicionales con líneas alternativas. Cargar la URL
// listing/detalle en Chromium + interceptar las XHRs es la única forma
// confiable de capturar lo mismo que ve un usuario humano.
//
// 5 casas activas (Stake removido por aliases cortos no fuzzy-matcheables;
// Coolbet removido por WAF Imperva agresivo desde Railway US):
//   - doradobet (Altenar widget — click Shadow DOM al detalle)
//   - apuesta_total (Kambi — URL detalle derivada de SportName/RegionName)
//   - betano (Danae — listing trae 1 evento per-event)
//   - inkabet (Octonovus — slug-based double nav)
//   - te_apuesto (Coreix — listing único)

import type { Partido } from "@habla/db";
import type { LigaCanonica } from "./ligas-id-map";

/**
 * Casas peruanas cubiertas por el motor de captura. Lote V.12 reduce a 5
 * casas (Coolbet removido por WAF, Stake removido por aliases cortos).
 */
export const CASAS_CUOTAS = [
  "doradobet",
  "apuesta_total",
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
 * desde dónde se leyó (URL del JSON capturado) y cuándo, lo que alimenta
 * tanto el debug como la UI admin "última captura".
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
 * Lote V.12: único método `capturarConPlaywright`. Recibe el partido +
 * la liga canónica detectada (`detectarLigaCanonica(partido.liga)`).
 * El scraper resuelve la URL listing via `obtenerUrlListado(liga, casa)`,
 * abre la página en Chromium, intercepta XHRs JSON con cuotas, y parsea
 * los 4 mercados. Si no encuentra el partido, retorna null (no es ERROR
 * técnico). Si falla técnicamente (timeout, geo-block), lanza Error.
 */
export interface Scraper {
  nombre: CasaCuotas;
  capturarConPlaywright(
    partido: Partido,
    ligaCanonica: LigaCanonica,
  ): Promise<ResultadoScraper | null>;
}

/**
 * Payload que viaja por la cola BullMQ. Se serializa como JSON, así que
 * sólo primitivos + strings — nada de Date, Map, RegExp, etc.
 *
 * Lote V.12: `ligaCanonica` reemplaza a `ligaIdCasa`. El scraper resuelve
 * internamente la URL del listing, no necesitamos hardcodear IDs.
 */
export interface CuotasJobData {
  partidoId: string;
  casa: CasaCuotas;
  ligaCanonica: LigaCanonica;
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
 * agregando los 5 estados por casa.
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
 * una captura "completa".
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
