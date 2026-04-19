"use client";
// StatsView — tab Estadísticas del /live-match. Compara las 7 métricas
// de home vs away con barras graduadas. Refresca cada 30s mientras la
// tab está visible.

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
      <div className="rounded-md border border-light bg-card p-6 text-center text-[13px] text-muted-d">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-md border border-light bg-card p-6 text-center text-[13px] text-muted-d">
        Cargando estadísticas…
      </div>
    );
  }

  const rows: Array<{ label: string; field: keyof EstadisticasPartidoLado; pct?: boolean }> = [
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
    <div className="rounded-md border border-light bg-card p-5 shadow-sm">
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] text-center text-[12px] font-bold uppercase tracking-[0.05em] text-muted-d">
        <div className="text-right">{equipoLocal}</div>
        <div>vs</div>
        <div className="text-left">{equipoVisita}</div>
      </div>
      <ul className="flex flex-col gap-3">
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
  const hPct = total > 0 ? Math.round((h / total) * 100) : 50;
  const aPct = total > 0 ? Math.round((a / total) * 100) : 50;
  return (
    <li>
      <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[13px] font-bold">
        <span className="text-right text-dark">
          {home ?? "—"}
          {pct && home !== null ? "%" : ""}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-d">
          {label}
        </span>
        <span className="text-left text-dark">
          {away ?? "—"}
          {pct && away !== null ? "%" : ""}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-subtle">
        <div
          className="bg-brand-blue-main"
          style={{ width: `${hPct}%` }}
          aria-hidden
        />
        <div
          className="bg-brand-gold"
          style={{ width: `${aPct}%` }}
          aria-hidden
        />
      </div>
    </li>
  );
}
