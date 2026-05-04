// Tipos compartidos del motor de captura de cuotas (Lote V).
//
// Define la interfaz uniforme que cada scraper de casa debe implementar
// y la forma del payload que devuelven al worker. Toda la jerarquía está
// optimizada para el shape de la tabla `cuotas_casa` (sección 8.1 del
// plan): un partido tiene 4 mercados, cada mercado 2-3 selecciones.
//
// Ningún scraper se implementa todavía en V.1 — los scrapers concretos
// llegan en V.2 (Te Apuesto + Stake + Altenar), V.3 (Coolbet + Inkabet)
// y V.4 (Betano dual). Este archivo deja los tipos disponibles para que
// el worker base y el orquestador compilen sin un `any` de por medio.

import type { Partido } from "@habla/db";

/**
 * Casas peruanas cubiertas por el motor de captura. Usar como union literal
 * para forzar compile-time check de "casa válida" en switches y maps.
 */
export const CASAS_CUOTAS = [
  "stake",
  "apuesta_total",
  "coolbet",
  "doradobet",
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
 * desde dónde se leyó (URL del endpoint o de la página) y cuándo, lo
 * que alimenta tanto el debug como la UI admin "última captura".
 */
export interface ResultadoScraper {
  cuotas: CuotasCapturadas;
  fuente: { url: string; capturadoEn: Date };
}

/**
 * Contrato uniforme del scraper. Cada casa expone un módulo que cumple
 * con esta interfaz y se registra en el dispatcher del worker.
 *
 * - `nombre`: clave canónica de la casa (debe coincidir con CasaCuotas).
 * - `buscarEventIdExterno`: discovery automático (sección 5.1 del plan).
 *   Devuelve `null` cuando no encuentra match único — la casa queda
 *   pendiente de vinculación manual via la vista admin.
 * - `capturarCuotas`: dado un eventId resuelto, devuelve los 4 mercados
 *   (los que la casa sirva). Lanza Error si el endpoint falla o si la
 *   respuesta no se puede parsear — el worker traduce eso a `estado="ERROR"`.
 */
export interface Scraper {
  nombre: CasaCuotas;
  buscarEventIdExterno(partido: Partido): Promise<string | null>;
  capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper>;
}

/**
 * Payload que viaja por la cola BullMQ. Se serializa como JSON, así que
 * sólo primitivos + strings — nada de Date, Map, RegExp, etc.
 */
export interface CuotasJobData {
  partidoId: string;
  casa: CasaCuotas;
  eventIdExterno: string;
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
 * agregando los 7 estados por casa.
 */
export type EstadoCuotasCasa =
  | "OK"
  | "STALE"
  | "ERROR"
  | "BLOQUEADO"
  | "SIN_DATOS";

/**
 * Mercado en el formato que persiste `AlertaCuota.mercado`. Ortogonal a
 * `MercadoKey` (que usa la convención del scraper) — la tabla `alertas_cuota`
 * usa esta convención más legible.
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
 * Señal que un scraper emite cuando la casa no expone cuotas de la variante
 * canónica para ese partido en ese momento (ej. Inkabet con la variante
 * regular suspendida y sólo "Pago Anticipado" disponible — V.3).
 *
 * El worker la detecta y persiste la fila con `estado = "SIN_DATOS"`
 * SIN penalizar `SaludScraper` y SIN re-throwear (no hay retry de BullMQ).
 * El próximo ciclo del cron 24h reintenta naturalmente.
 *
 * Distinto de `Error` genérico: una falla de red o un endpoint caído deben
 * seguir siendo `Error` regular para que disparen retry y bajen salud.
 */
export class CapturaSinDatosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapturaSinDatosError";
  }
}
