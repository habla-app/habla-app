// Persistencia de cuotas + detección de alertas (Lote V).
//
// Responsable de tomar el resultado de un scraper y:
//   1. Mapear el `CuotasCapturadas` (formato del scraper) al shape de la
//      tabla `cuotas_casa` (Decimal? por mercado/selección).
//   2. Comparar contra la fila anterior y emitir alertas cuando alguna
//      selección movió ≥ UMBRAL_VARIACION_ALERTA_PCT (5%).
//   3. Upsertar la fila preservando `cuotaXxxAnterior` con el valor previo
//      de `cuotaXxx` (rotación A→Anterior, B→A) para que el próximo ciclo
//      vea el "antes" correcto.
//
// La función `actualizarSaludScraper` también vive acá porque es parte
// del mismo flujo de persistencia (cada éxito/error mueve estado por casa).
//
// Decisiones cubiertas (sección 8 del plan):
//   §8.1 — upsert con rotación A→Anterior
//   §8.2 — UMBRAL_VARIACION_ALERTA_PCT = 5 (config/cuotas.ts)
//   §8.3 — detectarAlertas con 10 selecciones (3 + 3 + 2 + 2)
//
// IMPORTANTE: este módulo NO conoce el motor BullMQ ni los scrapers
// concretos. Recibe `ResultadoScraper` y partidoId/casa, devuelve void.
// El worker es el único que orquesta scraper → persistencia → salud.

import { Prisma, prisma } from "@habla/db";
import type { CuotasCasa } from "@habla/db";
import type { Decimal } from "@prisma/client/runtime/library";
import { CUOTAS_CONFIG } from "../config/cuotas";
import { logger } from "./logger";
import type {
  CasaCuotas,
  EstadoCuotasCasa,
  MercadoAlerta,
  ResultadoScraper,
  SeleccionAlerta,
} from "./scrapers/types";

/**
 * Campos `Decimal?` de `cuotas_casa` que representan la cuota actual de
 * una selección (sin contraparte `*Anterior`). El `as const` los preserva
 * como literales para que TypeScript chequee tipados.
 */
const CAMPOS_CUOTA_ACTUAL = [
  "cuotaLocal",
  "cuotaEmpate",
  "cuotaVisita",
  "cuota1X",
  "cuota12",
  "cuotaX2",
  "cuotaOver25",
  "cuotaUnder25",
  "cuotaBttsSi",
  "cuotaBttsNo",
] as const;

type CampoCuotaActual = (typeof CAMPOS_CUOTA_ACTUAL)[number];

/** Tabla de mapeo: campo "actual" → campo "anterior". */
const CAMPO_ANTERIOR: Record<CampoCuotaActual, string> = {
  cuotaLocal: "cuotaLocalAnterior",
  cuotaEmpate: "cuotaEmpateAnterior",
  cuotaVisita: "cuotaVisitaAnterior",
  cuota1X: "cuota1XAnterior",
  cuota12: "cuota12Anterior",
  cuotaX2: "cuotaX2Anterior",
  cuotaOver25: "cuotaOver25Anterior",
  cuotaUnder25: "cuotaUnder25Anterior",
  cuotaBttsSi: "cuotaBttsSiAnterior",
  cuotaBttsNo: "cuotaBttsNoAnterior",
};

/** Tabla de mapeo para detectarAlertas: campo BD → mercado/selección legibles. */
interface MapeoAlerta {
  field: CampoCuotaActual;
  mercado: MercadoAlerta;
  seleccion: SeleccionAlerta;
}

const MAPEO_ALERTAS: readonly MapeoAlerta[] = [
  { field: "cuotaLocal", mercado: "1X2", seleccion: "local" },
  { field: "cuotaEmpate", mercado: "1X2", seleccion: "empate" },
  { field: "cuotaVisita", mercado: "1X2", seleccion: "visita" },
  { field: "cuota1X", mercado: "DOBLE_OP", seleccion: "1x" },
  { field: "cuota12", mercado: "DOBLE_OP", seleccion: "12" },
  { field: "cuotaX2", mercado: "DOBLE_OP", seleccion: "x2" },
  { field: "cuotaOver25", mercado: "MAS_MENOS_25", seleccion: "over25" },
  { field: "cuotaUnder25", mercado: "MAS_MENOS_25", seleccion: "under25" },
  { field: "cuotaBttsSi", mercado: "BTTS", seleccion: "btts_si" },
  { field: "cuotaBttsNo", mercado: "BTTS", seleccion: "btts_no" },
];

/**
 * Convierte `ResultadoScraper.cuotas` al shape plano de `cuotas_casa`.
 * Cualquier mercado/selección no presente queda como `undefined` (lo que
 * Prisma interpreta como "no setear", manteniendo el valor anterior si
 * existía o NULL si no).
 */
type CuotasPlanas = Partial<Record<CampoCuotaActual, number>>;

export function mapearACuotasPlanas(resultado: ResultadoScraper): CuotasPlanas {
  const out: CuotasPlanas = {};
  const c = resultado.cuotas;

  if (c["1x2"]) {
    out.cuotaLocal = c["1x2"].local;
    out.cuotaEmpate = c["1x2"].empate;
    out.cuotaVisita = c["1x2"].visita;
  }
  if (c.doble_op) {
    out.cuota1X = c.doble_op.x1;
    out.cuota12 = c.doble_op.x12;
    out.cuotaX2 = c.doble_op.xx2;
  }
  if (c.mas_menos_25) {
    out.cuotaOver25 = c.mas_menos_25.over;
    out.cuotaUnder25 = c.mas_menos_25.under;
  }
  if (c.btts) {
    out.cuotaBttsSi = c.btts.si;
    out.cuotaBttsNo = c.btts.no;
  }

  return out;
}

/** Convierte Decimal/number a number sin perder precisión. Null si null. */
function decimalAnumber(v: Decimal | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  // Decimal de Prisma expone toNumber()
  return v.toNumber();
}

/**
 * Genera el array de alertas. Compara cada uno de los 10 campos comparables
 * entre la fila anterior (la que ya estaba en BD) y los nuevos valores
 * planos. Sólo emite si:
 *   - hay valor previo Y valor nuevo (no se alerta de "apareció" o "desapareció")
 *   - |variación %| ≥ UMBRAL_VARIACION_ALERTA_PCT
 *
 * Devuelve el shape exacto que `prisma.alertaCuota.createMany` espera.
 */
export function detectarAlertas(
  anterior: CuotasCasa | null,
  nuevasPlanas: CuotasPlanas,
  partidoId: string,
  casa: CasaCuotas,
): Prisma.AlertaCuotaCreateManyInput[] {
  if (!anterior) return [];

  const alertas: Prisma.AlertaCuotaCreateManyInput[] = [];
  const umbral = CUOTAS_CONFIG.UMBRAL_VARIACION_ALERTA_PCT;

  for (const { field, mercado, seleccion } of MAPEO_ALERTAS) {
    const ant = decimalAnumber(anterior[field] as Decimal | null);
    const nuevoRaw = nuevasPlanas[field];
    if (ant === null || ant === 0) continue;
    if (nuevoRaw === undefined || nuevoRaw === null) continue;

    const variacionPct = ((nuevoRaw - ant) / ant) * 100;
    if (Math.abs(variacionPct) >= umbral) {
      alertas.push({
        partidoId,
        casa,
        mercado,
        seleccion,
        cuotaAnterior: new Prisma.Decimal(ant),
        cuotaNueva: new Prisma.Decimal(nuevoRaw),
        // Math.round preserva tres decimales como en `Decimal(7,3)`.
        variacionPct: new Prisma.Decimal(Math.round(variacionPct * 1000) / 1000),
      });
    }
  }

  return alertas;
}

/**
 * Persiste el resultado del scraper en `cuotas_casa` con upsert. Rotación
 * A→Anterior es manual: `cuotaXxxAnterior = anterior?.cuotaXxx` antes de
 * sobrescribir `cuotaXxx` con el nuevo valor.
 *
 * Si una selección no viene en `nuevasPlanas`, mantiene el valor previo
 * (no lo borra) — esto cubre el caso "scraper devolvió 1X2 pero no BTTS"
 * sin borrar BTTS de la fila.
 *
 * Genera alertas si las hay e inserta en la misma transacción.
 */
export async function persistirCuotas(params: {
  partidoId: string;
  casa: CasaCuotas;
  eventIdExterno: string;
  resultado: ResultadoScraper;
}): Promise<{ alertasCreadas: number }> {
  const { partidoId, casa, eventIdExterno, resultado } = params;

  const anterior = await prisma.cuotasCasa.findUnique({
    where: { partidoId_casa: { partidoId, casa } },
  });

  const nuevasPlanas = mapearACuotasPlanas(resultado);
  const alertas = detectarAlertas(anterior, nuevasPlanas, partidoId, casa);

  // Build payloads de update y create por separado. Update rotates a→Anterior;
  // create sólo setea las nuevas (sin Anterior porque no había historial).
  const ahora = new Date();

  const updateData: Prisma.CuotasCasaUpdateInput = {
    estado: "OK",
    eventIdExterno,
    ultimoIntento: ahora,
    ultimoExito: ahora,
    capturadoEn: ahora,
    intentosFallidos: 0,
    errorMensaje: null,
  };

  for (const campoActual of CAMPOS_CUOTA_ACTUAL) {
    const previo = anterior ? (anterior[campoActual] as Decimal | null) : null;
    const nuevoRaw = nuevasPlanas[campoActual];
    const campoAnterior = CAMPO_ANTERIOR[campoActual] as keyof Prisma.CuotasCasaUpdateInput;

    // Rotamos siempre el "anterior" al valor previo (sea null o número),
    // para que el siguiente ciclo vea correctamente el "antes" — incluso
    // si en este ciclo no hay nuevo valor (campo undefined no actualiza
    // `cuotaXxx` pero igual mueve `cuotaXxxAnterior` al previo).
    if (previo !== null) {
      (updateData[campoAnterior] as unknown) = previo;
    } else {
      (updateData[campoAnterior] as unknown) = null;
    }

    if (nuevoRaw !== undefined) {
      (updateData[campoActual as keyof Prisma.CuotasCasaUpdateInput] as unknown) =
        new Prisma.Decimal(nuevoRaw);
    }
  }

  const createData: Prisma.CuotasCasaCreateInput = {
    partido: { connect: { id: partidoId } },
    casa,
    eventIdExterno,
    estado: "OK",
    ultimoIntento: ahora,
    ultimoExito: ahora,
    capturadoEn: ahora,
    intentosFallidos: 0,
  };
  for (const campoActual of CAMPOS_CUOTA_ACTUAL) {
    const nuevoRaw = nuevasPlanas[campoActual];
    if (nuevoRaw !== undefined) {
      (createData[campoActual as keyof Prisma.CuotasCasaCreateInput] as unknown) =
        new Prisma.Decimal(nuevoRaw);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.cuotasCasa.upsert({
      where: { partidoId_casa: { partidoId, casa } },
      create: createData,
      update: updateData,
    });
    if (alertas.length > 0) {
      await tx.alertaCuota.createMany({ data: alertas });
    }
  });

  return { alertasCreadas: alertas.length };
}

/**
 * Marca el resultado de un intento fallido en `cuotas_casa`. No rota
 * cuotas (no hay nuevas), incrementa `intentosFallidos` y registra el
 * mensaje. El `estado` final se decide acá:
 *   - si la fila no existía → estado = "ERROR" (primer fallo)
 *   - si tenía `ultimoExito` < umbral STALE → estado = "STALE"
 *   - sino → estado = "ERROR"
 */
export async function persistirError(params: {
  partidoId: string;
  casa: CasaCuotas;
  eventIdExterno: string;
  errorMensaje: string;
}): Promise<void> {
  const { partidoId, casa, eventIdExterno, errorMensaje } = params;
  const anterior = await prisma.cuotasCasa.findUnique({
    where: { partidoId_casa: { partidoId, casa } },
  });

  const ahora = new Date();
  let estadoFinal: EstadoCuotasCasa;
  if (!anterior) {
    estadoFinal = "ERROR";
  } else if (anterior.ultimoExito) {
    const horasDesdeOk =
      (ahora.getTime() - anterior.ultimoExito.getTime()) / (60 * 60 * 1000);
    estadoFinal =
      horasDesdeOk >= CUOTAS_CONFIG.STALE_DESPUES_DE_HORAS ? "STALE" : "ERROR";
  } else {
    estadoFinal = "ERROR";
  }

  await prisma.cuotasCasa.upsert({
    where: { partidoId_casa: { partidoId, casa } },
    create: {
      partido: { connect: { id: partidoId } },
      casa,
      eventIdExterno,
      estado: estadoFinal,
      ultimoIntento: ahora,
      errorMensaje: errorMensaje.slice(0, 500),
      intentosFallidos: 1,
    },
    update: {
      estado: estadoFinal,
      ultimoIntento: ahora,
      errorMensaje: errorMensaje.slice(0, 500),
      intentosFallidos: { increment: 1 },
    },
  });
}

/**
 * Mueve estado de `salud_scrapers` para una casa. Llama a esta función
 * desde el worker tras cada job. La transición a BLOQUEADO ocurre cuando
 * `diasConsecutivosError >= BLOQUEADO_TRAS_DIAS_ERROR`.
 *
 * `diasConsecutivosError` se cuenta como "días" porque el cron es diario;
 * cada job no-OK incrementa, cada job OK lo resetea a 0.
 */
export async function actualizarSaludScraper(
  casa: CasaCuotas,
  resultado: "OK" | "ERROR",
  detalleError?: string,
): Promise<void> {
  const ahora = new Date();

  if (resultado === "OK") {
    await prisma.saludScraper.update({
      where: { casa },
      data: {
        estado: "SANO",
        ultimaEjecucion: ahora,
        ultimoExito: ahora,
        diasConsecutivosError: 0,
        detalleError: null,
      },
    });
    return;
  }

  // ERROR: incrementar contador, recalcular estado.
  const actual = await prisma.saludScraper.findUnique({ where: { casa } });
  const nuevoConteo = (actual?.diasConsecutivosError ?? 0) + 1;
  const nuevoEstado =
    nuevoConteo >= CUOTAS_CONFIG.BLOQUEADO_TRAS_DIAS_ERROR
      ? "BLOQUEADO"
      : "DEGRADADO";

  await prisma.saludScraper.upsert({
    where: { casa },
    create: {
      casa,
      estado: nuevoEstado,
      ultimaEjecucion: ahora,
      diasConsecutivosError: nuevoConteo,
      detalleError: detalleError?.slice(0, 500) ?? null,
    },
    update: {
      estado: nuevoEstado,
      ultimaEjecucion: ahora,
      diasConsecutivosError: nuevoConteo,
      detalleError: detalleError?.slice(0, 500) ?? null,
    },
  });

  if (nuevoEstado === "BLOQUEADO") {
    logger.warn(
      { casa, diasConsecutivosError: nuevoConteo, source: "cuotas-persistencia" },
      "scraper bloqueado tras N días con error consecutivo",
    );
  }
}

/**
 * Recalcula y persiste `partidos.estadoCaptura` y `partidos.ultimaCapturaEn`
 * agregando los estados de las 7 filas de `cuotas_casa`. Llamado por el
 * orquestador después de cada batch.
 */
export async function recalcularEstadoCapturaPartido(partidoId: string): Promise<void> {
  const filas = await prisma.cuotasCasa.findMany({
    where: { partidoId },
    select: { estado: true, ultimoExito: true },
  });

  const total = CUOTAS_CONFIG.CASAS.length;
  if (filas.length === 0) {
    await prisma.partido.update({
      where: { id: partidoId },
      data: { estadoCaptura: "INICIANDO" },
    });
    return;
  }

  const oks = filas.filter((f) => f.estado === "OK").length;
  let estadoCaptura: string;
  if (oks === total) estadoCaptura = "COMPLETA";
  else if (oks === 0) estadoCaptura = "FALLIDA";
  else estadoCaptura = "PARCIAL";

  const ultimaCapturaEn = filas
    .map((f) => f.ultimoExito)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  await prisma.partido.update({
    where: { id: partidoId },
    data: { estadoCaptura, ultimaCapturaEn: ultimaCapturaEn ?? undefined },
  });
}
