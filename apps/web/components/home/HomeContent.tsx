"use client";

// HomeContent — landing simplificada previa al Sub-Sprint 3.
// Migrada en Phase 2 al sistema light del mockup v5:
//   - Fondo light (hereda de bg-page en el layout)
//   - HeroLive se mantiene como card "dark stadium vibe"
//   - Ranking, MatchCards y FilterChips pasan a light con border-light
//   - Badges por tipo de torneo usan tokens accent.*/brand-gold tokens
//
// El BottomNav vive en el layout; aquí NO se renderiza.
import { useState } from "react";

// --- Mock Data (sigue igual hasta Sub-Sprint 3) ---

const LIVE_MATCH = {
  league: "Champions League — Cuartos",
  leagueIcon: "🏆",
  homeTeam: "Man. United",
  awayTeam: "Real Madrid",
  homeIcon: "🔴",
  awayIcon: "⚪",
  homeColor: "from-red-900 to-red-600",
  awayColor: "from-blue-900 to-blue-600",
  homeScore: 1,
  awayScore: 2,
  minute: 67,
  players: 312,
  pot: "27.4K",
  firstPrize: "S/9,590",
  entry: "S/100",
};

const LIVE_RANKING = [
  { pos: 1, name: "LeonardoPred", icon: "🦁", color: "bg-orange-500", pts: 18 },
  { pos: 2, name: "CrackPeruano", icon: "⚡", color: "bg-blue-500", pts: 16 },
  { pos: 3, name: "PredictoPro99", icon: "🎯", color: "bg-purple-500", pts: 15 },
  { pos: 4, name: "FutboleroLima", icon: "🔥", color: "bg-emerald-500", pts: 14 },
  { pos: 5, name: "GolazoTotal", icon: "⭐", color: "bg-red-500", pts: 13 },
];

type TipoBadge = "premium" | "express" | "estandar" | "finalizado";

const BADGE_CLASSES: Record<TipoBadge, string> = {
  premium: "border-brand-gold bg-brand-gold-dim text-brand-gold-dark",
  express: "border-accent-express bg-accent-express-bg text-accent-express-dark",
  estandar:
    "border-accent-libertadores bg-accent-libertadores-bg text-accent-libertadores-dark",
  finalizado:
    "border-accent-libertadores bg-accent-libertadores-bg text-accent-libertadores-dark",
};

interface TorneoCard {
  id: string;
  league: string;
  leagueIcon: string;
  badge: { label: string; tipo: TipoBadge };
  homeTeam: string;
  awayTeam: string;
  homeIcon: string;
  awayIcon: string;
  homeColor: string;
  awayColor: string;
  pot: string;
  entry: string;
  inscritos: number;
  scoreDisplay?: string;
  countdown?: string;
  entryHint?: string;
  finalScore?: string;
  winner?: string;
  winnerPrize?: string;
}

const ABIERTOS: TorneoCard[] = [
  {
    id: "1",
    league: "Champions League",
    leagueIcon: "🏆",
    badge: { label: "Premium", tipo: "premium" },
    homeTeam: "Man. United",
    awayTeam: "Real Madrid",
    homeIcon: "🔴",
    awayIcon: "⚪",
    homeColor: "from-red-900 to-red-600",
    awayColor: "from-blue-900 to-blue-600",
    pot: "24,200",
    entry: "S/50",
    inscritos: 248,
    scoreDisplay: "vs",
  },
  {
    id: "2",
    league: "Liga 1 Perú",
    leagueIcon: "⚽",
    badge: { label: "Express", tipo: "express" },
    homeTeam: "Alianza Lima",
    awayTeam: "Universitario",
    homeIcon: "💙",
    awayIcon: "❤️",
    homeColor: "from-blue-900 to-blue-600",
    awayColor: "from-red-800 to-red-500",
    pot: "3,850",
    entry: "S/5",
    inscritos: 770,
    scoreDisplay: "vs",
  },
  {
    id: "3",
    league: "Copa Libertadores",
    leagueIcon: "🌎",
    badge: { label: "Estándar", tipo: "estandar" },
    homeTeam: "S. Cristal",
    awayTeam: "Boca Juniors",
    homeIcon: "🔷",
    awayIcon: "⭐",
    homeColor: "from-blue-800 to-blue-500",
    awayColor: "from-yellow-600 to-orange-400",
    pot: "8,120",
    entry: "S/15",
    inscritos: 541,
    scoreDisplay: "vs",
  },
];

const PROXIMOS: TorneoCard[] = [
  {
    id: "4",
    league: "Premier League",
    leagueIcon: "🏴",
    badge: { label: "Estándar", tipo: "estandar" },
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    homeIcon: "🔴",
    awayIcon: "🔵",
    homeColor: "from-red-600 to-red-400",
    awayColor: "from-blue-800 to-blue-500",
    pot: "",
    entry: "S/10",
    inscritos: 0,
    countdown: "Abre en 2h 15m",
    entryHint: "Entrada desde S/10",
  },
  {
    id: "5",
    league: "La Liga",
    leagueIcon: "🇪🇸",
    badge: { label: "Premium", tipo: "premium" },
    homeTeam: "Barcelona",
    awayTeam: "Atlético",
    homeIcon: "🔴",
    awayIcon: "⭐",
    homeColor: "from-red-800 to-red-500",
    awayColor: "from-red-700 to-red-900",
    pot: "",
    entry: "S/30",
    inscritos: 0,
    countdown: "Abre en 4h 45m",
    entryHint: "Entrada desde S/30",
  },
];

const FINALIZADOS: TorneoCard[] = [
  {
    id: "6",
    league: "Champions League",
    leagueIcon: "🏆",
    badge: { label: "Finalizado", tipo: "finalizado" },
    homeTeam: "Juventus",
    awayTeam: "PSG",
    homeIcon: "⚫",
    awayIcon: "🔴",
    homeColor: "from-gray-800 to-gray-600",
    awayColor: "from-red-700 to-red-500",
    pot: "18,900",
    entry: "S/30",
    inscritos: 630,
    finalScore: "2 — 1",
    winner: "CrackPeruano",
    winnerPrize: "S/308",
  },
  {
    id: "7",
    league: "Liga 1 Perú",
    leagueIcon: "⚽",
    badge: { label: "Finalizado", tipo: "finalizado" },
    homeTeam: "Melgar",
    awayTeam: "Cienciano",
    homeIcon: "🔴",
    awayIcon: "🔴",
    homeColor: "from-red-800 to-red-600",
    awayColor: "from-red-700 to-red-400",
    pot: "4,200",
    entry: "S/5",
    inscritos: 840,
    finalScore: "0 — 0",
    winner: "GolazoTotal",
    winnerPrize: "S/64",
  },
];

// --- Components ---

function Tabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  const tabs = [
    { id: "en-vivo", label: "⚡ En vivo" },
    { id: "abiertos", label: "Abiertos" },
    { id: "proximos", label: "Próximos" },
    { id: "finalizados", label: "Finalizados" },
  ];

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-2 pt-5 md:px-6 md:pt-7">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
            active === tab.id
              ? "bg-brand-gold text-black shadow-sm"
              : "border border-light bg-card text-muted-d hover:border-brand-gold/40 hover:text-brand-gold-dark"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function HeroLive() {
  const m = LIVE_MATCH;
  return (
    <section className="relative mx-4 mt-3 animate-fade-in overflow-hidden rounded-lg border border-dark-border bg-stadium text-dark-text shadow-md md:mx-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-[140px] w-[140px] rounded-full bg-brand-gold opacity-[0.06]"
      />
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          <span aria-hidden>{m.leagueIcon}</span> {m.league}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-urgent-critical px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
          <span
            aria-hidden
            className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-white"
          />
          En vivo
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-4">
        <div className="flex-1 text-center">
          <div
            aria-hidden
            className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-xl shadow-sm ${m.homeColor}`}
          >
            {m.homeIcon}
          </div>
          <div className="font-display text-[15px] font-extrabold uppercase text-white">
            {m.homeTeam}
          </div>
        </div>
        <div className="flex-shrink-0 text-center">
          <div className="font-display text-4xl font-black leading-none text-brand-gold">
            {m.homeScore} — {m.awayScore}
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            <span aria-hidden>⏱</span> {m.minute}&apos;
          </div>
        </div>
        <div className="flex-1 text-center">
          <div
            aria-hidden
            className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-xl shadow-sm ${m.awayColor}`}
          >
            {m.awayIcon}
          </div>
          <div className="font-display text-[15px] font-extrabold uppercase text-white">
            {m.awayTeam}
          </div>
        </div>
      </div>
      <div className="flex border-t border-white/10">
        {[
          { val: m.players.toString(), lbl: "Jugadores" },
          { val: `${m.pot}🪙`, lbl: "Pozo" },
          { val: m.firstPrize, lbl: "1er Premio" },
          { val: m.entry, lbl: "Entrada" },
        ].map((s, i) => (
          <div
            key={i}
            className={`flex-1 py-2.5 text-center ${i < 3 ? "border-r border-white/[0.08]" : ""}`}
          >
            <div className="font-display text-[15px] font-black text-brand-gold">
              {s.val}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">
              {s.lbl}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RankingWidget() {
  const m = LIVE_MATCH;
  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-md border border-light bg-card shadow-sm md:mx-6">
      <div className="flex items-center gap-2 border-b border-light bg-subtle px-4 py-2.5">
        <span aria-hidden>🏅</span>
        <span className="font-display text-[15px] font-extrabold uppercase tracking-wider text-dark">
          Ranking en vivo
        </span>
        <span className="ml-auto text-[11px] font-semibold text-muted-d">
          {m.minute}&apos; · {m.players} inscritos
        </span>
      </div>
      {LIVE_RANKING.map((r, i) => (
        <div
          key={r.pos}
          className={`flex items-center gap-2.5 px-4 py-2.5 ${
            i < LIVE_RANKING.length - 1 ? "border-b border-light" : ""
          }`}
        >
          <span className="w-5 text-center font-display text-sm font-extrabold text-brand-gold-dark">
            {r.pos}
          </span>
          <div
            aria-hidden
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs ${r.color}`}
          >
            {r.icon}
          </div>
          <span className="flex-1 text-[13px] font-semibold text-dark">
            {r.name}
          </span>
          <div className="text-right">
            <div className="font-display text-base font-black leading-none text-brand-gold-dark">
              {r.pts}
            </div>
            <div className="text-[9px] text-muted-d">pts</div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="block w-full bg-subtle py-2.5 text-center text-xs font-semibold text-brand-blue-main transition-colors hover:bg-brand-blue-main/5"
      >
        Ver ranking completo →
      </button>
    </section>
  );
}

function MatchCard({
  torneo,
  variant,
}: {
  torneo: TorneoCard;
  variant: "abierto" | "proximo" | "finalizado";
}) {
  return (
    <article className="animate-fade-in cursor-pointer overflow-hidden rounded-md border border-light bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="px-4 pb-0 pt-3.5">
        <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-d">
          <span aria-hidden>{torneo.leagueIcon}</span>
          <span>{torneo.league}</span>
          <span
            className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${BADGE_CLASSES[torneo.badge.tipo]}`}
          >
            {torneo.badge.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div
              aria-hidden
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[15px] shadow-sm ${torneo.homeColor}`}
            >
              {torneo.homeIcon}
            </div>
            <span className="font-display text-[15px] font-extrabold uppercase text-dark">
              {torneo.homeTeam}
            </span>
          </div>
          <span
            className={`min-w-[52px] flex-shrink-0 text-center font-display ${
              variant === "finalizado"
                ? "text-xl font-black text-brand-gold-dark"
                : "text-[13px] font-semibold text-soft"
            }`}
          >
            {variant === "finalizado"
              ? torneo.finalScore
              : variant === "proximo"
                ? "vs"
                : torneo.scoreDisplay}
          </span>
          <div className="flex flex-1 flex-row-reverse items-center gap-2">
            <div
              aria-hidden
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[15px] shadow-sm ${torneo.awayColor}`}
            >
              {torneo.awayIcon}
            </div>
            <span className="font-display text-[15px] font-extrabold uppercase text-dark">
              {torneo.awayTeam}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-light bg-subtle px-4 py-3">
        {variant === "abierto" && (
          <>
            <div className="min-w-0">
              <div className="font-display text-[17px] font-black leading-none text-brand-gold-dark">
                {torneo.pot} <span aria-hidden>🪙</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-d">
                Entrada {torneo.entry} · {torneo.inscritos} inscritos
              </div>
            </div>
            <button
              type="button"
              className="whitespace-nowrap rounded-sm bg-brand-gold px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-gold-light"
            >
              Jugar →
            </button>
          </>
        )}
        {variant === "proximo" && (
          <>
            <div className="min-w-0">
              <div className="font-display text-xs font-extrabold uppercase tracking-wider text-brand-orange">
                <span aria-hidden>⏱</span> {torneo.countdown}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-d">
                {torneo.entryHint}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-sm border border-strong px-3.5 py-2 text-xs font-semibold text-muted-d">
              Próximamente
            </span>
          </>
        )}
        {variant === "finalizado" && (
          <>
            <div className="min-w-0">
              <div className="text-[11px] text-muted-d">Ganador del torneo</div>
              <div className="truncate font-display text-sm font-extrabold text-brand-gold-dark">
                <span aria-hidden>🏆</span> {torneo.winner} · {torneo.winnerPrize}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-sm border border-strong px-3.5 py-2 text-xs font-semibold text-muted-d">
              Resultados
            </span>
          </>
        )}
      </div>
    </article>
  );
}

function FilterChips() {
  const filters = [
    "Todos",
    "🏆 Champions",
    "⚽ Liga 1",
    "🌎 Copa Lib.",
    "🏴 Premier",
  ];
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3 md:px-6">
      {filters.map((f, i) => (
        <button
          key={f}
          type="button"
          className={`flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold shadow-sm transition-all ${
            i === 0
              ? "border-brand-gold bg-brand-gold text-black"
              : "border-light bg-card text-muted-d hover:border-brand-gold/40 hover:text-brand-gold-dark"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

// --- Entry ---

export function HomeContent() {
  const [activeTab, setActiveTab] = useState("en-vivo");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tabs active={activeTab} onChange={setActiveTab} />
      {activeTab === "en-vivo" && (
        <>
          <HeroLive />
          <RankingWidget />
        </>
      )}
      {activeTab === "abiertos" && (
        <>
          <div className="mt-2" />
          <FilterChips />
          <div className="flex flex-col gap-3 px-4 pb-4 md:px-6">
            {ABIERTOS.map((t) => (
              <MatchCard key={t.id} torneo={t} variant="abierto" />
            ))}
          </div>
        </>
      )}
      {activeTab === "proximos" && (
        <div className="mt-3 flex flex-col gap-3 px-4 pb-4 md:px-6">
          {PROXIMOS.map((t) => (
            <MatchCard key={t.id} torneo={t} variant="proximo" />
          ))}
        </div>
      )}
      {activeTab === "finalizados" && (
        <div className="mt-3 flex flex-col gap-3 px-4 pb-4 md:px-6">
          {FINALIZADOS.map((t) => (
            <MatchCard key={t.id} torneo={t} variant="finalizado" />
          ))}
        </div>
      )}
    </div>
  );
}
