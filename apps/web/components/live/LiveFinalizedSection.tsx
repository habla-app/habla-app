// LiveFinalizedSection — lista de partidos finalizados recientes que se
// muestra debajo del switcher en vivo de `/live-match` (Hotfix #4 Bug
// #10). El switcher superior ahora SOLO muestra partidos en curso; los
// finalizados van en esta sección separada con cards de resumen.
//
// Diseño: usa los tokens de marca (`bg-card`, `border-light`, `brand-gold`)
// y mantiene el layout coherente con /matches (section-bar + grid de
// cards). Cada card linkea a `/live-match?torneoId=<id>` que rendera el
// mismo hero/ranking en modo post-partido.
//
// La sección NO se filtra por liga (Bug #10): la `LiveLeagueFilter` de
// Bug #11 aplica solo al switcher en vivo. Si el PO lo pide, se puede
// agregar un filter-chips propio para esta sección en el futuro.

import Link from "next/link";
import { getTeamColor } from "@/lib/utils/team-colors";

export interface FinalizedMatchCard {
  partidoId: string;
  torneoId: string;
  liga: string;
  round: string | null;
  equipoLocal: string;
  equipoVisita: string;
  golesLocal: number;
  golesVisita: number;
  fechaInicio: Date;
  totalInscritos: number;
  pozoBruto: number;
  ganadorNombre: string | null;
  ganadorPremio: number | null;
}

interface Props {
  matches: FinalizedMatchCard[];
}

function cortoNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length <= 12) return limpio;
  return limpio.split(/\s+/)[0] ?? limpio.slice(0, 10);
}

function formatearHoraLima(fecha: Date): string {
  return fecha.toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LiveFinalizedSection({ matches }: Props) {
  if (matches.length === 0) return null;

  return (
    <section
      className="mt-10"
      data-testid="live-finalized-section"
      aria-label="Partidos finalizados"
    >
      {/* Section bar — mismo pattern que /matches "🏆 Ya ganaron hoy" */}
      <div className="mb-4 flex items-center gap-4 rounded-r-sm border-l-[5px] border-brand-green bg-gradient-to-r from-brand-green/10 to-transparent px-4 py-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-green text-black shadow-md">
          <span aria-hidden className="text-[18px]">
            🏁
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] font-black uppercase leading-none tracking-[0.01em] text-dark">
            Partidos finalizados de hoy
          </div>
          <div className="mt-0.5 text-[12px] text-muted-d">
            Mirá cómo terminó el ranking · Entrá para ver los top 10
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full bg-brand-green px-3 py-1 font-display text-[13px] font-extrabold text-black">
          {matches.length}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <FinalizedCard key={m.partidoId} match={m} />
        ))}
      </div>
    </section>
  );
}

function FinalizedCard({ match }: { match: FinalizedMatchCard }) {
  const localColor = getTeamColor(match.equipoLocal);
  const visitaColor = getTeamColor(match.equipoVisita);
  return (
    <Link
      href={`/live-match?torneoId=${match.torneoId}`}
      className="group flex flex-col rounded-md border border-light bg-card p-4 shadow-sm transition-all hover:-translate-y-px hover:border-brand-gold/40 hover:shadow-md"
      data-testid={`finalized-card-${match.partidoId}`}
    >
      <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.06em]">
        <span className="truncate text-muted-d">
          🏆 {match.liga}
          {match.round && <> · {match.round}</>}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/15 px-2 py-0.5 text-brand-green">
          <span aria-hidden>✅</span>
          Final · {formatearHoraLima(match.fechaInicio)}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <TeamSide
          name={cortoNombre(match.equipoLocal)}
          bg={localColor.bg}
          fg={localColor.fg}
        />
        <div className="flex-shrink-0 text-center font-display text-[24px] font-black leading-none text-brand-gold-dark">
          {match.golesLocal}—{match.golesVisita}
        </div>
        <TeamSide
          name={cortoNombre(match.equipoVisita)}
          bg={visitaColor.bg}
          fg={visitaColor.fg}
          align="right"
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <Meta label="Jugadores" value={match.totalInscritos.toLocaleString("es-PE")} />
        <Meta label="Pozo" value={`${match.pozoBruto.toLocaleString("es-PE")} 🪙`} />
      </div>

      {match.ganadorNombre && match.ganadorPremio !== null && (
        <div className="mb-2 rounded-sm bg-brand-gold/10 px-2.5 py-1.5 text-[11px]">
          <span className="font-bold text-brand-gold-dark">🏆 1°</span>{" "}
          <span className="font-semibold text-dark">{match.ganadorNombre}</span>{" "}
          <span className="text-muted-d">
            · {match.ganadorPremio.toLocaleString("es-PE")} 🪙
          </span>
        </div>
      )}

      <div className="mt-auto text-right text-[12px] font-bold text-brand-blue-main transition-colors group-hover:text-brand-gold-dark">
        Ver resultado completo →
      </div>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </span>
      <span className="font-display text-[14px] font-extrabold text-dark">
        {value}
      </span>
    </div>
  );
}

function TeamSide({
  name,
  bg,
  fg,
  align = "left",
}: {
  name: string;
  bg: string;
  fg: string;
  align?: "left" | "right";
}) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const alignCls = align === "right" ? "flex-row-reverse text-right" : "";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${alignCls}`}>
      <div
        aria-hidden
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-[12px] font-black shadow-sm"
        style={{ background: bg, color: fg }}
      >
        {initials}
      </div>
      <div className="truncate font-display text-[13px] font-extrabold uppercase text-dark">
        {name}
      </div>
    </div>
  );
}
