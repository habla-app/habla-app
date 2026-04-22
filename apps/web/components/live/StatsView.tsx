"use client";
// StatsView — tab Estadísticas (/live-match). Mockup `.stats-comparison`:
// teams row arriba + lista de métricas con barras graduadas home/away
// (azul vs rojo/naranja). Refresca cada 30s.

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { EstadisticasPartidoLado } from "@/lib/services/eventos.mapper";

interface StatsViewProps {
  partidoId: string;
  equipoLocal: string;
  equipoVisita: string;
}

interface StatsPayload {
  home: EstadisticasPartidoLado;
  away: EstadisticasPartidoLado;
}

const REFRESH_MS = 30_000;

export function StatsView({
  partidoId,
  equipoLocal,
  equipoVisita,
}: StatsViewProps) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await authedFetch(`/api/v1/partidos/${partidoId}/stats`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          setError(errJson?.error?.message ?? "No se pudo cargar stats");
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json.data);
        setError(null);
      } catch {
        setError("Error de red.");
      }
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [partidoId]);

  if (error) {
    return (
      <div className="rounded-md border border-light bg-card p-6 text-center text-sm text-muted-d shadow-sm">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-md border border-light bg-card p-6 text-center text-sm text-muted-d shadow-sm">
        Cargando estadísticas…
      </div>
    );
  }

  const rows: Array<{
    label: string;
    field: keyof EstadisticasPartidoLado;
    pct?: boolean;
  }> = [
    { label: "Posesión", field: "posesion", pct: true },
    { label: "Tiros totales", field: "tiros" },
    { label: "Tiros al arco", field: "tirosAlArco" },
    { label: "Tarjetas", field: "tarjetas" },
    { label: "Córners", field: "corners" },
    { label: "Faltas", field: "faltas" },
    { label: "Offsides", field: "offsides" },
    { label: "Pases", field: "pases" },
  ];

  return (
    <div className="rounded-md border border-light bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between border-b border-light pb-3.5">
        <div className="flex items-center gap-2 font-display text-sm font-black uppercase text-dark">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue-main to-brand-blue-mid text-sm"
          >
            🔵
          </span>
          {equipoLocal}
        </div>
        <div className="flex flex-row-reverse items-center gap-2 font-display text-sm font-black uppercase text-dark">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-urgent-critical to-brand-orange text-sm"
          >
            🔴
          </span>
          {equipoVisita}
        </div>
      </div>
      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const homeVal = data.home[r.field];
          const awayVal = data.away[r.field];
          return (
            <StatRow
              key={r.label}
              label={r.label}
              home={homeVal}
              away={awayVal}
              pct={r.pct}
            />
          );
        })}
      </ul>
    </div>
  );
}

function StatRow({
  label,
  home,
  away,
  pct = false,
}: {
  label: string;
  home: number | null;
  away: number | null;
  pct?: boolean;
}) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = pct ? 100 : h + a;
  const hPct = total > 0 ? Math.round((h / total) * 100) : 0;
  const aPct = total > 0 ? 100 - hPct : 0;
  const tied = h === 0 && a === 0;

  return (
    <li className="grid grid-cols-[60px_1fr_60px] items-center gap-3.5">
      <div className="text-right font-display text-xl font-black leading-none text-dark">
        {home ?? "—"}
        {pct && home !== null ? "%" : ""}
      </div>
      <div className="flex flex-col items-center">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-d">
          {label}
        </div>
        <div
          className={`relative flex h-2 w-full overflow-hidden rounded-full bg-subtle ${tied ? "justify-center" : ""}`}
        >
          <div
            aria-hidden
            className="h-full bg-gradient-to-r from-brand-blue-main to-brand-blue-light"
            style={{ width: `${hPct}%`, borderRadius: "999px 0 0 999px" }}
          />
          <div
            aria-hidden
            className="ml-auto h-full bg-gradient-to-r from-urgent-critical to-brand-orange"
            style={{ width: `${aPct}%`, borderRadius: "0 999px 999px 0" }}
          />
        </div>
      </div>
      <div className="text-left font-display text-xl font-black leading-none text-dark">
        {away ?? "—"}
        {pct && away !== null ? "%" : ""}
      </div>
    </li>
  );
}
