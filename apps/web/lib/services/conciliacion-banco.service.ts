// Servicio de conciliación bancaria — Lote 8.
//
// Tras cargar un extracto, intenta matchear cada `MovimientoBancoReal` no
// conciliado con un `MovimientoBancoEsperado` no conciliado. Match cuando
// monto exacto + diferencia de fecha ≤ 3 días (settlement Culqi puede
// demorar). Si hay múltiples candidatos, deja sin conciliar para revisión
// manual.

import { prisma, Prisma } from "@habla/db";
import { logger } from "./logger";
import {
  parsearExtractoInterbank,
  type ParseResult,
} from "./extracto-interbank.parser";

const TOLERANCIA_DIAS = 3;
const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

export interface CargaResult {
  cargaId: string;
  filasTotales: number;
  filasInsertadas: number;
  filasDuplicadas: number;
  filasError: number;
  rangoFechaInicio: Date | null;
  rangoFechaFin: Date | null;
  conciliacionPostCarga: ConciliarResult;
  errores: ParseResult["errores"];
}

export interface ConciliarResult {
  intentados: number;
  conciliados: number;
  ambiguos: number;
  sinMatch: number;
}

export async function cargarExtractoCsv(
  archivoNombre: string,
  buf: Buffer,
): Promise<CargaResult> {
  const parse = parsearExtractoInterbank(buf);

  // Si >5% filas con error, abortamos sin insertar.
  const errPct =
    parse.filasTotales > 0
      ? parse.filasError / parse.filasTotales
      : parse.filasError > 0
        ? 1
        : 0;
  if (errPct > 0.05) {
    throw new Error(
      `Extracto inválido: ${parse.filasError}/${parse.filasTotales} filas con error (${Math.round(errPct * 100)}%). Revisar formato.`,
    );
  }

  const carga = await prisma.cargaExtractoBanco.create({
    data: {
      archivoNombre,
      filasTotales: parse.filasTotales,
      filasInsertadas: 0,
      filasDuplicadas: 0,
      filasError: parse.filasError,
      rangoFechaInicio: parse.rangoFechaInicio ?? new Date(),
      rangoFechaFin: parse.rangoFechaFin ?? new Date(),
    },
  });

  let insertadas = 0;
  let duplicadas = 0;
  for (const m of parse.movimientos) {
    try {
      await prisma.movimientoBancoReal.create({
        data: {
          fecha: m.fecha,
          monto: D(m.monto),
          descripcion: m.descripcion,
          referenciaBanco: m.referenciaBanco,
          cargaId: carga.id,
        },
      });
      insertadas++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Unique") || msg.includes("P2002")) {
        duplicadas++;
      } else {
        logger.error({ err }, "cargarExtractoCsv: insert real falló");
      }
    }
  }

  await prisma.cargaExtractoBanco.update({
    where: { id: carga.id },
    data: { filasInsertadas: insertadas, filasDuplicadas: duplicadas },
  });

  // Conciliar tras cada carga.
  const conciliacion = await conciliar();

  logger.info(
    { cargaId: carga.id, insertadas, duplicadas, ...conciliacion },
    "extracto cargado y conciliado",
  );

  return {
    cargaId: carga.id,
    filasTotales: parse.filasTotales,
    filasInsertadas: insertadas,
    filasDuplicadas: duplicadas,
    filasError: parse.filasError,
    rangoFechaInicio: parse.rangoFechaInicio,
    rangoFechaFin: parse.rangoFechaFin,
    conciliacionPostCarga: conciliacion,
    errores: parse.errores,
  };
}

export async function conciliar(): Promise<ConciliarResult> {
  const reales = await prisma.movimientoBancoReal.findMany({
    where: { esperados: { none: {} } },
    select: { id: true, fecha: true, monto: true },
  });

  const esperadosTodos = await prisma.movimientoBancoEsperado.findMany({
    where: { conciliadoConId: null },
    select: { id: true, fecha: true, monto: true },
  });

  let conciliados = 0;
  let ambiguos = 0;
  let sinMatch = 0;
  const usadosEsperados = new Set<string>();

  for (const real of reales) {
    const candidatos = esperadosTodos.filter((e) => {
      if (usadosEsperados.has(e.id)) return false;
      if (!e.monto.equals(real.monto)) return false;
      const diffMs = Math.abs(e.fecha.getTime() - real.fecha.getTime());
      const diffDias = diffMs / (1000 * 60 * 60 * 24);
      return diffDias <= TOLERANCIA_DIAS;
    });

    if (candidatos.length === 1) {
      const match = candidatos[0];
      await prisma.movimientoBancoEsperado.update({
        where: { id: match.id },
        data: { conciliadoConId: real.id, conciliadoEn: new Date() },
      });
      usadosEsperados.add(match.id);
      conciliados++;
    } else if (candidatos.length > 1) {
      ambiguos++;
    } else {
      sinMatch++;
    }
  }

  return {
    intentados: reales.length,
    conciliados,
    ambiguos,
    sinMatch,
  };
}

export async function conciliarManual(
  esperadoId: string,
  realId: string,
): Promise<{ ok: boolean }> {
  const [esp, real] = await Promise.all([
    prisma.movimientoBancoEsperado.findUnique({ where: { id: esperadoId } }),
    prisma.movimientoBancoReal.findUnique({ where: { id: realId } }),
  ]);
  if (!esp) throw new Error(`Esperado ${esperadoId} no existe`);
  if (!real) throw new Error(`Real ${realId} no existe`);
  if (esp.conciliadoConId) {
    throw new Error(`Esperado ${esperadoId} ya está conciliado`);
  }

  await prisma.movimientoBancoEsperado.update({
    where: { id: esperadoId },
    data: { conciliadoConId: realId, conciliadoEn: new Date() },
  });

  return { ok: true };
}
