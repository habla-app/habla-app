"use client";
// RankingPaginado — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-detail (.ranking-table con
// paginación inline + .ranking-me-sticky, líneas 3640-3747).
//
// Estructura del mockup:
//   div#ranking-live-container
//     table.ranking-table
//       thead: Pos · Tipster · Aciertos · Pts
//       tbody.ranking-page (uno por página de 10) — solo el activo es display
//       tbody.ranking-me-sticky — visible si NO estás en la página activa
//     div.ranking-paginator (footer con info + botones)
//
// Decisión §4.10: filas son clickeables a /jugador/[username]; visitor ve
// cursor:not-allowed con tooltip.
// Decisión §4.11: paginación bloques de 10 + sticky-bottom de "tu posición".

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface RankingFila {
  rank: number;
  ticketId: string;
  usuarioId: string;
  username: string;
  nombre: string;
  puntosTotal: number;
  aciertos: number;
  totalMercados: number;
}

interface Props {
  filas: RankingFila[];
  totalInscritos: number;
  miUsuarioId: string | null;
  miPosicion: number | null;
  hasSession: boolean;
}

const PAGE_SIZE = 10;

export function RankingPaginado({
  filas,
  totalInscritos,
  miUsuarioId,
  miPosicion,
  hasSession,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(filas.length / PAGE_SIZE));
  const miPagina = useMemo(() => {
    if (!miPosicion) return null;
    return Math.ceil(miPosicion / PAGE_SIZE);
  }, [miPosicion]);

  const [page, setPage] = useState<number>(() =>
    miPagina && miPagina <= totalPages ? miPagina : 1,
  );

  const start = (page - 1) * PAGE_SIZE;
  const slice = filas.slice(start, start + PAGE_SIZE);
  const showSticky =
    miPosicion !== null && miPagina !== null && miPagina !== page;
  const miFila = miUsuarioId
    ? filas.find((f) => f.usuarioId === miUsuarioId) ?? null
    : null;

  return (
    <>
      <div className="section-bar">
        <div className="section-bar-left">
          <div className="section-bar-icon">🏆</div>
          <div>
            <div className="section-bar-title">
              Ranking en vivo · {totalInscritos.toLocaleString("es-PE")} tipsters
            </div>
            {miPosicion !== null ? (
              <div className="section-bar-subtitle">
                Tu posición actual: #{miPosicion}
              </div>
            ) : null}
          </div>
        </div>
        <span className="badge badge-live">LIVE</span>
      </div>

      <div
        id="ranking-live-container"
        style={{
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
          background: "var(--bg-card)",
          overflow: "hidden",
        }}
      >
        <table className="ranking-table" style={{ border: 0, borderRadius: 0, margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Pos</th>
              <th>Tipster</th>
              <th className="center">Aciertos</th>
              <th className="center">Pts</th>
            </tr>
          </thead>

          <tbody>
            {slice.map((f) => (
              <FilaTbody
                key={f.ticketId}
                fila={f}
                esMe={f.usuarioId === miUsuarioId}
                hasSession={hasSession}
              />
            ))}
            {slice.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: "center",
                    padding: 24,
                    color: "var(--text-muted-d)",
                    fontSize: 13,
                  }}
                >
                  Todavía no hay tipsters en esta página del ranking.
                </td>
              </tr>
            ) : null}
          </tbody>

          {showSticky && miFila ? (
            <tbody className="ranking-me-sticky">
              <FilaTbody
                fila={miFila}
                esMe
                hasSession={hasSession}
                etiquetaSticky
              />
            </tbody>
          ) : null}
        </table>

        <Paginador
          page={page}
          totalPages={totalPages}
          miPagina={miPagina}
          onChange={setPage}
          totalFilas={filas.length}
        />
      </div>
    </>
  );
}

function FilaTbody({
  fila,
  esMe,
  hasSession,
  etiquetaSticky,
}: {
  fila: RankingFila;
  esMe: boolean;
  hasSession: boolean;
  etiquetaSticky?: boolean;
}) {
  const router = useRouter();
  const cls = `clickable${hasSession ? "" : " disabled"}${esMe ? " me-row" : ""}`;
  const navegar = () => {
    if (!hasSession) return;
    router.push(`/jugador/${fila.username}`);
  };
  const posCls =
    fila.rank === 1 ? "rank-pos gold" : esMe ? "rank-pos blue" : "rank-pos";
  return (
    <tr
      className={cls}
      data-href={hasSession ? `/jugador/${fila.username}` : undefined}
      onClick={navegar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navegar();
        }
      }}
      tabIndex={hasSession ? 0 : -1}
      title={hasSession ? `Ver perfil de @${fila.username}` : "Iniciá sesión para ver perfiles"}
    >
      <td>
        <div className={posCls}>{fila.rank}°</div>
      </td>
      <td>
        <div className="rank-username">
          {esMe ? "@yo (tú)" : `@${fila.username}`}
        </div>
        {etiquetaSticky ? (
          <div className="rank-meta blue">Tu posición actual</div>
        ) : null}
      </td>
      <td className="center">
        {fila.aciertos} / {fila.totalMercados}
      </td>
      <td className="center">
        <span className="rank-pts">{fila.puntosTotal}</span>
      </td>
    </tr>
  );
}

function Paginador({
  page,
  totalPages,
  miPagina,
  onChange,
  totalFilas,
}: {
  page: number;
  totalPages: number;
  miPagina: number | null;
  onChange: (p: number) => void;
  totalFilas: number;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalFilas);
  return (
    <div className="ranking-paginator">
      <div className="ranking-paginator-info">
        Mostrando {start}-{end} de {totalFilas}
      </div>
      <div className="ranking-paginator-controls">
        {paginasVisibles(page, totalPages, miPagina).map((p, i) =>
          p === "···" ? (
            <span key={`sep-${i}`} className="ranking-paginator-sep">
              ···
            </span>
          ) : (
            <button
              key={`p-${p}`}
              type="button"
              onClick={() => onChange(p)}
              className={`ranking-page-btn${p === page ? " active" : ""}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p === miPagina && p !== page
                ? `Mi pos #${miPagina}`
                : labelRango(p)}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function labelRango(p: number): string {
  const start = (p - 1) * PAGE_SIZE + 1;
  const end = p * PAGE_SIZE;
  return `${start}-${end}`;
}

function paginasVisibles(
  page: number,
  totalPages: number,
  miPagina: number | null,
): Array<number | "···"> {
  const result: Array<number | "···"> = [];
  const seed = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  if (miPagina) seed.add(miPagina);
  const ordenadas = Array.from(seed)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  let prev = 0;
  for (const p of ordenadas) {
    if (p - prev > 1) result.push("···");
    result.push(p);
    prev = p;
  }
  return result;
}
