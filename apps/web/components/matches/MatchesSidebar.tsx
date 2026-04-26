// Sidebar sticky — réplica del mockup + rediseño Abr 2026.
//
// Orden (top→bottom):
//   1. 🔴 En vivo ahora
//   2. 🏆 Los Pozos más grandes de la semana (torneos de la semana calendario
//      ordenados por pozoBruto DESC, top 5)
//   3. 🪙 Tu balance (rediseñado, tipografía grande + CTA /wallet)
//   4. 📐 Cómo se pagan los premios (PrizeRulesCard)
//   5. 🏅 Los más pagados de la semana (suma de premios de torneo por
//      usuario en la semana calendario, top 10)
//
// Se comparte entre `/` (landing) y `/matches`. Los widgets de en vivo,
// pozos y más pagados son iguales con o sin sesión; el de balance muta:
// con sesión muestra hero + CTAs, sin sesión muestra un mensaje con CTA
// a /auth/signin.
//
// Server Component — llama a auth() y a los services de ranking +
// live-matches + stats-semana. El widget de balance delega a
// `SidebarBalanceWidget` (client) para mantener el store de Lukas
// sincronizado (Hotfix #5 Bug #14).
import Link from "next/link";
import { auth } from "@/lib/auth";
import { obtenerBalanceGanadas } from "@/lib/usuarios";
import { listarRanking } from "@/lib/services/ranking.service";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";
import {
  listarMasPagadosSemana,
  listarPozosMasGrandesSemana,
  type MasPagadoSemanaRow,
  type PozoSemanaRow,
} from "@/lib/services/stats-semana.service";
import { getTeamColor } from "@/lib/utils/team-colors";
import { SidebarBalanceWidget } from "@/components/matches/SidebarBalanceWidget";
import { PrizeRulesCard } from "@/components/matches/PrizeRulesCard";

// ---------------------------------------------------------------------------
// Live matches
// ---------------------------------------------------------------------------

interface LiveMini {
  id: string;
  torneoId: string | null;
  liga: string;
  round: string | null;
  equipoLocal: string;
  equipoLocalBg: string;
  equipoLocalFg: string;
  equipoVisita: string;
  equipoVisitaBg: string;
  equipoVisitaFg: string;
  marcador: string; /* "1—2" */
  lead?: {
    nombre: string;
    puntos: number;
    totalJugadores: number;
  };
}

async function fetchLiveMatches(): Promise<LiveMini[]> {
  const partidos = await obtenerLiveMatches({
    limit: 3,
    incluirFinalizados: false,
  });

  const out: LiveMini[] = [];
  for (const p of partidos) {
    const torneo = elegirTorneoPrincipal(p.torneos);
    let lead: LiveMini["lead"];
    if (torneo) {
      try {
        const r = await listarRanking(torneo.id, { limit: 1 });
        const top = r.ranking[0];
        if (top) {
          lead = {
            nombre: top.nombre,
            puntos: top.puntosTotal,
            totalJugadores: r.totalInscritos,
          };
        }
      } catch {
        // Ignorar: el widget se muestra sin líder
      }
    }
    const localColor = getTeamColor(p.equipoLocal);
    const visitaColor = getTeamColor(p.equipoVisita);
    out.push({
      id: torneo?.id ?? p.id,
      torneoId: torneo?.id ?? null,
      liga: p.liga,
      round: p.round,
      equipoLocal: cortoNombre(p.equipoLocal),
      equipoLocalBg: localColor.bg,
      equipoLocalFg: localColor.fg,
      equipoVisita: cortoNombre(p.equipoVisita),
      equipoVisitaBg: visitaColor.bg,
      equipoVisitaFg: visitaColor.fg,
      marcador: `${p.golesLocal ?? 0}—${p.golesVisita ?? 0}`,
      lead,
    });
  }
  return out;
}

function cortoNombre(nombre: string): string {
  const n = nombre.trim();
  if (n.length <= 10) return n;
  return n.split(/\s+/)[0] ?? n.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export async function MatchesSidebar() {
  const session = await auth();
  const balance = session?.user?.balanceLukas ?? null;
  const userId = session?.user?.id ?? null;

  const [liveMatches, pozosSemana, masPagadosSemana, balanceGanadas] =
    await Promise.all([
      fetchLiveMatches(),
      listarPozosMasGrandesSemana({ limit: 5 }),
      listarMasPagadosSemana({ limit: 10 }),
      userId ? obtenerBalanceGanadas(userId) : Promise.resolve(0),
    ]);

  return (
    <aside className="flex flex-col gap-3.5">
      <LiveAhoraWidget matches={liveMatches} />
      <PozosSemanaWidget rows={pozosSemana} />
      <SidebarBalanceWidget initialBalance={balance} initialBalanceGanadas={balanceGanadas} />
      <PrizeRulesCard />
      <MasPagadosSemanaWidget rows={masPagadosSemana} />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Widget 1: 🔴 En vivo ahora
// ---------------------------------------------------------------------------

function LiveAhoraWidget({ matches }: { matches: LiveMini[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      {/* widget-head.live — dark gradient */}
      <div className="flex items-center gap-2 border-b border-dark-border bg-widget-live-head px-3.5 py-3 text-white">
        <span aria-hidden className="text-[15px]">
          🔴
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-white">
          En vivo ahora
        </span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.04em] text-dark-muted">
          {matches.length} partido{matches.length === 1 ? "" : "s"}
        </span>
      </div>

      {matches.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-muted-d">
          No hay partidos en vivo ahora mismo.
        </div>
      ) : (
        matches.map((m, idx) => (
          <LiveMiniCard
            key={m.id}
            match={m}
            withBottomBorder={idx < matches.length - 1}
          />
        ))
      )}
    </section>
  );
}

function LiveMiniCard({
  match,
  withBottomBorder,
}: {
  match: LiveMini;
  withBottomBorder: boolean;
}) {
  const href = match.torneoId
    ? `/live-match?torneoId=${match.torneoId}`
    : "/live-match";
  return (
    <Link
      href={href}
      className={`block px-3.5 py-3.5 transition-colors hover:bg-subtle ${withBottomBorder ? "border-b border-light" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          🏆 {match.liga}
          {match.round && <> · {match.round}</>}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-urgent-critical">
          <span
            aria-hidden
            className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-urgent-critical"
          />
          En vivo
        </span>
      </div>

      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <TeamMini
          name={match.equipoLocal}
          bg={match.equipoLocalBg}
          fg={match.equipoLocalFg}
        />
        <div className="flex-shrink-0 text-center">
          <div className="min-w-[48px] font-display text-[20px] font-black leading-none text-brand-gold-dark">
            {match.marcador}
          </div>
          <div className="text-[10px] text-muted-d">
            <span aria-hidden>⏱</span> live
          </div>
        </div>
        <TeamMini
          name={match.equipoVisita}
          bg={match.equipoVisitaBg}
          fg={match.equipoVisitaFg}
          align="right"
        />
      </div>

      {match.lead && (
        <div className="mb-2 flex items-center gap-2 rounded-sm bg-subtle px-2.5 py-2">
          <div
            aria-hidden
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue-main text-[10px] font-bold text-white"
          >
            {match.lead.nombre.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Puntea · {match.lead.totalJugadores} jug.
            </div>
            <div className="truncate text-[12px] font-bold text-dark">
              {match.lead.nombre}
            </div>
          </div>
          <div className="font-display text-[16px] font-black text-brand-gold-dark">
            {match.lead.puntos}
          </div>
        </div>
      )}

      <div className="block py-1 text-center text-[12px] font-bold text-brand-blue-main">
        Ver ranking completo →
      </div>
    </Link>
  );
}

function TeamMini({
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
  const alignCls = align === "right" ? "flex-row-reverse text-right" : "";
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${alignCls}`}>
      <div
        aria-hidden
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-[11px] font-black shadow-sm"
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

// ---------------------------------------------------------------------------
// Widget 2: 🏆 Los Pozos más grandes de la semana
// ---------------------------------------------------------------------------

function PozosSemanaWidget({ rows }: { rows: PozoSemanaRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-light bg-section-finalized px-3.5 py-3">
        <span aria-hidden className="text-[15px]">
          🏆
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Los Pozos más grandes de la semana
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-muted-d">
          Aún no hay torneos grandes esta semana.
        </div>
      ) : (
        <ul>
          {rows.map((row, idx) => (
            <li
              key={row.torneoId}
              className={`flex items-center justify-between gap-2 px-3.5 py-2.5 ${idx < rows.length - 1 ? "border-b border-light" : ""}`}
            >
              <div className="min-w-0">
                <div className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
                  {row.liga}
                </div>
                <div className="truncate font-display text-[13px] font-extrabold uppercase text-dark">
                  {row.resumenPartido}
                </div>
              </div>
              <div className="flex-shrink-0 rounded-sm bg-brand-gold-dim px-2.5 py-1 font-display text-[12px] font-black text-brand-gold-dark">
                {row.pozoBruto.toLocaleString("es-PE")} 🪙
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Widget 5: 🏅 Los más pagados de la semana
// ---------------------------------------------------------------------------

function MasPagadosSemanaWidget({ rows }: { rows: MasPagadoSemanaRow[] }) {
  const posColor = (pos: number) => {
    if (pos === 1) return "text-medal-gold";
    if (pos === 2) return "text-medal-silver";
    if (pos === 3) return "text-medal-bronze";
    return "text-muted-d";
  };

  return (
    <section className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-light bg-widget-top-head px-3.5 py-3">
        <span aria-hidden className="text-[15px]">
          🏅
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Los más pagados de la semana
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-muted-d">
          Aún no hay premios pagados esta semana.
        </div>
      ) : (
        rows.map((row, idx) => (
          <div
            key={row.usuarioId}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 ${idx < rows.length - 1 ? "border-b border-light" : ""}`}
          >
            <span
              className={`w-5 text-center font-display text-[15px] font-black ${posColor(idx + 1)}`}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-extrabold text-dark">
                @{row.username}
              </div>
            </div>
            <span className="flex-shrink-0 font-display text-[14px] font-black text-brand-gold-dark">
              {row.totalGanado.toLocaleString("es-PE")} 🪙
            </span>
          </div>
        ))
      )}
    </section>
  );
}

// Widget 3 (🪙 Tu balance) vive en SidebarBalanceWidget.tsx — Client
// Component que consume `useLukasStore` (Bug #14). Sidebar server pasa
// `initialBalance={session?.user?.balanceLukas ?? null}`.
