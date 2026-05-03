// FijasList — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § page-fijas-list (mobile cards + desktop table).
//
// Renderiza la lista de Las Fijas con paridad mobile + desktop:
//   - Mobile: cards verticales apiladas (`md:hidden`)
//   - Desktop: tabla densa (`hidden md:block`)
// Cada partido linkea a /las-fijas/[slug].

import Link from "next/link";
import { Badge } from "@/components/ui";
import type { FijaListItem } from "@/lib/services/las-fijas.service";

interface Props {
  partidos: FijaListItem[];
}

export function FijasList({ partidos }: Props) {
  if (partidos.length === 0) {
    return <FijasEmpty />;
  }
  return (
    <>
      <FijasCardsMobile partidos={partidos} />
      <FijasTableDesktop partidos={partidos} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobile — cards verticales
// ---------------------------------------------------------------------------

function FijasCardsMobile({ partidos }: Props) {
  return (
    <ul className="space-y-3 md:hidden" aria-label="Próximas fijas">
      {partidos.map((p) => (
        <li key={p.id}>
          <FijaCard partido={p} />
        </li>
      ))}
    </ul>
  );
}

function FijaCard({ partido }: { partido: FijaListItem }) {
  const enVivo = partido.estado === "EN_VIVO";
  const probPct =
    partido.probabilidadPronostico !== null
      ? Math.round(partido.probabilidadPronostico * 100)
      : null;
  return (
    <Link
      href={`/las-fijas/${partido.slug}`}
      className={`block rounded-md border bg-card shadow-sm transition-all hover:-translate-y-px hover:shadow-md ${
        enVivo
          ? "border-light border-l-[4px] border-l-urgent-critical"
          : "border-light"
      }`}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-label-sm uppercase tracking-[0.04em] text-muted-d">
            🏆 {partido.liga} · {formatFechaCorta(partido.fechaInicio)}
          </p>
          <p className="line-clamp-1 font-display text-display-xs font-bold text-dark">
            {partido.equipoLocal} vs {partido.equipoVisita}
          </p>
        </div>
        <BadgeFila enVivo={enVivo} pron={partido.pronostico1x2} probPct={probPct} />
      </div>
    </Link>
  );
}

function BadgeFila({
  enVivo,
  pron,
  probPct,
}: {
  enVivo: boolean;
  pron: "LOCAL" | "EMPATE" | "VISITA" | null;
  probPct: number | null;
}) {
  if (enVivo) {
    return (
      <Badge variant="live" size="sm">
        ● EN VIVO
      </Badge>
    );
  }
  if (pron && probPct !== null) {
    const label =
      pron === "LOCAL" ? "Local" : pron === "EMPATE" ? "Empate" : "Visita";
    return (
      <span className="rounded-full bg-brand-blue-main/10 px-2.5 py-1 font-display text-label-sm font-bold text-brand-blue-main">
        {label} {probPct}%
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Desktop — tabla densa
// ---------------------------------------------------------------------------

function FijasTableDesktop({ partidos }: Props) {
  return (
    <div className="hidden md:block">
      <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-light bg-subtle/60">
            <tr className="text-label-sm uppercase tracking-[0.04em] text-muted-d">
              <th className="px-4 py-3 font-bold">Liga · Hora</th>
              <th className="px-4 py-3 font-bold">Partido</th>
              <th className="px-4 py-3 text-center font-bold">Pronóstico Habla!</th>
              <th className="px-4 py-3 text-right font-bold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {partidos.map((p) => (
              <FilaTabla key={p.id} partido={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaTabla({ partido }: { partido: FijaListItem }) {
  const enVivo = partido.estado === "EN_VIVO";
  const finalizado = partido.estado === "FINALIZADO";
  const probPct =
    partido.probabilidadPronostico !== null
      ? Math.round(partido.probabilidadPronostico * 100)
      : null;
  return (
    <tr
      className={`border-b border-light/60 transition-colors hover:bg-subtle/50 ${
        enVivo ? "bg-urgent-critical-bg/30" : ""
      }`}
    >
      <td className="px-4 py-3 align-middle">
        <p className="text-label-sm font-bold uppercase tracking-[0.04em] text-dark">
          {partido.liga}
        </p>
        <p className="text-body-xs text-muted-d">
          {formatFechaCorta(partido.fechaInicio)}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        <p className="font-display text-label-md font-bold text-dark">
          {partido.equipoLocal} vs {partido.equipoVisita}
        </p>
        {finalizado && partido.golesLocal !== null && partido.golesVisita !== null ? (
          <p className="text-body-xs text-muted-d">
            Final · {partido.golesLocal}-{partido.golesVisita}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-center align-middle">
        {enVivo ? (
          <Badge variant="live" size="sm">
            ● EN VIVO
          </Badge>
        ) : partido.pronostico1x2 && probPct !== null ? (
          <span className="rounded-full bg-brand-blue-main/10 px-3 py-1 font-display text-label-sm font-bold text-brand-blue-main">
            {pronLabel(partido.pronostico1x2)} {probPct}%
          </span>
        ) : (
          <span className="text-body-xs text-muted-d">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <Link
          href={`/las-fijas/${partido.slug}`}
          className="inline-flex items-center gap-1 rounded-sm border border-strong bg-card px-3 py-1.5 font-display text-label-sm font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Análisis →
        </Link>
      </td>
    </tr>
  );
}

function pronLabel(p: "LOCAL" | "EMPATE" | "VISITA"): string {
  return p === "LOCAL" ? "Local" : p === "EMPATE" ? "Empate" : "Visita";
}

function formatFechaCorta(d: Date): string {
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

function FijasEmpty() {
  return (
    <div className="mx-auto max-w-[640px] rounded-md border border-light bg-card px-5 py-12 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-5xl">
        🌙
      </div>
      <p className="m-0 font-display text-display-md text-dark">
        Hoy no hay fijas cubiertas
      </p>
      <p className="mx-auto mt-3 max-w-[480px] text-body-sm leading-[1.55] text-muted-d">
        Estamos esperando que arranquen las próximas fechas de las ligas
        cubiertas. Mientras tanto, mirá quiénes están peleando el ranking del
        mes en la Liga Habla!.
      </p>
      <Link
        href="/liga"
        className="touch-target mt-5 inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-5 py-2.5 text-label-md text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        Ver el ranking del mes →
      </Link>
    </div>
  );
}
