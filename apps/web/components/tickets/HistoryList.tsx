"use client";
// HistoryList — tab "Historial" de /mis-combinadas (mockup `.history-list`).
// Filas comprimidas expandibles al click: muestran liga + scoreline + net
// del partido. Al expandirse aparece cada ticket en detalle (reusa chips).

import { useState } from "react";
import { PredChip } from "./PredChip";
import {
  resolvePrediccionesChips,
  type TicketConContexto,
} from "./adapter";

interface HistoryListProps {
  grupos: Array<{ torneoId: string; tickets: TicketConContexto[] }>;
}

export function HistoryList({ grupos }: HistoryListProps) {
  if (grupos.length === 0) return null;
  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-md border border-alert-info-border bg-alert-info-bg px-4 py-3 text-[13px] leading-relaxed text-alert-info-text">
        <span aria-hidden className="text-base">
          💡
        </span>
        <div>
          Click en cada fila para ver el detalle de los tickets de ese partido.
        </div>
      </div>
      <ul className="mb-6 overflow-hidden rounded-md border border-light bg-card shadow-sm">
        {grupos.map((grupo) => (
          <HistoryRow key={grupo.torneoId} tickets={grupo.tickets} />
        ))}
      </ul>
    </>
  );
}

function HistoryRow({ tickets }: { tickets: TicketConContexto[] }) {
  const [expanded, setExpanded] = useState(false);
  const first = tickets[0]!;
  const { partido } = first.torneo;
  const golesLocal = partido.golesLocal ?? 0;
  const golesVisita = partido.golesVisita ?? 0;
  // Lote 2: "winner" pasa a significar quedar dentro del top 10 final.
  const anyTopTen = tickets.some(
    (t) => t.posicionFinal !== null && t.posicionFinal <= 10,
  );
  const mejor = [...tickets].sort((a, b) => {
    const pa = a.posicionFinal ?? Number.POSITIVE_INFINITY;
    const pb = b.posicionFinal ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  })[0]!;
  const resumen = anyTopTen
    ? `${tickets.length} ticket${tickets.length > 1 ? "s" : ""} · Mejor: ${formatOrdinal(mejor.posicionFinal)} en top 10 · ${mejor.puntosTotal} pts`
    : `${tickets.length} ticket${tickets.length > 1 ? "s" : ""} · Mejor: ${formatOrdinal(mejor.posicionFinal)} · ${mejor.puntosTotal} pts`;

  const rowTint = anyTopTen
    ? "bg-gradient-to-r from-brand-gold/[0.05] via-transparent to-transparent"
    : "";

  return (
    <li className={`border-b border-light last:border-b-0 ${rowTint}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-subtle"
      >
        <div
          aria-hidden
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm text-lg ${
            anyTopTen
              ? "border border-brand-gold bg-brand-gold-dim"
              : "border border-light bg-subtle opacity-70"
          }`}
        >
          {anyTopTen ? (mejor.posicionFinal === 1 ? "🏆" : mejor.posicionFinal === 3 ? "🥉" : "🏅") : "⚽"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-muted-d">
            {partido.liga} · {formatHace(partido.fechaInicio)} ·{" "}
            {truncarEquipo(partido.equipoLocal)}{" "}
            <span className="font-black text-brand-gold-dark">
              {golesLocal}—{golesVisita}
            </span>{" "}
            {truncarEquipo(partido.equipoVisita)}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-dark">
            {resumen}
          </div>
        </div>
        <span
          aria-hidden
          className={`text-xl text-soft transition ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-light bg-subtle px-4 pb-4 pt-3">
          <div className="flex flex-col gap-2.5">
            {tickets.map((t, idx) => (
              <HistoryTicket
                key={t.id}
                ticket={t}
                numero={idx + 1}
                equipoLocal={partido.equipoLocal}
                equipoVisita={partido.equipoVisita}
              />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function HistoryTicket({
  ticket,
  numero,
  equipoLocal,
  equipoVisita,
}: {
  ticket: TicketConContexto;
  numero: number;
  equipoLocal: string;
  equipoVisita: string;
}) {
  const inTopTen =
    ticket.posicionFinal !== null && ticket.posicionFinal <= 10;
  const chips = resolvePrediccionesChips(ticket, equipoLocal, equipoVisita);
  const borderCls = inTopTen
    ? "border border-brand-gold bg-gradient-to-br from-white to-[#FFFDF5]"
    : "border border-light bg-card";
  return (
    <div className={`rounded-sm px-4 py-3 ${borderCls}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div
          className={`text-[12px] font-bold ${
            inTopTen ? "text-brand-gold-dark" : "text-muted-d"
          }`}
        >
          Ticket {numero}
          {ticket.posicionFinal !== null
            ? ` · ${formatOrdinal(ticket.posicionFinal)}${inTopTen ? " · Top 10" : ""}`
            : ""}
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-bold ${
            inTopTen
              ? "border-brand-gold/40 bg-brand-gold-dim text-brand-gold-dark"
              : "border-light bg-subtle text-dark"
          }`}
        >
          <span>{ticket.puntosTotal} pts</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <PredChip key={i} estado={c.estado}>
            {c.label}
          </PredChip>
        ))}
      </div>
    </div>
  );
}

function formatOrdinal(pos: number | null): string {
  if (pos === null) return "—";
  return `${pos}°`;
}

function truncarEquipo(nombre: string): string {
  const n = nombre.trim();
  if (n.length <= 12) return n;
  return n.split(/\s+/)[0] ?? n.slice(0, 10);
}

function formatHace(fecha: Date | string): string {
  const ms = Date.now() - new Date(fecha).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.floor(ms / oneDay);
  if (days < 1) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  const meses = Math.floor(days / 30);
  if (meses === 1) return "hace 1 mes";
  return `hace ${meses} meses`;
}
