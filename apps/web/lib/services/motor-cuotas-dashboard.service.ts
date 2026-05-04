// Servicio de lectura para el dashboard /admin/motor-cuotas (Lote V fase V.5).
//
// Centraliza las queries que alimentan tanto la vista server-side como el
// endpoint GET /api/v1/admin/motor-cuotas/salud. Cero side-effects: solo
// lecturas Prisma + introspección de la cola BullMQ.

import { prisma } from "@habla/db";
import { CUOTAS_CONFIG } from "../config/cuotas";
import { getCuotasQueue } from "./cuotas-cola";
import { logger } from "./logger";
import type { CasaCuotas } from "./scrapers/types";

export interface SaludScraperFila {
  casa: CasaCuotas;
  estado: "SANO" | "DEGRADADO" | "BLOQUEADO";
  ultimaEjecucion: Date | null;
  ultimoExito: Date | null;
  diasConsecutivosError: number;
  detalleError: string | null;
}

export interface MetricasMotor {
  partidosFiltro1Activo: number;
  partidosCompleta: number;
  partidosParcial: number;
  partidosFallida: number;
  cuotasVivas: number;
  cuotasEsperadas: number;
  alertasNoVistas: number;
}

export interface ColaInfo {
  enCola: number;
  enProceso: number;
  fallidos: number;
  completados: number;
  disponible: boolean;
}

export interface SaludMotorCuotasDashboard {
  scrapers: SaludScraperFila[];
  metricas: MetricasMotor;
  cola: ColaInfo;
  generadoEn: Date;
}

/**
 * Lista las 7 filas de SaludScraper en el orden canónico de
 * `CUOTAS_CONFIG.CASAS`. Si una fila no existe (seed faltante), la
 * sintetiza como SANO con fechas null para que la UI no rompa.
 */
async function obtenerSaludScrapers(): Promise<SaludScraperFila[]> {
  const filas = await prisma.saludScraper.findMany({
    where: { casa: { in: [...CUOTAS_CONFIG.CASAS] } },
  });
  const porCasa = new Map(filas.map((f) => [f.casa, f]));
  return CUOTAS_CONFIG.CASAS.map((casa) => {
    const f = porCasa.get(casa);
    if (!f) {
      return {
        casa,
        estado: "SANO" as const,
        ultimaEjecucion: null,
        ultimoExito: null,
        diasConsecutivosError: 0,
        detalleError: null,
      };
    }
    const estado: "SANO" | "DEGRADADO" | "BLOQUEADO" =
      f.estado === "BLOQUEADO"
        ? "BLOQUEADO"
        : f.estado === "DEGRADADO"
          ? "DEGRADADO"
          : "SANO";
    return {
      casa,
      estado,
      ultimaEjecucion: f.ultimaEjecucion,
      ultimoExito: f.ultimoExito,
      diasConsecutivosError: f.diasConsecutivosError,
      detalleError: f.detalleError,
    };
  });
}

async function obtenerMetricasGlobales(): Promise<MetricasMotor> {
  const ahora = new Date();
  const [filtro1, partidosCompleta, partidosParcial, partidosFallida, cuotasVivas, alertasNoVistas] =
    await Promise.all([
      prisma.partido.count({
        where: {
          mostrarAlPublico: true,
          estado: "PROGRAMADO",
          fechaInicio: { gte: ahora },
        },
      }),
      prisma.partido.count({
        where: {
          mostrarAlPublico: true,
          estado: "PROGRAMADO",
          fechaInicio: { gte: ahora },
          estadoCaptura: "COMPLETA",
        },
      }),
      prisma.partido.count({
        where: {
          mostrarAlPublico: true,
          estado: "PROGRAMADO",
          fechaInicio: { gte: ahora },
          estadoCaptura: "PARCIAL",
        },
      }),
      prisma.partido.count({
        where: {
          mostrarAlPublico: true,
          estado: "PROGRAMADO",
          fechaInicio: { gte: ahora },
          estadoCaptura: "FALLIDA",
        },
      }),
      prisma.cuotasCasa.count({
        where: {
          estado: { in: ["OK", "STALE"] },
          partido: {
            mostrarAlPublico: true,
            estado: "PROGRAMADO",
            fechaInicio: { gte: ahora },
          },
        },
      }),
      prisma.alertaCuota.count({ where: { vistaPorAdmin: false } }),
    ]);

  return {
    partidosFiltro1Activo: filtro1,
    partidosCompleta,
    partidosParcial,
    partidosFallida,
    cuotasVivas,
    cuotasEsperadas: filtro1 * CUOTAS_CONFIG.CASAS.length,
    alertasNoVistas,
  };
}

async function obtenerColaInfo(): Promise<ColaInfo> {
  const queue = getCuotasQueue();
  if (!queue) {
    return {
      enCola: 0,
      enProceso: 0,
      fallidos: 0,
      completados: 0,
      disponible: false,
    };
  }
  try {
    const counts = await queue.getJobCounts(
      "wait",
      "waiting",
      "delayed",
      "active",
      "failed",
      "completed",
    );
    const enCola =
      (counts.wait ?? 0) + (counts.waiting ?? 0) + (counts.delayed ?? 0);
    return {
      enCola,
      enProceso: counts.active ?? 0,
      fallidos: counts.failed ?? 0,
      completados: counts.completed ?? 0,
      disponible: true,
    };
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: "motor-cuotas-dashboard" },
      "fallo al leer counts de BullMQ",
    );
    return {
      enCola: 0,
      enProceso: 0,
      fallidos: 0,
      completados: 0,
      disponible: false,
    };
  }
}

export async function obtenerSaludMotor(): Promise<SaludMotorCuotasDashboard> {
  const [scrapers, metricas, cola] = await Promise.all([
    obtenerSaludScrapers(),
    obtenerMetricasGlobales(),
    obtenerColaInfo(),
  ]);
  return {
    scrapers,
    metricas,
    cola,
    generadoEn: new Date(),
  };
}
