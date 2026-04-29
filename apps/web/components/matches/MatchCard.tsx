// MatchCard — diseño compacto del card de torneo.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. Ya no mostramos pozos
// ni entrada — el footer del card muestra "X tipsters predijeron" +
// countdown. El card entero es un link a `/torneo/:id` (antes el CTA
// lateral abría ComboModal con info económica; ahora se removió).

import Link from "next/link";
import {
  formatKickoff,
  urgencyLevel,
  type UrgencyTier,
} from "@/lib/utils/datetime";
import { getTeamColor, getTeamInitials } from "@/lib/utils/team-colors";
import { CountdownLabel } from "./CountdownLabel";

export interface MatchCardData {
  id: string;
  liga: string;
  round: string | null;
  venue: string | null;
  equipoLocal: string;
  equipoVisita: string;
  totalInscritos: number;
  fechaInicio: Date;
  cierreAt: Date;
}

interface MatchCardProps {
  torneo: MatchCardData;
}

const URGENCY_TEXT_CLASS: Record<UrgencyTier, string> = {
  crit: "text-urgent-critical",
  high: "text-urgent-high",
  med: "text-brand-gold-dark",
  low: "text-muted-d",
};

const URGENCY_WEIGHT_CLASS: Record<UrgencyTier, string> = {
  crit: "font-extrabold",
  high: "font-bold",
  med: "font-semibold",
  low: "font-medium",
};

/**
 * Accent bar color por liga. Se aplica como `style.background` para
 * tintar contra fondos variables.
 */
function getLigaAccent(liga: string): string {
  const L = liga.toLowerCase();
  if (L.includes("mundial")) return "#8B5CF6";
  if (L.includes("champions")) return "#1E3A8A";
  if (L.includes("libertadores")) return "#059669";
  if (L.includes("premier")) return "#7C3AED";
  if (L.includes("la liga")) return "#DC2626";
  if (L.includes("liga 1") || L.includes("peru")) return "#B45309";
  return "#FFB800";
}

export function MatchCard({ torneo }: MatchCardProps) {
  const urgency = urgencyLevel(torneo.cierreAt);
  const kickoff = formatKickoff(torneo.fechaInicio);
  const accentColor = getLigaAccent(torneo.liga);
  const detalleHref = `/torneo/${torneo.id}`;

  return (
    <Link
      href={detalleHref}
      aria-label={`Ver detalle del torneo ${torneo.equipoLocal} vs ${torneo.equipoVisita}`}
      className="group relative flex flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md sm:flex-row"
    >
      {/* accent bar izquierda (desktop) / superior (mobile) */}
      <span
        aria-hidden
        className="h-1 w-full flex-shrink-0 sm:h-auto sm:w-1"
        style={{ background: accentColor }}
      />

      <div className="min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
        {/* header: liga·round + kickoff/countdown */}
        <header className="mb-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
              {torneo.liga.toUpperCase()}
              {torneo.round && (
                <>
                  <span className="mx-1.5 text-soft">·</span>
                  <span>{torneo.round.toUpperCase()}</span>
                </>
              )}
            </div>
            {torneo.venue && (
              <div className="truncate text-[11px] leading-snug text-soft">
                {torneo.venue}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end">
            <span className="font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-dark">
              {kickoff}
            </span>
            <span
              className={`text-[11px] ${URGENCY_TEXT_CLASS[urgency]} ${URGENCY_WEIGHT_CLASS[urgency]}`}
              data-testid="match-card-countdown"
            >
              <CountdownLabel cierreAt={torneo.cierreAt} />
            </span>
          </div>
        </header>

        {/* teams row */}
        <div className="my-2 flex items-center gap-3">
          <TeamAvatar name={torneo.equipoLocal} />
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold uppercase text-dark">
            {torneo.equipoLocal}
          </span>
          <span className="flex-shrink-0 font-display text-[15px] font-black text-soft">
            VS
          </span>
          <span className="min-w-0 flex-1 truncate text-right font-display text-[15px] font-extrabold uppercase text-dark">
            {torneo.equipoVisita}
          </span>
          <TeamAvatar name={torneo.equipoVisita} />
        </div>

        {/* footer: tipsters predijeron + CTA "Hacer mi predicción" */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-display text-[12px] font-bold uppercase tracking-[0.06em] text-muted-d">
            {torneo.totalInscritos.toLocaleString("es-PE")} tipster
            {torneo.totalInscritos === 1 ? "" : "s"} predijeron
          </span>
          <span className="font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-brand-blue-main">
            Hacer mi predicción →
          </span>
        </div>
      </div>
    </Link>
  );
}

function TeamAvatar({ name }: { name: string }) {
  const color = getTeamColor(name);
  const initials = getTeamInitials(name);
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-black uppercase shadow-sm"
      style={{ background: color.bg, color: color.fg }}
    >
      {initials}
    </div>
  );
}
