// MatchGroup — agrupa todos los tickets del usuario en un mismo partido.
// Replica `.match-group` del mockup. Variantes:
//   - live    → partido EN_JUEGO
//   - scheduled → partido PROGRAMADO (torneo ABIERTO o CERRADO)
//   - won-group → al menos un ticket ganó premio
//   - neutral → FINALIZADO sin premio
//
// Este es un Client Component porque el CTA "+ Otra combinada" abre
// el ComboModal y necesita session → ComboLauncher.

"use client";
import Link from "next/link";
import { TicketCard } from "./TicketCard";
import { ComboLauncher } from "@/components/combo/ComboLauncher";
import type { TicketConContexto } from "./adapter";
import { premioEstimadoSinEmpate } from "@/lib/utils/premios-distribucion";

interface MatchGroupProps {
  tickets: TicketConContexto[];
  hasSession: boolean;
  /** Ranking en vivo para este torneo (para mostrar posición actual). */
  livePositions?: Record<string, { posicion: number; puntos: number }>;
  /** Score en vivo (Partido.golesLocal/Visita). */
  scoreLive?: { local: number; visita: number } | null;
  /** Minuto actual si el partido está EN_VIVO. */
  minutoLive?: number | null;
}

export function MatchGroup({
  tickets,
  hasSession,
  livePositions = {},
  scoreLive = null,
  minutoLive = null,
}: MatchGroupProps) {
  if (tickets.length === 0) return null;
  const first = tickets[0]!;
  const { torneo } = first;
  const { partido } = torneo;
  const estado = torneo.estado;

  const isLive = estado === "EN_JUEGO";
  const isScheduled = estado === "ABIERTO" || estado === "CERRADO";
  const anyWinner = tickets.some((t) => t.premioLukas > 0);
  const isFinalized = estado === "FINALIZADO" || estado === "CANCELADO";

  let variant: "live" | "scheduled" | "won" | "neutral" = "neutral";
  if (anyWinner) variant = "won";
  else if (isLive) variant = "live";
  else if (isScheduled) variant = "scheduled";

  const outerCls =
    variant === "live"
      ? "border-2 border-urgent-critical shadow-[0_6px_18px_rgba(255,46,46,0.12)]"
      : variant === "scheduled"
        ? "border-[1.5px] border-urgent-high shadow-[0_4px_12px_rgba(255,122,0,0.1)]"
        : variant === "won"
          ? "border-2 border-brand-gold bg-gradient-to-br from-white to-[#FFFDF5] shadow-gold"
          : "border border-light";

  const headBg =
    variant === "live"
      ? "bg-[#FFF5F5]"
      : variant === "scheduled"
        ? "bg-[#FFFBF5]"
        : variant === "won"
          ? "bg-[#FFF5E0]"
          : "bg-subtle";

  const scoreLocal = scoreLive?.local ?? partido.golesLocal ?? 0;
  const scoreVisita = scoreLive?.visita ?? partido.golesVisita ?? 0;
  const hayScore = isLive || partido.estado === "FINALIZADO";
  const kickoffLabel = formatKickoff(partido.fechaInicio);

  return (
    <div
      className={`mb-4 overflow-hidden rounded-lg bg-card ${outerCls}`}
    >
      {variant === "live" && (
        <span
          aria-hidden
          className="block h-1 animate-shimmer bg-gradient-to-r from-urgent-critical via-brand-gold to-urgent-critical bg-[length:200%_100%]"
        />
      )}

      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${headBg}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill variant={variant} estado={estado} minutoLive={minutoLive} />
          <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-muted-d">
            {partido.liga}
            {partido.round && <> · {partido.round}</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <Link
              href={`/live-match?torneoId=${torneo.id}`}
              className="rounded-sm bg-urgent-critical px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-urgent-critical-hover"
            >
              Ver ranking en vivo →
            </Link>
          )}
          {variant === "scheduled" && hasSession && (
            <ComboLauncher
              torneoId={torneo.id}
              hasSession={hasSession}
              callbackUrl="/mis-combinadas"
              label="+ Otra combinada"
              variant="ghost"
              className="py-2 text-[12px]"
            />
          )}
          {variant === "won" && (
            <Link
              href={`/live-match?torneoId=${torneo.id}`}
              className="text-[12px] font-bold text-brand-blue-main hover:underline"
            >
              Ver resultado →
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-b border-light bg-card py-3">
        <span className="font-display text-[17px] font-extrabold uppercase text-dark">
          {partido.equipoLocal}
        </span>
        <span
          className={`rounded-sm px-3 py-1 font-display text-[20px] font-black ${
            hayScore
              ? "bg-dark-surface text-white"
              : "bg-brand-blue-main/10 text-muted-d"
          }`}
        >
          {hayScore ? `${scoreLocal} — ${scoreVisita}` : "VS"}
        </span>
        <span className="font-display text-[17px] font-extrabold uppercase text-dark">
          {partido.equipoVisita}
        </span>
      </div>

      <div className="px-5 py-3">
        {variant === "scheduled" && !isLive && (
          <div className="mb-2 text-[12px] text-muted-d">
            {kickoffLabel}
          </div>
        )}
        {tickets.map((t, idx) => {
          const live = livePositions[t.id];
          const posicion = live?.posicion ?? t.posicionFinal;
          const puntos = live?.puntos ?? t.puntosTotal;
          const inTop = posicion !== null && posicion !== undefined && posicion <= 10;
          const pending =
            t.torneo.estado === "ABIERTO" || t.torneo.estado === "CERRADO";
          const isWinner = t.premioLukas > 0;
          const premioEstimado = inTop
            ? estimarPremio(t.torneo.pozoBruto, posicion ?? 0, t.torneo.totalInscritos)
            : 0;
          return (
            <TicketCard
              key={t.id}
              ticket={t}
              numero={idx + 1}
              total={tickets.length}
              posicion={posicion ?? null}
              puntos={puntos}
              premioEstimado={premioEstimado}
              premioFinal={t.premioLukas}
              isWinner={isWinner}
              inTop={inTop}
              pending={pending}
              equipoLocal={partido.equipoLocal}
              equipoVisita={partido.equipoVisita}
            />
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({
  variant,
  estado,
  minutoLive,
}: {
  variant: "live" | "scheduled" | "won" | "neutral";
  estado: string;
  minutoLive: number | null | undefined;
}) {
  if (variant === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-urgent-critical px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-white">
        <span
          aria-hidden
          className="h-[6px] w-[6px] animate-pulse-dot rounded-full bg-white"
        />
        En vivo{minutoLive !== null && minutoLive !== undefined ? ` · ${minutoLive}'` : ""}
      </span>
    );
  }
  if (variant === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-urgent-high px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-white">
        <span aria-hidden>⏰</span>
        {estado === "CERRADO" ? "Cerrado · Arranca pronto" : "Abierto"}
      </span>
    );
  }
  if (variant === "won") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-black">
        <span aria-hidden>🏆</span>
        Ganaste
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-d">
      {estado === "CANCELADO" ? "Cancelado" : "Finalizado"}
    </span>
  );
}

function estimarPremio(
  pozoBruto: number,
  posicion: number,
  totalInscritos: number,
): number {
  // Hotfix #6: usa la curva top-heavy del helper puro. El "SinEmpate"
  // asume que el jugador es único en la posición — para mostrar un
  // estimado optimista en /mis-combinadas. El valor real con empates se
  // calcula en /live-match via listarRanking.
  const pozoNeto = Math.floor(pozoBruto * 0.88);
  return premioEstimadoSinEmpate(posicion, totalInscritos, pozoNeto);
}

function formatKickoff(d: Date | string): string {
  const date = new Date(d);
  // Timezone America/Lima explícita (CLAUDE.md §14)
  return (
    "Arranca " +
    date.toLocaleString("es-PE", {
      timeZone: "America/Lima",
      weekday: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  );
}
