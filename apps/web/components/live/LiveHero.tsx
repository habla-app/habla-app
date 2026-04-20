"use client";
// LiveHero — hero oscuro estilo estadio con score gigante + stats.
// Replica `.live-hero` del mockup.
//
// Bug #9: el minuto ya no se renderiza como número crudo (con fallback
// literal "?" cuando era null). Ahora recibe `minutoLabel` listo para
// mostrar — el mapper `formatMinutoLabel` del backend traduce status
// codes de api-football (HT, ET, FT, PEN, etc.) a labels legibles.
// Si `minutoLabel` llega null (ej. antes del primer WS, cache stale),
// mostramos "—" — nunca "?".
//
// Hotfix #8 Bug #22: además del label server-rendered, aceptamos
// `statusShort` + `elapsed` + `snapshotUpdatedAt` para que el hook
// `useMinutoEnVivo` corra un reloj local que avance segundo a segundo
// en 1H/2H/ET entre ticks del poller (30s). El `minutoLabel` queda
// como fallback para SSR y estados fijos (HT/FT/PEN/...).

import { useMinutoEnVivo } from "@/hooks/useMinutoEnVivo";

interface LiveHeroProps {
  liga: string;
  round: string | null;
  estado: "EN_VIVO" | "FINALIZADO";
  equipoLocal: string;
  equipoVisita: string;
  golesLocal: number;
  golesVisita: number;
  /** Label ya renderizado ("23'", "ENT", "FIN", etc.). Si es null,
   *  mostramos "—". El hook useMinutoEnVivo lo usa como fallback. */
  minutoLabel: string | null;
  /** Hotfix #8 Bug #22: `fixture.status.short` del poller. Habilita el
   *  reloj local cuando es 1H/2H/ET. */
  statusShort: string | null;
  /** Hotfix #8 Bug #22: minuto anclado al snapshot del server. */
  elapsed: number | null;
  /** Hotfix #8 Bug #22: epoch ms del snapshot del server. Null si el
   *  cache no tiene datos del partido — en ese caso el hook degrada
   *  al fallbackLabel (label server-rendered). */
  snapshotUpdatedAt: number | null;
  totalInscritos: number;
  pozoNeto: number;
  primerPremio: number;
  ultimosEventos: Array<{
    tipo: string;
    minuto: number;
    equipo: string;
    jugador: string | null;
  }>;
}

export function LiveHero({
  liga,
  round,
  estado,
  equipoLocal,
  equipoVisita,
  golesLocal,
  golesVisita,
  minutoLabel,
  statusShort,
  elapsed,
  snapshotUpdatedAt,
  totalInscritos,
  pozoNeto,
  primerPremio,
  ultimosEventos,
}: LiveHeroProps) {
  const isLive = estado === "EN_VIVO";
  // Hotfix #8 Bug #22: reloj local. En estados fijos o sin snapshot,
  // el hook delega al fallback server-rendered.
  const labelRendered = useMinutoEnVivo({
    statusShort,
    elapsed,
    snapshotUpdatedAt,
    fallbackLabel: minutoLabel,
  });
  return (
    <section className="relative mb-5 overflow-hidden rounded-lg bg-stadium p-6 text-white shadow-xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/70">
          🏆 {liga}
          {round && <> · {round}</>}
        </div>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-urgent-critical px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
            <span
              aria-hidden
              className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-white"
            />
            En vivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-black">
            ✅ Finalizado
          </span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <TeamSide name={equipoLocal} />
        <ScoreBox
          local={golesLocal}
          visita={golesVisita}
          label={labelRendered}
          isLive={isLive}
        />
        <TeamSide name={equipoVisita} align="right" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeroStat value={totalInscritos.toLocaleString("es-PE")} label="Jugadores" />
        <HeroStat
          value={`${pozoNeto.toLocaleString("es-PE")} 🪙`}
          label="Pozo neto"
        />
        <HeroStat
          value={`${primerPremio.toLocaleString("es-PE")} 🪙`}
          label="1er premio"
        />
        <HeroStat value="21 pts" label="Máximo" />
      </div>

      {ultimosEventos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/60">
            ⚽ Eventos
          </span>
          {ultimosEventos.slice(0, 5).map((e, i) => (
            <span
              key={i}
              className={`rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ${
                e.tipo === "GOL"
                  ? "bg-brand-green/20"
                  : e.tipo === "TARJETA_ROJA"
                    ? "bg-urgent-critical/25"
                    : ""
              }`}
            >
              {iconoEvento(e.tipo)} {e.minuto}&apos; {e.jugador ?? ""}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamSide({
  name,
  align = "left",
}: {
  name: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        aria-hidden
        className={`mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-dark-card-2 text-[22px] font-black ${
          align === "right" ? "" : ""
        }`}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="font-display text-[18px] font-extrabold uppercase leading-tight">
        {name}
      </div>
    </div>
  );
}

function ScoreBox({
  local,
  visita,
  label,
  isLive,
}: {
  local: number;
  visita: number;
  /** Label renderizado — "23'", "ENT", "FIN", "—". Nunca "?". */
  label: string;
  isLive: boolean;
}) {
  return (
    <div className="text-center" data-testid="live-score-box">
      <div className="font-display text-[56px] font-black leading-none text-brand-gold">
        {local} — {visita}
      </div>
      <div className="mt-2 text-[12px] font-bold uppercase tracking-[0.06em] text-white/70">
        {isLive ? (
          <>
            <span aria-hidden>⏱ </span>
            <span data-testid="live-minute-label">{label}</span>
          </>
        ) : (
          "Final"
        )}
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-dark-card px-3 py-2.5">
      <div className="font-display text-[18px] font-black leading-none text-brand-gold">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/60">
        {label}
      </div>
    </div>
  );
}

function iconoEvento(tipo: string): string {
  if (tipo === "GOL") return "⚽";
  if (tipo === "TARJETA_ROJA") return "🟥";
  if (tipo === "TARJETA_AMARILLA") return "🟨";
  if (tipo === "SUSTITUCION") return "🔁";
  if (tipo === "FIN_PARTIDO") return "🏁";
  return "⭐";
}
