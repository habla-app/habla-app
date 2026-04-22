"use client";
// RankingTable — lista ordenada de tickets con sus puntos (mockup
// `.ranking-table`). Grid columnas: 44/180/1fr/80/110.
//
// Variantes de fila:
//   - top-1/2/3: gradient pastel + borde izquierdo gold/silver/bronze
//   - me: gradient azul + borde izquierdo brand-blue-main (pill "Tú")
//   - cut-line: separador dashed rojo claro tras top 10
//   - after-cut: opacidad reducida + "Sin premio"
//
// Delta de posición (↑N, ↓N, =) se computa client-side: guardamos un
// mapa ticketId→rankPrevio en useRef y lo comparamos con cada update.
// Primera vez: sin flecha.
//
// Hotfix #6 Ítem 1.6: la fila del usuario incluye copy motivacional
// (único ganador / empate / cerca / lejos).

import { useEffect, useRef, useState } from "react";
import type { RankingRowPayload } from "@/lib/realtime/events";
import { PredChip } from "@/components/tickets/PredChip";
import { buildMotivationalCopy } from "@/lib/utils/premio-motivacional";

interface RankingTableProps {
  ranking: RankingRowPayload[];
  miUsuarioId: string | null;
  equipoLocal: string;
  equipoVisita: string;
  totalInscritos: number;
  pagados: number;
}

const TOP = 10;

type Delta = { dir: "up" | "down" | "flat"; n: number } | null;

export function RankingTable({
  ranking,
  miUsuarioId,
  equipoLocal,
  equipoVisita,
  totalInscritos,
  pagados,
}: RankingTableProps) {
  const [expanded, setExpanded] = useState(false);
  const prevRanks = useRef<Map<string, number> | null>(null);
  const [deltas, setDeltas] = useState<Map<string, Delta>>(new Map());

  useEffect(() => {
    if (prevRanks.current === null) {
      prevRanks.current = new Map(
        ranking.map((r) => [r.ticketId, r.rank] as const),
      );
      return;
    }
    const prev = prevRanks.current;
    const next = new Map<string, Delta>();
    const nextRanks = new Map<string, number>();
    for (const row of ranking) {
      const p = prev.get(row.ticketId);
      if (p === undefined) {
        next.set(row.ticketId, null);
      } else if (p < row.rank) {
        next.set(row.ticketId, { dir: "down", n: row.rank - p });
      } else if (p > row.rank) {
        next.set(row.ticketId, { dir: "up", n: p - row.rank });
      } else {
        next.set(row.ticketId, { dir: "flat", n: 0 });
      }
      nextRanks.set(row.ticketId, row.rank);
    }
    prevRanks.current = nextRanks;
    setDeltas(next);
  }, [ranking]);

  const visibles = expanded ? ranking : ranking.slice(0, TOP);
  const rankingForMotivational = ranking.map((r) => ({
    rank: r.rank,
    puntosTotal: r.puntosTotal,
  }));

  return (
    <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <div className="grid grid-cols-[44px_1fr_auto_80px_110px] items-center gap-3.5 border-b border-light bg-subtle px-4 py-3.5 font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-d">
        <div>Pos</div>
        <div>Jugador</div>
        <div className="hidden md:block">1X2 · Ambos · +2.5 · Roja · Marcador</div>
        <div className="text-center">Puntos</div>
        <div className="text-right">Premio</div>
      </div>

      <ul>
        {visibles.map((row) => {
          const isMe = miUsuarioId !== null && row.usuarioId === miUsuarioId;
          const delta = deltas.get(row.ticketId) ?? null;
          const motivational = isMe
            ? buildMotivationalCopy({
                miPuesto: row.rank,
                puntosPropios: row.puntosTotal,
                ranking: rankingForMotivational,
                M: pagados,
              })
            : null;

          const rowTint = isMe
            ? "bg-brand-blue-main/[0.06] border-l-4 border-l-brand-blue-main pl-[14px]"
            : row.rank === 1
              ? "bg-gradient-to-r from-brand-gold/[0.1] to-transparent border-l-4 border-l-brand-gold pl-[14px]"
              : row.rank === 2
                ? "bg-gradient-to-r from-[#C0C0C0]/[0.08] to-transparent border-l-4 border-l-[#C0C0C0] pl-[14px]"
                : row.rank === 3
                  ? "bg-gradient-to-r from-[#CD7F32]/[0.1] to-transparent border-l-4 border-l-[#CD7F32] pl-[14px]"
                  : "hover:bg-subtle";
          const afterCut = row.rank > pagados && !isMe;

          return (
            <li
              key={row.ticketId}
              className={`grid grid-cols-[44px_1fr_auto_80px_110px] items-center gap-3.5 border-b border-light px-4 py-3.5 transition ${rowTint}`}
            >
              <div className="text-center">
                <PosNumber rank={row.rank} />
                {delta && delta.dir !== "flat" ? (
                  <div
                    className={`mt-0.5 text-[10px] font-bold leading-none ${
                      delta.dir === "up"
                        ? "text-alert-success-text"
                        : "text-urgent-critical"
                    }`}
                  >
                    {delta.dir === "up" ? "↑" : "↓"} {delta.n}
                  </div>
                ) : delta?.dir === "flat" ? (
                  <div className="mt-0.5 text-[10px] font-bold leading-none text-soft">
                    =
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  aria-hidden
                  className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-sm"
                  style={{
                    background: isMe
                      ? "linear-gradient(135deg,#FFB800,#FF8C00)"
                      : avatarBgFor(row.usuarioId),
                    color: isMe ? "#000" : "#fff",
                    fontWeight: 700,
                  }}
                >
                  {initialsFrom(row.nombre)}
                </div>
                <div
                  className={`min-w-0 truncate text-sm font-bold ${
                    isMe ? "text-dark" : "text-dark"
                  }`}
                >
                  {row.nombre}
                  {isMe ? (
                    <span className="ml-2 rounded-full bg-brand-blue-main px-2 py-0.5 align-middle text-[10px] font-bold text-white">
                      Tú
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="hidden flex-wrap justify-end gap-1.5 md:flex">
                {chipsDeRow(row, equipoLocal, equipoVisita)}
              </div>

              <div className="text-center font-display text-2xl font-black leading-none text-brand-gold-dark">
                {row.puntosTotal}
              </div>

              <div
                className={`text-right ${afterCut ? "opacity-40" : ""}`}
              >
                {row.premioEstimado > 0 ? (
                  <>
                    <div className="font-display text-base font-black leading-none text-alert-success-text">
                      +{row.premioEstimado.toLocaleString("es-PE")} 🪙
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-d">
                      {row.rank === 1
                        ? "Premio 1°"
                        : row.rank === 2
                          ? "Premio 2°"
                          : row.rank === 3
                            ? "Premio 3°"
                            : `Top ${pagados}`}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-display text-[13px] font-black text-muted-d">
                      Sin premio
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.05em] text-muted-d">
                      {isMe ? `Necesitas top ${pagados}` : "—"}
                    </div>
                  </>
                )}
                {motivational ? (
                  <div
                    data-testid="premio-motivacional"
                    className={`mt-1 text-[10px] font-semibold leading-tight ${
                      motivational.tone === "gold"
                        ? "text-brand-gold-dark"
                        : "text-muted-d"
                    }`}
                  >
                    {motivational.emoji} {motivational.copy}
                  </div>
                ) : null}
              </div>

              {/* Cut-line solo dentro de visibles, tras el puesto `pagados`. */}
              {row.rank === pagados && !expanded ? null : null}
            </li>
          );
        })}

        {visibles.some((r) => r.rank === pagados) && !expanded ? (
          <li className="flex items-center gap-2.5 border-y border-dashed border-urgent-high bg-gradient-to-r from-urgent-high/[0.08] to-transparent px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9A3412]">
            <span aria-hidden>✂️</span>
            Corte · Del {pagados + 1}° en adelante no reciben premio
          </li>
        ) : null}
      </ul>

      {ranking.length > TOP ? (
        <div className="border-t border-light bg-card px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-sm font-bold text-brand-blue-main hover:underline"
          >
            {expanded
              ? "↑ Mostrar solo el top"
              : `Ver todos los ${totalInscritos} jugadores →`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PosNumber({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "text-medal-gold"
      : rank === 2
        ? "text-medal-silver"
        : rank === 3
          ? "text-medal-bronze"
          : "text-muted-d";
  return (
    <span
      className={`block font-display text-[22px] font-black leading-none ${tone}`}
    >
      {rank}
    </span>
  );
}

function initialsFrom(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) {
    return (parts[0].slice(0, 2) || "?").toUpperCase();
  }
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Hash determinista → color HSL. Evita trademarks y mantiene variedad.
const AVATAR_PALETTE = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#EF4444",
  "#F59E0B",
  "#06B6D4",
  "#84CC16",
  "#EC4899",
  "#F97316",
  "#A855F7",
  "#14B8A6",
  "#6366F1",
];
function avatarBgFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] ?? "#3B82F6";
}

function chipsDeRow(
  row: RankingRowPayload,
  equipoLocal: string,
  equipoVisita: string,
) {
  const res = row.puntosDetalle;
  const label1X2 =
    row.predicciones.predResultado === "LOCAL"
      ? cortoNombre(equipoLocal)
      : row.predicciones.predResultado === "VISITA"
        ? cortoNombre(equipoVisita)
        : "Empate";
  return [
    <PredChip key="r" estado={res.resultado > 0 ? "correct" : "pending"}>
      {label1X2}
    </PredChip>,
    <PredChip key="b" estado={res.btts > 0 ? "correct" : "pending"}>
      Ambos {row.predicciones.predBtts ? "Sí" : "No"}
    </PredChip>,
    <PredChip key="m" estado={res.mas25 > 0 ? "correct" : "pending"}>
      +2.5 {row.predicciones.predMas25 ? "Sí" : "No"}
    </PredChip>,
    <PredChip key="t" estado={res.tarjeta > 0 ? "correct" : "pending"}>
      Roja {row.predicciones.predTarjetaRoja ? "Sí" : "No"}
    </PredChip>,
    <PredChip key="mar" estado={res.marcador > 0 ? "correct" : "pending"}>
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
