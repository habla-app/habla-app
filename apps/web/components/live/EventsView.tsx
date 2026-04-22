"use client";
// EventsView — timeline cronológica de eventos (mockup `.events-detailed`).
// Grid 60/44/1fr. Goles tienen highlight dorado. Pill de equipo inline al
// principio del título (no separada).

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
      <div className="rounded-md border border-light bg-card p-6 text-center text-sm text-muted-d shadow-sm">
        Cargando eventos…
      </div>
    );
  }
  if (eventos.length === 0) {
    return (
      <div className="rounded-md border border-light bg-card p-6 text-center text-sm text-muted-d shadow-sm">
        Todavía no hubo eventos. Los goles, tarjetas y cambios aparecerán acá.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      {eventos.map((e, i) => {
        const gol = e.tipo === "GOL";
        const rowBg = gol
          ? "bg-gradient-to-r from-brand-gold/[0.15] to-transparent"
          : i > 0
            ? "border-t border-light"
            : "";
        return (
          <div
            key={e.id ?? i}
            className={`grid grid-cols-[60px_44px_1fr] items-center gap-3.5 px-5 py-3.5 transition hover:bg-subtle ${i > 0 && !gol ? "border-t border-light" : ""} ${rowBg}`}
          >
            <div className="text-center font-display text-xl font-black leading-none text-muted-d">
              {e.minuto}&apos;
            </div>
            <div
              aria-hidden
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                gol
                  ? "bg-alert-success-bg"
                  : e.tipo === "TARJETA_ROJA"
                    ? "bg-pred-wrong-bg"
                    : e.tipo === "TARJETA_AMARILLA"
                      ? "bg-urgent-med-bg"
                      : e.tipo === "SUSTITUCION"
                        ? "bg-accent-champions-bg"
                        : "bg-subtle"
              }`}
            >
              {icono(e.tipo)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-dark">
                {e.equipo === "LOCAL" || e.equipo === "VISITA" ? (
                  <span
                    className={`mr-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${
                      e.equipo === "LOCAL"
                        ? "bg-pred-wrong-bg text-accent-clasico-dark"
                        : "bg-accent-champions-bg text-accent-champions-dark"
                    }`}
                  >
                    {cortoNombre(e.equipo === "LOCAL" ? equipoLocal : equipoVisita)}
                  </span>
                ) : null}
                {tituloConJugador(e.tipo, e.jugador)}
              </div>
              {e.detalle ? (
                <div className="text-xs text-muted-d">{e.detalle}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function icono(tipo: string): string {
  if (tipo === "GOL") return "⚽";
  if (tipo === "TARJETA_ROJA") return "🟥";
  if (tipo === "TARJETA_AMARILLA") return "🟨";
  if (tipo === "SUSTITUCION") return "🔄";
  if (tipo === "FIN_PARTIDO") return "🏁";
  if (tipo === "HALFTIME") return "⏸";
  return "•";
}

function tituloConJugador(tipo: string, jugador: string | null): string {
  const nombre = jugador ?? "";
  if (tipo === "GOL") return nombre ? `Gol de ${nombre}` : "Gol";
  if (tipo === "TARJETA_ROJA")
    return nombre ? `Tarjeta roja a ${nombre}` : "Tarjeta roja";
  if (tipo === "TARJETA_AMARILLA")
    return nombre ? `Tarjeta amarilla a ${nombre}` : "Tarjeta amarilla";
  if (tipo === "SUSTITUCION")
    return nombre ? `Sustitución: ${nombre}` : "Sustitución";
  if (tipo === "FIN_PARTIDO") return "Fin del partido";
  if (tipo === "HALFTIME") return "Descanso";
  return tipo;
}

function cortoNombre(n: string): string {
  const t = n.trim();
  if (t.length <= 10) return t;
  return t.split(/\s+/)[0] ?? t.slice(0, 8);
}
