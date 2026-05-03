"use client";
// RankingPaginado — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-liga-detail .ranking-table
// + .ranking-me-sticky.
//
// Implementa la decisión §4.11: ranking en bloques de 10 con paginación
// inline + fila sticky-bottom de "tu posición" cuando NO está en la página
// actualmente visible. Las filas son navegables a /jugador/[username]
// (decisión §4.10). Para visitor, el clic muestra tooltip CTA.

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
  /** True si el visitor está logueado. Filas son navegables. False:
   *  filas con cursor not-allowed + tooltip CTA. */
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
    <section
      aria-label="Ranking en vivo"
      className="bg-card md:rounded-md md:border md:border-light md:shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark md:text-display-sm">
            <span aria-hidden>🏅</span>
            Ranking en vivo · {totalInscritos.toLocaleString("es-PE")} tipsters
          </h2>
          {miPosicion !== null ? (
            <p className="mt-1 text-body-xs text-muted-d">
              Tu posición actual:{" "}
              <strong className="text-brand-blue-main">#{miPosicion}</strong>
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-urgent-critical-bg px-2.5 py-1 font-display text-label-sm font-extrabold uppercase tracking-[0.04em] text-urgent-critical">
          ● LIVE
        </span>
      </header>

      <ul
        className="divide-y divide-light/60 border-t border-light"
        role="list"
        aria-label={`Posiciones ${start + 1} a ${Math.min(start + PAGE_SIZE, filas.length)}`}
      >
        {slice.map((f) => (
          <FilaRanking
            key={f.ticketId}
            fila={f}
            esViewer={f.usuarioId === miUsuarioId}
            hasSession={hasSession}
          />
        ))}
        {slice.length === 0 ? (
          <li className="px-4 py-8 text-center text-body-sm text-muted-d">
            Todavía no hay tipsters en esta página del ranking.
          </li>
        ) : null}
      </ul>

      <Paginador
        page={page}
        totalPages={totalPages}
        miPagina={miPagina}
        onChange={setPage}
        totalFilas={filas.length}
      />

      {showSticky && miFila ? (
        <div
          className="sticky bottom-0 z-10 border-t-2 border-brand-gold bg-brand-gold/[0.10]"
          aria-label="Tu posición"
        >
          <ul className="divide-y divide-light/60" role="list">
            <FilaRanking
              fila={miFila}
              esViewer
              hasSession={hasSession}
              stickyVariant
            />
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FilaRanking({
  fila,
  esViewer,
  hasSession,
  stickyVariant,
}: {
  fila: RankingFila;
  esViewer: boolean;
  hasSession: boolean;
  stickyVariant?: boolean;
}) {
  const router = useRouter();
  const baseCls =
    "grid grid-cols-[3.25rem_1fr_4.25rem_3.5rem] items-center gap-2 px-4 py-2.5 text-left md:px-5";
  const stateCls = esViewer
    ? "bg-brand-gold/[0.08]"
    : "hover:bg-subtle/40";
  const cls = `${baseCls} ${stickyVariant ? "" : stateCls} transition-colors`;

  const navegar = () => router.push(`/jugador/${fila.username}`);

  if (!hasSession) {
    return (
      <li
        className={`${cls} cursor-not-allowed`}
        title="Iniciá sesión para ver perfiles"
      >
        <Cells fila={fila} esViewer={esViewer} stickyVariant={stickyVariant} />
      </li>
    );
  }

  return (
    <li
      role="link"
      tabIndex={0}
      onClick={navegar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navegar();
        }
      }}
      aria-label={`Ver perfil de @${fila.username}`}
      className={`${cls} cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue-main focus:ring-offset-1`}
    >
      <Cells fila={fila} esViewer={esViewer} stickyVariant={stickyVariant} />
    </li>
  );
}

function Cells({
  fila,
  esViewer,
  stickyVariant,
}: {
  fila: RankingFila;
  esViewer: boolean;
  stickyVariant?: boolean;
}) {
  return (
    <>
      <span
        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-display text-label-sm font-extrabold ${
          esViewer
            ? "bg-brand-blue-main text-white"
            : fila.rank <= 3
              ? "bg-brand-gold/20 text-brand-gold-dark"
              : "bg-subtle text-body"
        }`}
      >
        {fila.rank}
      </span>
      <span className="font-display text-label-md font-bold text-dark">
        @{fila.username}
        {esViewer ? (
          <span className="ml-1.5 text-label-sm font-bold uppercase tracking-[0.04em] text-brand-blue-main">
            {stickyVariant ? "(tu posición actual)" : "(tú)"}
          </span>
        ) : null}
      </span>
      <span className="text-center font-display text-label-md font-bold text-body">
        {fila.aciertos}/{fila.totalMercados}
      </span>
      <span className="text-right font-display text-label-md font-extrabold text-urgent-critical">
        {fila.puntosTotal}
      </span>
    </>
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
    <nav
      aria-label="Paginación del ranking"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-light px-4 py-3 text-body-xs text-muted-d md:px-5"
    >
      <span>
        Mostrando <strong className="text-dark">{start}-{end}</strong> de{" "}
        <strong className="text-dark">{totalFilas}</strong>
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {paginasVisibles(page, totalPages, miPagina).map((p, i) =>
          p === "···" ? (
            <span key={`gap-${i}`} className="px-2 text-muted-d">
              ···
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`touch-target rounded-sm border px-2.5 py-1 font-display text-label-sm font-bold transition-colors ${
                p === page
                  ? "border-brand-blue-main bg-brand-blue-main text-white"
                  : p === miPagina
                    ? "border-brand-gold bg-brand-gold/15 text-brand-gold-dark"
                    : "border-light bg-card text-body hover:border-brand-blue-main hover:text-brand-blue-main"
              }`}
            >
              {p === miPagina && p !== page ? `Mi pos #${miPagina}` : p}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}

function paginasVisibles(
  page: number,
  totalPages: number,
  miPagina: number | null,
): Array<number | "···"> {
  const result: Array<number | "···"> = [];
  const insertar = (p: number) => {
    if (!result.includes(p) && p >= 1 && p <= totalPages) result.push(p);
  };
  const seed = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  if (miPagina) seed.add(miPagina);
  const ordenadas = Array.from(seed)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  let prev = 0;
  for (const p of ordenadas) {
    if (p - prev > 1) result.push("···");
    insertar(p);
    prev = p;
  }
  return result;
}
