// Servicio de lectura para la sección "Captura de cuotas" del admin
// /admin/partidos/[id] (Lote V fase V.5).
//
// Consolida los 4 datasets que la vista necesita por partido:
//   - 7 filas CuotasCasa (una por casa, presentes o no)
//   - EventIdExterno por casa (si fue resuelto, manual o auto)
//   - Estado agregado del partido (COMPLETA/PARCIAL/FALLIDA/...)
//   - Conteo de alertas no vistas para ese partido
//
// Patrón: 1 query por concepto, ensamblado en JS. Cero N+1.

import { prisma } from "@habla/db";
import { CUOTAS_CONFIG } from "../config/cuotas";
import type { CasaCuotas, EstadoCuotasCasa } from "./scrapers/types";

export interface CuotasMercadoActual {
  cuotaLocal: number | null;
  cuotaLocalAnterior: number | null;
  cuotaEmpate: number | null;
  cuotaEmpateAnterior: number | null;
  cuotaVisita: number | null;
  cuotaVisitaAnterior: number | null;
  cuota1X: number | null;
  cuota1XAnterior: number | null;
  cuota12: number | null;
  cuota12Anterior: number | null;
  cuotaX2: number | null;
  cuotaX2Anterior: number | null;
  cuotaOver25: number | null;
  cuotaOver25Anterior: number | null;
  cuotaUnder25: number | null;
  cuotaUnder25Anterior: number | null;
  cuotaBttsSi: number | null;
  cuotaBttsSiAnterior: number | null;
  cuotaBttsNo: number | null;
  cuotaBttsNoAnterior: number | null;
}

export interface CapturaCuotasFila extends CuotasMercadoActual {
  casa: CasaCuotas;
  estado: EstadoCuotasCasa | null; // null si nunca se intentó
  ultimoIntento: Date | null;
  ultimoExito: Date | null;
  errorMensaje: string | null;
  intentosFallidos: number;
  capturadoEn: Date | null;

  eventIdExterno: string | null;
  metodoDiscovery: "AUTOMATICO" | "MANUAL" | null;
}

export interface CapturaCuotasPartido {
  partidoId: string;
  estadoCaptura:
    | "INACTIVA"
    | "INICIANDO"
    | "PARCIAL"
    | "COMPLETA"
    | "DETENIDA"
    | "FALLIDA";
  ultimaCapturaEn: Date | null;
  filtro1: boolean;
  alertasNoVistas: number;
  filas: CapturaCuotasFila[];
}

function dec(v: { toNumber(): number } | null | undefined): number | null {
  return v ? v.toNumber() : null;
}

/**
 * Devuelve el snapshot completo de captura para un partido. Si el partido
 * no tiene Filtro 1 activo, los datos se devuelven igual (puede haber
 * filas históricas que el admin quiera revisar).
 */
export async function obtenerCapturaCuotasPartido(
  partidoId: string,
): Promise<CapturaCuotasPartido | null> {
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    select: {
      id: true,
      mostrarAlPublico: true,
      estadoCaptura: true,
      ultimaCapturaEn: true,
    },
  });
  if (!partido) return null;

  const [cuotas, eventIds, alertasNoVistas] = await Promise.all([
    prisma.cuotasCasa.findMany({ where: { partidoId } }),
    prisma.eventIdExterno.findMany({
      where: { partidoId },
      select: { casa: true, eventIdExterno: true, metodoDiscovery: true },
    }),
    prisma.alertaCuota.count({
      where: { partidoId, vistaPorAdmin: false },
    }),
  ]);

  const cuotaPorCasa = new Map(cuotas.map((c) => [c.casa, c]));
  const eventIdPorCasa = new Map(eventIds.map((e) => [e.casa, e]));

  const filas: CapturaCuotasFila[] = CUOTAS_CONFIG.CASAS.map((casa) => {
    const c = cuotaPorCasa.get(casa);
    const eId = eventIdPorCasa.get(casa);
    const fila: CapturaCuotasFila = {
      casa,
      estado: (c?.estado as EstadoCuotasCasa | undefined) ?? null,
      ultimoIntento: c?.ultimoIntento ?? null,
      ultimoExito: c?.ultimoExito ?? null,
      errorMensaje: c?.errorMensaje ?? null,
      intentosFallidos: c?.intentosFallidos ?? 0,
      capturadoEn: c?.capturadoEn ?? null,
      eventIdExterno: eId?.eventIdExterno ?? c?.eventIdExterno ?? null,
      metodoDiscovery:
        (eId?.metodoDiscovery as "AUTOMATICO" | "MANUAL" | undefined) ?? null,

      cuotaLocal: dec(c?.cuotaLocal),
      cuotaLocalAnterior: dec(c?.cuotaLocalAnterior),
      cuotaEmpate: dec(c?.cuotaEmpate),
      cuotaEmpateAnterior: dec(c?.cuotaEmpateAnterior),
      cuotaVisita: dec(c?.cuotaVisita),
      cuotaVisitaAnterior: dec(c?.cuotaVisitaAnterior),
      cuota1X: dec(c?.cuota1X),
      cuota1XAnterior: dec(c?.cuota1XAnterior),
      cuota12: dec(c?.cuota12),
      cuota12Anterior: dec(c?.cuota12Anterior),
      cuotaX2: dec(c?.cuotaX2),
      cuotaX2Anterior: dec(c?.cuotaX2Anterior),
      cuotaOver25: dec(c?.cuotaOver25),
      cuotaOver25Anterior: dec(c?.cuotaOver25Anterior),
      cuotaUnder25: dec(c?.cuotaUnder25),
      cuotaUnder25Anterior: dec(c?.cuotaUnder25Anterior),
      cuotaBttsSi: dec(c?.cuotaBttsSi),
      cuotaBttsSiAnterior: dec(c?.cuotaBttsSiAnterior),
      cuotaBttsNo: dec(c?.cuotaBttsNo),
      cuotaBttsNoAnterior: dec(c?.cuotaBttsNoAnterior),
    };
    return fila;
  });

  return {
    partidoId: partido.id,
    estadoCaptura: (partido.estadoCaptura as CapturaCuotasPartido["estadoCaptura"]) ?? "INACTIVA",
    ultimaCapturaEn: partido.ultimaCapturaEn,
    filtro1: partido.mostrarAlPublico,
    alertasNoVistas,
    filas,
  };
}

/** Lista alertas (paginadas) para un partido. */
export interface AlertaPartidoFila {
  id: string;
  casa: CasaCuotas;
  mercado: "1X2" | "DOBLE_OP" | "MAS_MENOS_25" | "BTTS";
  seleccion: string;
  cuotaAnterior: number;
  cuotaNueva: number;
  variacionPct: number;
  vistaPorAdmin: boolean;
  detectadoEn: Date;
}

export async function listarAlertasPorPartido(
  partidoId: string,
  opts: { soloNoVistas?: boolean; limit?: number } = {},
): Promise<AlertaPartidoFila[]> {
  const filas = await prisma.alertaCuota.findMany({
    where: {
      partidoId,
      ...(opts.soloNoVistas ? { vistaPorAdmin: false } : {}),
    },
    orderBy: { detectadoEn: "desc" },
    take: opts.limit ?? 200,
  });
  return filas.map((f) => ({
    id: f.id,
    casa: f.casa as CasaCuotas,
    mercado: f.mercado as AlertaPartidoFila["mercado"],
    seleccion: f.seleccion,
    cuotaAnterior: f.cuotaAnterior.toNumber(),
    cuotaNueva: f.cuotaNueva.toNumber(),
    variacionPct: f.variacionPct.toNumber(),
    vistaPorAdmin: f.vistaPorAdmin,
    detectadoEn: f.detectadoEn,
  }));
}

/** Etiqueta legible por casa. Único punto que mapea slug → display. */
export const ETIQUETAS_CASA: Record<CasaCuotas, string> = {
  apuesta_total: "Apuesta Total",
  doradobet: "Doradobet",
  betano: "Betano",
  inkabet: "Inkabet",
  te_apuesto: "Te Apuesto",
};
