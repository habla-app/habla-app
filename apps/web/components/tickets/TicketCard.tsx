// TicketCard — una card por ticket dentro de un MatchGroup.
// Replica `.ticket-card` del mockup. Variantes:
//   - in-top: zona de premio (borde dorado sutil + valor estimado)
//   - out: fuera de premio
//   - pending-card: torneo no empezó (borde izquierdo azul)
//   - winner-card: ganó el premio (borde dorado + trofeo)

import { PredChip } from "./PredChip";
import { resolvePrediccionesChips, type TicketConContexto } from "./adapter";

interface TicketCardProps {
  ticket: TicketConContexto;
  numero: number; /* 1 de N, 2 de N, etc. */
  total: number;
  /** Posición actual (live) o final. null si torneo no empezó. */
  posicion: number | null;
  puntos: number;
  premioEstimado: number;
  premioFinal: number;
  isWinner: boolean;
  inTop: boolean;
  pending: boolean;
  equipoLocal: string;
  equipoVisita: string;
}

export function TicketCard({
  ticket,
  numero,
  total,
  posicion,
  puntos,
  premioEstimado,
  premioFinal,
  isWinner,
  inTop,
  pending,
  equipoLocal,
  equipoVisita,
}: TicketCardProps) {
  const borderCls = isWinner
    ? "border-[1.5px] border-brand-gold/70 bg-gradient-to-br from-white to-[#FFFDF5]"
    : inTop
      ? "border-[1.5px] border-brand-gold/45 bg-card"
      : pending
        ? "border border-light border-l-4 border-l-brand-blue-main bg-card"
        : "border border-light bg-card opacity-90";

  const chips = resolvePrediccionesChips(ticket, equipoLocal, equipoVisita);

  return (
    <div
      className={`rounded-md px-4 py-3.5 shadow-sm ${borderCls} mb-2 last:mb-0`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div
          className={`text-[12px] font-bold ${isWinner ? "text-brand-gold-dark" : "text-muted-d"}`}
        >
          {isWinner ? (
            <>
              Ticket ganador <span aria-hidden>🏆</span>
            </>
          ) : inTop ? (
            <>Ticket {numero} de {total} · en zona de premio ⭐</>
          ) : (
            `Ticket ${numero} de ${total}`
          )}
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-bold ${
            pending
              ? "border-alert-info-border bg-alert-info-bg text-alert-info-text"
              : inTop || isWinner
                ? "border-brand-gold/40 bg-brand-gold-dim text-brand-gold-dark"
                : "border-light bg-subtle text-dark"
          }`}
        >
          {pending ? (
            <span>Aún no empieza</span>
          ) : (
            <>
              <span className="font-display font-black">
                {posicion !== null ? `${posicion}°` : "—"}
              </span>
              <span aria-hidden>·</span>
              <span>{puntos} pts</span>
            </>
          )}
        </div>
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <PredChip key={i} estado={c.estado}>
            {c.label}
          </PredChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-light pt-2.5 text-[12px]">
        <span className="text-muted-d">
          Entrada{" "}
          <strong className="text-dark">
            {ticket.torneo.entradaLukas} 🪙
          </strong>
          {pending && (
            <>
              {" · "}
              Máx posible <strong className="text-dark">21 pts</strong>
            </>
          )}
        </span>
        {isWinner ? (
          <span className="font-semibold text-brand-green">
            🎉 Premio:{" "}
            <strong className="text-brand-gold-dark">
              +{premioFinal.toLocaleString("es-PE")} 🪙
            </strong>
          </span>
        ) : inTop ? (
          <span className="font-semibold text-brand-gold-dark">
            ⭐ Top 10 · Premio estimado{" "}
            <strong>+{premioEstimado.toLocaleString("es-PE")} 🪙</strong>
          </span>
        ) : pending ? (
          <span className="text-muted-d">
            Empieza cuando arranque el partido
          </span>
        ) : (
          <span className="text-muted-d">Sin premio · Necesitas top 10</span>
        )}
      </div>
    </div>
  );
}
