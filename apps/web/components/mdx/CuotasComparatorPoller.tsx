"use client";
// CuotasComparatorPoller — Lote 9.
//
// Cuando el RSC parent renderiza con cache miss, monta este componente
// debajo del skeleton. Pollea `GET /api/v1/cuotas/[partidoId]` cada 3s,
// max 4 intentos (~12s). Cuando recibe `status: ok`, re-renderiza con la
// `<CuotasGrid>`. Si llega a max attempts sin hit, muestra el estado
// vacío (asume el partido no tiene odds).
//
// El tracking del evento `cuotas_comparator_visto` lo hace el server
// component padre con `<TrackOnMount>` — no se duplica acá.

import { useEffect, useState } from "react";
import type { OddsCacheEntry } from "@/lib/services/odds-cache.service";
import { CuotasGrid } from "./CuotasGrid";

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 4;

type Estado =
  | { kind: "polling"; attempt: number }
  | { kind: "ok"; data: OddsCacheEntry }
  | { kind: "empty" }
  | { kind: "not-found" };

interface Props {
  partidoId: string;
}

export function CuotasComparatorPoller({ partidoId }: Props) {
  const [estado, setEstado] = useState<Estado>({ kind: "polling", attempt: 0 });

  useEffect(() => {
    if (estado.kind !== "polling") return;
    if (estado.attempt >= MAX_ATTEMPTS) {
      setEstado({ kind: "empty" });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            const res = await fetch(
              `/api/v1/cuotas/${encodeURIComponent(partidoId)}`,
              { cache: "no-store" },
            );
            if (cancelled) return;
            if (res.status === 404) {
              setEstado({ kind: "not-found" });
              return;
            }
            const json = (await res.json()) as
              | { status: "ok"; data: OddsCacheEntry }
              | { status: "updating" }
              | { status: "error"; message?: string };

            if (json.status === "ok") {
              setEstado({ kind: "ok", data: json.data });
              return;
            }
            // updating o error: reintentar.
            setEstado({ kind: "polling", attempt: estado.attempt + 1 });
          } catch {
            if (!cancelled) {
              setEstado({ kind: "polling", attempt: estado.attempt + 1 });
            }
          }
        })();
      },
      // El primer intento sale inmediatamente (sin delay) para no agregar
      // 3s al miss. Los siguientes esperan POLL_INTERVAL_MS.
      estado.attempt === 0 ? 0 : POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [estado, partidoId]);

  if (estado.kind === "ok") {
    return <CuotasGrid partidoId={partidoId} data={estado.data} />;
  }

  if (estado.kind === "empty" || estado.kind === "not-found") {
    return (
      <aside
        role="note"
        aria-label="Comparador de cuotas"
        className="my-6 overflow-hidden rounded-md border border-light bg-card shadow-sm"
      >
        <header className="border-b border-light bg-subtle px-5 py-3">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue-main">
            📊 Cuotas comparadas
          </span>
        </header>
        <div className="px-5 py-8 text-center">
          <p className="m-0 font-display text-[15px] font-bold text-dark">
            No hay cuotas disponibles para este partido
          </p>
          <p className="mx-auto mt-2 max-w-[420px] text-[13px] leading-[1.55] text-muted-d">
            Ninguna de las casas autorizadas por MINCETUR tiene cuotas
            publicadas todavía. Mientras tanto, conocé las casas habilitadas.
          </p>
          <a
            href="/casas"
            className="mt-4 inline-flex items-center gap-1.5 rounded-sm border border-light bg-card px-4 py-2 text-[12px] font-bold text-dark transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
          >
            Ver casas autorizadas
            <span aria-hidden>→</span>
          </a>
        </div>
      </aside>
    );
  }

  // estado.kind === "polling": skeleton mientras se pollea.
  return <Skeleton />;
}

function Skeleton() {
  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas (cargando)"
      aria-busy="true"
      className="my-6 overflow-hidden rounded-md border border-light bg-card shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-light bg-subtle px-5 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue-main">
          📊 Cuotas comparadas
        </span>
        <span className="text-[11px] font-bold text-muted-d">Cargando…</span>
      </header>
      <div className="space-y-4 px-5 py-5">
        <SkeletonSeccion cols={3} />
        <SkeletonSeccion cols={2} />
        <SkeletonSeccion cols={2} />
      </div>
    </aside>
  );
}

function SkeletonSeccion({ cols }: { cols: 2 | 3 }) {
  const items = Array.from({ length: cols });
  return (
    <div className="space-y-2">
      <div className="h-3 w-32 animate-pulse rounded bg-subtle" />
      <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md bg-subtle"
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
