"use client";
// RankingTable — lista ordenada de tickets con sus puntos. Replica
// `.ranking-table` del mockup. Top 1/2/3 con tonos oro/plata/bronce,
// fila propia del usuario destacada en azul. Botón "Ver todos" expande
// la lista del top 10 hacia abajo.
//
// Hotfix #6 Ítem 1.6: la fila del usuario ahora incluye una línea
// motivacional bajo el premio estimado (únicos ganador / empate /
// cerca / lejos), derivada del helper puro `buildMotivationalCopy`.

import { useState } from "react";
import type { RankingRowPayload } from "@/lib/realtime/events";
import { PredChip } from "@/components/tickets/PredChip";
import { buildMotivationalCopy } from "@/lib/utils/premio-motivacional";

interface RankingTableProps {
  ranking: RankingRowPayload[];
  miUsuarioId: string | null;
  equipoLocal: string;
  equipoVisita: string;
  totalInscritos: number;
  /** Hotfix #6: posiciones pagadas (M) — para el copy motivacional. */
  pagados: number;
}

const TOP = 10;

export function RankingTable({
  ranking,
  miUsuarioId,
  equipoLocal,
  equipoVisita,
  totalInscritos,
  pagados,
}: RankingTableProps) {
  const [expanded, setExpanded] = useState(false);
  const visibles = expanded ? ranking : ranking.slice(0, TOP);
  const mostrandoResto = expanded && ranking.length > TOP;

  // Snapshot para el helper motivacional — solo rank + puntos del ranking
  // COMPLETO (no del slice), porque necesitamos ver todos los empates y
  // calcular diferencia al puesto M.
  const rankingForMotivational = ranking.map((r) => ({
    rank: r.rank,
    puntosTotal: r.puntosTotal,
  }));

  return (
    <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <div className="grid grid-cols-[50px_1fr_auto_72px_100px] items-center gap-3 border-b border-light bg-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        <div>Pos</div>
        <div>Jugador</div>
        <div className="hidden md:block">
          1X2 · Ambos · +2.5 · Roja · Marcador
        </div>
        <div className="text-right">Puntos</div>
        <div className="text-right">Premio</div>
      </div>

      <ul className="divide-y divide-light">
        {visibles.map((row) => {
          const isMe = miUsuarioId !== null && row.usuarioId === miUsuarioId;
          const motivational = isMe
            ? buildMotivationalCopy({
                miPuesto: row.rank,
                puntosPropios: row.puntosTotal,
                ranking: rankingForMotivational,
                M: pagados,
              })
            : null;
          return (
            <li
              key={row.ticketId}
              className={`grid grid-cols-[50px_1fr_auto_72px_100px] items-start gap-3 px-4 py-3 transition-colors ${
                isMe ? "bg-brand-blue-main/10" : "hover:bg-hover"
              }`}
            >
              <div className="pt-1">
                <PosBadge rank={row.rank} />
              </div>
              <div className="min-w-0">
                <div
                  className={`truncate text-[13px] font-semibold ${
                    isMe ? "text-brand-blue-main" : "text-dark"
                  }`}
                >
                  {row.nombre}
                  {isMe && (
                    <span className="ml-2 text-[10px] font-bold text-brand-blue-main">
                      TÚ
                    </span>
                  )}
                </div>
              </div>
              <div className="hidden flex-wrap justify-end gap-1 pt-1 md:flex">
                {chipsDeRow(row, equipoLocal, equipoVisita)}
              </div>
              <div className="pt-1 text-right font-display text-[18px] font-black text-dark">
                {row.puntosTotal}
              </div>
              <div className="text-right">
                {row.premioEstimado > 0 ? (
                  <>
                    <div className="font-display text-[13px] font-black text-brand-gold-dark">
                      +{row.premioEstimado.toLocaleString("es-PE")} 🪙
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted-d">
                      {row.rank === 1
                        ? "Premio 1°"
                        : row.rank === 2
                          ? "Premio 2°"
                          : row.rank === 3
                            ? "Premio 3°"
                            : "En premio"}
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] text-soft">—</span>
                )}
                {motivational && (
                  <div
                    data-testid="premio-motivacional"
                    className={`mt-1.5 text-[10px] font-semibold leading-tight ${
                      motivational.tone === "gold"
                        ? "text-brand-gold-dark"
                        : "text-muted-d"
                    }`}
                  >
                    {motivational.emoji} {motivational.copy}
                  </div>
                )}
              </div>
            </li>
          );
        })}

        {!expanded && ranking.length > TOP && (
          <li className="flex items-center justify-center border-t border-light bg-subtle px-4 py-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-d">
            <span aria-hidden>✂️</span>
            <span className="ml-2">Línea de corte · fuera de premio</span>
          </li>
        )}
      </ul>

      {ranking.length > TOP && (
        <div className="border-t border-light bg-card px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[13px] font-bold text-brand-blue-main hover:underline"
          >
            {expanded
              ? "↑ Mostrar solo el top"
              : `Ver todos los ${totalInscritos} jugadores →`}
          </button>
          {mostrandoResto && (
            <p className="mt-1 text-[11px] text-muted-d">
              Mostrando {ranking.length} de {totalInscritos}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PosBadge({ rank }: { rank: number }) {
  let tone = "bg-subtle text-dark";
  if (rank === 1) tone = "bg-medal-gold text-white";
  else if (rank === 2) tone = "bg-medal-silver text-white";
  else if (rank === 3) tone = "bg-medal-bronze text-white";
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-[14px] font-black ${tone}`}
    >
      {rank}
    </span>
  );
}

function chipsDeRow(
  row: RankingRowPayload,
  equipoLocal: string,
  equipoVisita: string,
) {
  const res = row.puntosDetalle;
  const label1X2 = row.predicciones.predResultado === "LOCAL"
    ? cortoNombre(equipoLocal)
    : row.predicciones.predResultado === "VISITA"
      ? cortoNombre(equipoVisita)
      : "Empate";
  return [
    <PredChip
      key="r"
      estado={res.resultado > 0 ? "correct" : "pending"}
    >
      {label1X2}
    </PredChip>,
    <PredChip
      key="b"
      estado={res.btts > 0 ? "correct" : "pending"}
    >
      {row.predicciones.predBtts ? "Sí" : "No"}
    </PredChip>,
    <PredChip
      key="m"
      estado={res.mas25 > 0 ? "correct" : "pending"}
    >
      {row.predicciones.predMas25 ? "Sí" : "No"}
    </PredChip>,
    <PredChip
      key="t"
      estado={res.tarjeta > 0 ? "correct" : "pending"}
    >
      {row.predicciones.predTarjetaRoja ? "Sí" : "No"}
    </PredChip>,
    <PredChip
      key="mar"
      estado={res.marcador > 0 ? "correct" : "pending"}
    >
      {row.predicciones.predMarcadorLocal}-
      {row.predicciones.predMarcadorVisita}
    </PredChip>,
  ];
}

function cortoNombre(n: string): string {
  const t = n.trim();
  if (t.length <= 8) return t;
  return t.split(/\s+/)[0] ?? t.slice(0, 8);
}
