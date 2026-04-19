// Adapters server→UI para tickets.
//
// Resuelve el estado de cada chip de predicción según el snapshot
// actual del partido (goles, btts, mas25, huboTarjetaRoja, estado).
// Lógica paralela a puntuacion.service.ts pero sin importar el server
// porque el cliente consume estos datos via fetch.

import type { Ticket, Torneo, Partido } from "@habla/db";

export type TicketConContexto = Ticket & {
  torneo: Torneo & { partido: Partido };
};

export type EstadoChip = "correct" | "wrong" | "pending";

export interface ChipResuelto {
  label: string;
  estado: EstadoChip;
}

export function resolvePrediccionesChips(
  ticket: TicketConContexto,
  equipoLocal: string,
  equipoVisita: string,
): ChipResuelto[] {
  const p = ticket.torneo.partido;
  const out: ChipResuelto[] = [];

  // Resultado
  const label1X2 = ticket.predResultado === "LOCAL"
    ? cortoNombre(equipoLocal)
    : ticket.predResultado === "VISITA"
      ? cortoNombre(equipoVisita)
      : "Empate";
  out.push({
    label: label1X2,
    estado: resolverResultado(ticket, p),
  });

  // BTTS
  out.push({
    label: ticket.predBtts ? "Ambos Sí" : "Ambos No",
    estado: resolverBtts(ticket, p),
  });

  // +2.5
  out.push({
    label: ticket.predMas25 ? "+2.5 Sí" : "+2.5 No",
    estado: resolverMas25(ticket, p),
  });

  // Tarjeta roja
  out.push({
    label: ticket.predTarjetaRoja ? "Roja Sí" : "Roja No",
    estado: resolverTarjetaRoja(ticket, p),
  });

  // Marcador exacto
  out.push({
    label: `${ticket.predMarcadorLocal}-${ticket.predMarcadorVisita}`,
    estado: resolverMarcador(ticket, p),
  });

  return out;
}

function resolverResultado(
  t: TicketConContexto,
  p: Partido,
): EstadoChip {
  if (p.golesLocal === null || p.golesVisita === null) return "pending";
  const real: "LOCAL" | "EMPATE" | "VISITA" =
    p.golesLocal > p.golesVisita
      ? "LOCAL"
      : p.golesLocal < p.golesVisita
        ? "VISITA"
        : "EMPATE";
  if (p.estado !== "FINALIZADO") return "pending";
  return t.predResultado === real ? "correct" : "wrong";
}

function resolverBtts(t: TicketConContexto, p: Partido): EstadoChip {
  if (p.golesLocal === null || p.golesVisita === null) return "pending";
  // Durante EN_VIVO: si ya ambos anotaron, confirma true; si no y termina, false.
  if (p.golesLocal > 0 && p.golesVisita > 0) {
    return t.predBtts === true ? "correct" : "wrong";
  }
  if (p.estado === "FINALIZADO") {
    const realBtts = p.btts ?? false;
    return t.predBtts === realBtts ? "correct" : "wrong";
  }
  return "pending";
}

function resolverMas25(t: TicketConContexto, p: Partido): EstadoChip {
  if (p.golesLocal === null || p.golesVisita === null) return "pending";
  const total = p.golesLocal + p.golesVisita;
  if (total > 2) {
    return t.predMas25 === true ? "correct" : "wrong";
  }
  if (p.estado === "FINALIZADO") {
    return t.predMas25 === false ? "correct" : "wrong";
  }
  return "pending";
}

function resolverTarjetaRoja(
  t: TicketConContexto,
  p: Partido,
): EstadoChip {
  if (p.huboTarjetaRoja === true) {
    return t.predTarjetaRoja === true ? "correct" : "wrong";
  }
  if (p.estado === "FINALIZADO") {
    const real = p.huboTarjetaRoja ?? false;
    return t.predTarjetaRoja === real ? "correct" : "wrong";
  }
  return "pending";
}

function resolverMarcador(
  t: TicketConContexto,
  p: Partido,
): EstadoChip {
  if (p.estado !== "FINALIZADO") return "pending";
  if (p.golesLocal === null || p.golesVisita === null) return "pending";
  return t.predMarcadorLocal === p.golesLocal &&
    t.predMarcadorVisita === p.golesVisita
    ? "correct"
    : "wrong";
}

function cortoNombre(nombre: string): string {
  const n = nombre.trim();
  if (n.length <= 10) return n;
  return n.split(/\s+/)[0] ?? n.slice(0, 8);
}
