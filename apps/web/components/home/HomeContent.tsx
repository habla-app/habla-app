"use client";

// HomeContent — toda la logica interactiva de la home.
// Se separa del page.tsx (Server Component) para que el NavBar pueda leer la sesion.
import { useState } from "react";
import { BottomNav } from "@/components/layout/BottomNav";

// --- Mock Data ---

const LIVE_MATCH = {
  league: "Champions League - Cuartos",
  leagueIcon: "\uD83C\uDFC6",
  homeTeam: "Man. United",
  awayTeam: "Real Madrid",
  homeIcon: "\uD83D\uDD34",
  awayIcon: "\u26AA",
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
  { pos: 1, name: "LeonardoPred", icon: "\uD83E\uDD81", color: "bg-orange-500", pts: 18 },
  { pos: 2, name: "CrackPeruano", icon: "\u26A1", color: "bg-blue-500", pts: 16 },
  { pos: 3, name: "PredictoPro99", icon: "\uD83C\uDFAF", color: "bg-purple-500", pts: 15 },
  { pos: 4, name: "FutboleroLima", icon: "\uD83D\uDD25", color: "bg-emerald-500", pts: 14 },
  { pos: 5, name: "GolazoTotal", icon: "\u2B50", color: "bg-red-500", pts: 13 },
];

interface TorneoCard {
  id: string;
  league: string;
  leagueIcon: string;
  badge: { label: string; className: string };
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
    leagueIcon: "\uD83C\uDFC6",
    badge: { label: "Premium", className: "border-brand-gold/30 bg-yellow-900/30 text-brand-gold" },
    homeTeam: "Man. United",
    awayTeam: "Real Madrid",
    homeIcon: "\uD83D\uDD34",
    awayIcon: "\u26AA",
    homeColor: "from-red-900 to-red-600",
    awayColor: "from-blue-900 to-blue-600",
    pot: "24,200",
    entry: "S/50",
    inscritos: 248,
    scoreDisplay: "vs",
  },
  {
    id: "2",
    league: "Liga 1 Peru",
    leagueIcon: "\u26BD",
    badge: { label: "Express", className: "border-blue-500/30 bg-blue-900/30 text-blue-400" },
    homeTeam: "Alianza Lima",
    awayTeam: "Universitario",
    homeIcon: "\uD83D\uDC99",
    awayIcon: "\u2764\uFE0F",
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
    leagueIcon: "\uD83C\uDF0E",
    badge: { label: "Estandar", className: "border-brand-green/30 bg-emerald-900/30 text-brand-green" },
    homeTeam: "S. Cristal",
    awayTeam: "Boca Juniors",
    homeIcon: "\uD83D\uDD37",
    awayIcon: "\u2B50",
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
    leagueIcon: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
    badge: { label: "Estandar", className: "border-brand-green/30 bg-emerald-900/30 text-brand-green" },
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    homeIcon: "\uD83D\uDD34",
    awayIcon: "\uD83D\uDD35",
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
    leagueIcon: "\uD83C\uDDEA\uD83C\uDDF8",
    badge: { label: "Premium", className: "border-brand-gold/30 bg-yellow-900/30 text-brand-gold" },
    homeTeam: "Barcelona",
    awayTeam: "Atletico",
    homeIcon: "\uD83D\uDD34",
    awayIcon: "\u2B50",
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
    leagueIcon: "\uD83C\uDFC6",
    badge: { label: "FINALIZADO", className: "bg-emerald-900/30 text-green-400" },
    homeTeam: "Juventus",
    awayTeam: "PSG",
    homeIcon: "\u26AB",
    awayIcon: "\uD83D\uDD34",
    homeColor: "from-gray-800 to-gray-600",
    awayColor: "from-red-700 to-red-500",
    pot: "18,900",
    entry: "S/30",
    inscritos: 630,
    finalScore: "2 \u2014 1",
    winner: "CrackPeruano",
    winnerPrize: "S/308",
  },
  {
    id: "7",
    league: "Liga 1 Peru",
    leagueIcon: "\u26BD",
    badge: { label: "FINALIZADO", className: "bg-emerald-900/30 text-green-400" },
    homeTeam: "Melgar",
    awayTeam: "Cienciano",
    homeIcon: "\uD83D\uDD34",
    awayIcon: "\uD83D\uDD34",
    homeColor: "from-red-800 to-red-600",
    awayColor: "from-red-700 to-red-400",
    pot: "4,200",
    entry: "S/5",
    inscritos: 840,
    finalScore: "0 \u2014 0",
    winner: "GolazoTotal",
    winnerPrize: "S/64",
  },
];

// --- Inline Components ---

function Tabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  const tabs = [
    { id: "en-vivo", label: "\u26A1 En vivo" },
    { id: "abiertos", label: "Abiertos" },
    { id: "proximos", label: "Pr\u00F3ximos" },
    { id: "finalizados", label: "Finalizados" },
  ];

  return (
    <div className="flex-shrink-0 px-4 pt-2.5">
      <div className="flex gap-0.5 rounded-[10px] bg-brand-surface p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-[7px] py-1.5 text-center text-[11px] font-semibold transition-all ${
              active === tab.id
                ? "bg-brand-blue-main text-white"
                : "text-brand-muted hover:text-brand-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroLive() {
  const m = LIVE_MATCH;
  return (
    <div className="relative mx-4 mt-2.5 animate-fade-in overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-brand-blue-mid to-brand-blue-main">
      <div className="absolute -right-8 -top-8 h-[120px] w-[120px] rounded-full bg-brand-gold opacity-[0.06]" />
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          {m.leagueIcon} {m.league}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-brand-live px-2 py-0.5 text-[10px] font-bold text-white">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
          EN VIVO
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 pb-3">
        <div className="flex-1 text-center">
          <div
            className={`mx-auto mb-1.5 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br ${m.homeColor} text-xl`}
          >
            {m.homeIcon}
          </div>
          <div className="font-display text-[15px] font-extrabold uppercase text-white">
            {m.homeTeam}
          </div>
        </div>
        <div className="flex-shrink-0 text-center">
          <div className="font-display text-4xl font-black leading-none text-brand-gold">
            {m.homeScore} &mdash; {m.awayScore}
          </div>
          <div className="mt-0.5 text-[11px] text-white/55">
            &#9201; {m.minute}&apos;
          </div>
        </div>
        <div className="flex-1 text-center">
          <div
            className={`mx-auto mb-1.5 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br ${m.awayColor} text-xl`}
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
          { val: `${m.pot}\uD83E\uDE99`, lbl: "Pozo" },
          { val: m.firstPrize, lbl: "1er Premio" },
          { val: m.entry, lbl: "Entrada" },
        ].map((s, i) => (
          <div
            key={i}
            className={`flex-1 py-2 text-center ${i < 3 ? "border-r border-white/[0.08]" : ""}`}
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
    </div>
  );
}

function RankingWidget() {
  const m = LIVE_MATCH;
  const posColors = [
    "text-brand-gold",
    "text-slate-400",
    "text-amber-700",
    "text-brand-muted",
    "text-brand-muted",
  ];

  return (
    <div className="mx-4 mt-2.5 overflow-hidden rounded-[14px] border border-brand-border bg-brand-card">
      <div className="flex items-center gap-2 bg-brand-card2 px-3.5 py-2.5">
        <span>&#127941;</span>
        <span className="font-display text-[15px] font-extrabold uppercase">
          Ranking en vivo
        </span>
        <span className="ml-auto text-[11px] text-brand-muted">
          {m.minute}&apos; &middot; {m.players} inscritos
        </span>
      </div>
      {LIVE_RANKING.map((r, i) => (
        <div
          key={r.pos}
          className={`flex items-center gap-2.5 px-3.5 py-2 ${
            i < LIVE_RANKING.length - 1
              ? "border-b border-brand-border/35"
              : ""
          }`}
        >
          <span
            className={`w-[18px] text-center font-display text-sm font-extrabold ${posColors[i]}`}
          >
            {r.pos}
          </span>
          <div
            className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-xs ${r.color}`}
          >
            {r.icon}
          </div>
          <span className="flex-1 text-[13px] font-semibold">{r.name}</span>
          <div className="text-right">
            <div className="font-display text-base font-black text-brand-gold">
              {r.pts}
            </div>
            <div className="text-[9px] text-brand-muted">pts</div>
          </div>
        </div>
      ))}
      <div className="py-2.5 text-center text-xs text-brand-muted">
        Ver ranking completo &rarr;
      </div>
    </div>
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
    <div className="animate-fade-in cursor-pointer overflow-hidden rounded-[14px] border border-brand-border bg-brand-card transition-all hover:-translate-y-0.5 hover:border-brand-gold/40 hover:shadow-lg hover:shadow-brand-blue-main/25">
      <div className="px-3.5 pb-0 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
          {torneo.leagueIcon} {torneo.league}
          <span
            className={`ml-1.5 rounded-full border px-1.5 py-px text-[10px] font-bold ${torneo.badge.className}`}
          >
            {torneo.badge.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[15px] ${torneo.homeColor}`}
            >
              {torneo.homeIcon}
            </div>
            <span className="font-display text-[15px] font-extrabold uppercase">
              {torneo.homeTeam}
            </span>
          </div>
          <span
            className={`min-w-[44px] flex-shrink-0 text-center font-display text-xl font-black ${
              variant === "finalizado"
                ? "text-brand-gold"
                : "text-[13px] font-semibold text-brand-muted"
            }`}
          >
            {variant === "finalizado"
              ? torneo.finalScore
              : variant === "proximo"
                ? ""
                : torneo.scoreDisplay}
          </span>
          <div className="flex flex-1 flex-row-reverse items-center gap-1.5">
            <div
              className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[15px] ${torneo.awayColor}`}
            >
              {torneo.awayIcon}
            </div>
            <span className="font-display text-[15px] font-extrabold uppercase">
              {torneo.awayTeam}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-brand-border bg-brand-card2 px-3.5 py-2.5">
        {variant === "abierto" && (
          <>
            <div>
              <div className="font-display text-[17px] font-black text-brand-gold">
                {torneo.pot} &#x1FA99;
              </div>
              <div className="text-[10px] text-brand-muted">
                Entrada {torneo.entry} &middot; {torneo.inscritos} inscritos
              </div>
            </div>
            <button className="whitespace-nowrap rounded-lg bg-brand-gold px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-brand-gold-light">
              Jugar &rarr;
            </button>
          </>
        )}
        {variant === "proximo" && (
          <>
            <div>
              <div className="font-display text-xs font-bold text-brand-orange">
                &#9201; {torneo.countdown}
              </div>
              <div className="mt-0.5 text-[10px] text-brand-muted">
                {torneo.entryHint}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-lg border border-brand-border px-3.5 py-2 text-xs font-semibold text-brand-muted">
              Proximamente
            </span>
          </>
        )}
        {variant === "finalizado" && (
          <>
            <div>
              <div className="text-[11px] text-brand-muted">
                Ganador del torneo
              </div>
              <div className="font-display text-sm font-extrabold text-brand-gold">
                &#127942; {torneo.winner} &middot; {torneo.winnerPrize}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-lg border border-brand-border px-3.5 py-2 text-xs font-semibold text-brand-muted">
              Resultados
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChips() {
  const filters = [
    "Todos",
    "\uD83C\uDFC6 Champions",
    "\u26BD Liga 1",
    "\uD83C\uDF0E Copa Lib.",
    "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F Premier",
  ];
  return (
    <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 pb-2.5">
      {filters.map((f, i) => (
        <button
          key={f}
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
            i === 0
              ? "border-brand-gold/40 bg-[var(--gold-dim)] text-brand-gold"
              : "border-brand-border text-brand-muted hover:border-brand-gold/30 hover:text-brand-gold"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

export function HomeContent() {
  const [activeTab, setActiveTab] = useState("en-vivo");

  const handleBottomNav = (tab: string) => {
    if (tab === "en-vivo" || tab === "abiertos" || tab === "proximos") {
      setActiveTab(tab);
    }
  };

  return (
    <>
      <Tabs active={activeTab} onChange={setActiveTab} />
      <div className="scrollbar-none flex-1 overflow-y-auto pb-20">
        {activeTab === "en-vivo" && (
          <>
            <HeroLive />
            <RankingWidget />
          </>
        )}
        {activeTab === "abiertos" && (
          <>
            <div className="mt-1" />
            <FilterChips />
            <div className="flex flex-col gap-2 px-4">
              {ABIERTOS.map((t) => (
                <MatchCard key={t.id} torneo={t} variant="abierto" />
              ))}
            </div>
          </>
        )}
        {activeTab === "proximos" && (
          <div className="mt-3 flex flex-col gap-2 px-4">
            {PROXIMOS.map((t) => (
              <MatchCard key={t.id} torneo={t} variant="proximo" />
            ))}
          </div>
        )}
        {activeTab === "finalizados" && (
          <div className="mt-3 flex flex-col gap-2 px-4">
            {FINALIZADOS.map((t) => (
              <MatchCard key={t.id} torneo={t} variant="finalizado" />
            ))}
          </div>
        )}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={handleBottomNav} />
    </>
  );
}
