"use client";
// EventsView — timeline cronológica de eventos del partido. Se actualiza
// en vivo via el hook useEventosPartido.

import type { EventoTimeline } from "@/hooks/useEventosPartido";

interface EventsViewProps {
  eventos: EventoTimeline[];
  isLoading: boolean;
  equipoLocal: string;
  equipoVisita: string;
}

export function EventsView({
  eventos,
  isLoading,
  equipoLocal,
  equipoVisita,
}: EventsViewProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-light bg-card p-6 text-center text-[13px] text-muted-d">
        Cargando eventos…
      </div>
    );
  }
  if (eventos.length === 0) {
    return (
      <div className="rounded-md border border-light bg-card p-6 text-center text-[13px] text-muted-d">
        Todavía no hubo eventos. Los goles, tarjetas y cambios aparecerán acá.
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-md border border-light bg-card shadow-sm divide-y divide-light">
      {eventos.map((e, i) => (
        <li
          key={e.id ?? i}
          className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-hover"
        >
          <span className="flex h-10 w-12 flex-shrink-0 items-center justify-center rounded-sm bg-subtle font-display text-[14px] font-black text-dark">
            {e.minuto}&apos;
          </span>
          <span
            aria-hidden
            className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
              e.tipo === "GOL"
                ? "bg-brand-green/20"
                : e.tipo === "TARJETA_ROJA"
                  ? "bg-urgent-critical/20"
                  : e.tipo === "TARJETA_AMARILLA"
                    ? "bg-brand-gold/25"
                    : "bg-subtle"
            }`}
          >
            {icono(e.tipo)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              e.equipo === "LOCAL"
                ? "bg-brand-blue-main/10 text-brand-blue-main"
                : e.equipo === "VISITA"
                  ? "bg-brand-gold/15 text-brand-gold-dark"
                  : "bg-subtle text-muted-d"
            }`}
          >
            {e.equipo === "LOCAL"
              ? cortoNombre(equipoLocal)
              : e.equipo === "VISITA"
                ? cortoNombre(equipoVisita)
                : "—"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-dark">
              {titulo(e.tipo)}
            </div>
            <div className="truncate text-[12px] text-muted-d">
              {e.jugador ?? ""}
              {e.detalle && (e.jugador ? " · " : "") + e.detalle}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function icono(tipo: string): string {
  if (tipo === "GOL") return "⚽";
  if (tipo === "TARJETA_ROJA") return "🟥";
  if (tipo === "TARJETA_AMARILLA") return "🟨";
  if (tipo === "SUSTITUCION") return "🔁";
  if (tipo === "FIN_PARTIDO") return "🏁";
  if (tipo === "HALFTIME") return "⏸";
  return "•";
}

function titulo(tipo: string): string {
  if (tipo === "GOL") return "Gol";
  if (tipo === "TARJETA_ROJA") return "Tarjeta roja";
  if (tipo === "TARJETA_AMARILLA") return "Tarjeta amarilla";
  if (tipo === "SUSTITUCION") return "Sustitución";
  if (tipo === "FIN_PARTIDO") return "Fin del partido";
  if (tipo === "HALFTIME") return "Descanso";
  return tipo;
}

function cortoNombre(n: string): string {
  const t = n.trim();
  if (t.length <= 10) return t;
  return t.split(/\s+/)[0] ?? t.slice(0, 8);
}
