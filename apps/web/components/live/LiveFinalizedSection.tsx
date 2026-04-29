// LiveFinalizedSection — sección de "🏁 Partidos finalizados de hoy"
// que aparece debajo del switcher en vivo de /live-match.
//
// Hotfix #4 Bug #10 introdujo la sección. Hotfix #5 Bug #16 la
// enriquece: cada card ahora muestra las 5 predicciones del ganador
// como mini-chips coloreadas por acierto (verde) o fallo (rojo),
// además del nombre + premio que ya estaban. Al clickear la card
// → `/live-match?torneoId=<id>` rendera el mismo hero/ranking en modo
// post-partido, con banda motivacional al final (LiveMatchView).
//
// La sección NO se filtra por liga (decisión del PO del Bug #11).

import Link from "next/link";
import { getTeamColor } from "@/lib/utils/team-colors";

export type EstadoChipFinalizado = "correct" | "wrong" | "pending";

export interface GanadorPreview {
  nombre: string;
  puntos: number;
  /** 5 mini-chips con la predicción + resultado final. */
  chips: Array<{ label: string; estado: EstadoChipFinalizado }>;
}

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
  /**
   * Ganador del torneo (top 1). Null si no hubo tickets.
   */
  ganador: GanadorPreview | null;
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
            Mirá cómo jugó la gente real · Entrá para ver el top 10 completo
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

      <div className="mb-3 grid grid-cols-1 gap-2 text-[11px]">
        <Meta
          label="Tipsters"
          value={match.totalInscritos.toLocaleString("es-PE")}
        />
      </div>

      {match.ganador ? (
        <WinnerPreview ganador={match.ganador} />
      ) : (
        <div className="mb-2 rounded-sm border border-dashed border-light px-2.5 py-2 text-center text-[11px] text-muted-d">
          Sin ganadores registrados
        </div>
      )}

      <div className="mt-auto pt-2 text-right text-[12px] font-bold text-brand-blue-main transition-colors group-hover:text-brand-gold-dark">
        Ver resultado completo →
      </div>
    </Link>
  );
}

function WinnerPreview({ ganador }: { ganador: GanadorPreview }) {
  return (
    <div
      className="mb-2 rounded-sm bg-brand-gold/10 px-2.5 py-2"
      data-testid="finalized-card-winner"
    >
      <div className="mb-1.5 flex items-center gap-2 text-[11px]">
        <span aria-hidden className="text-[14px]">
          🏆
        </span>
        <span className="font-bold text-brand-gold-dark">1°</span>
        <span className="truncate font-semibold text-dark">{ganador.nombre}</span>
        <span className="ml-auto flex-shrink-0 font-display text-[13px] font-black text-brand-gold-dark">
          {ganador.puntos} pts
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {ganador.chips.map((c, idx) => (
          <span
            key={idx}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              c.estado === "correct"
                ? "bg-pred-correct-bg text-pred-correct"
                : c.estado === "wrong"
                  ? "bg-pred-wrong-bg text-pred-wrong"
                  : "bg-pred-pending-bg text-muted-d"
            }`}
            data-testid={`finalized-winner-chip-${c.estado}`}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
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
