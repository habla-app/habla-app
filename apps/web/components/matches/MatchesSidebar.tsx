// Sidebar sticky — réplica de `.sidebar` + `.widget` del mockup
// (docs/habla-mockup-completo.html líneas 313-367, 1903-1991). Tres
// widgets en orden: 🔴 En vivo ahora · 🏅 Top del día · 🪙 Tu balance.
//
// Se comparte entre `/` (landing) y `/matches` (Sub-Sprint 3). Los dos
// primeros widgets son iguales con o sin sesión; el widget de balance
// cambia: con sesión muestra el monto + CTAs; sin sesión muestra un
// mensaje con CTA a /auth/login.
//
// Server Component — llama a auth() para saber si hay sesión. La data
// de en-vivo y top-del-día es mock hasta los Sub-Sprints 5 y 3
// respectivamente.
import Link from "next/link";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Mock data — reemplazado por fetch real en Sub-Sprints 3 (ranking) y 5
// (partidos en vivo vía api-football poller).
// ---------------------------------------------------------------------------

interface LiveMini {
  id: string;
  liga: string;
  ligaIcon: string;
  equipoLocal: string;
  equipoLocalIcon: string;
  equipoLocalGradient: string; /* Tailwind from-/to- */
  equipoVisita: string;
  equipoVisitaIcon: string;
  equipoVisitaGradient: string;
  marcador: string; /* "1—2" */
  minuto: string; /* "67'" */
  lead?: {
    nombre: string;
    avatarIcon: string;
    avatarBg: string; /* Tailwind bg-* */
    puntos: number;
    totalJugadores: number;
  };
}

const LIVE_MOCK: LiveMini[] = [
  {
    id: "live-1",
    liga: "Champions · Cuartos",
    ligaIcon: "🏆",
    equipoLocal: "Man U.",
    equipoLocalIcon: "🔴",
    equipoLocalGradient: "from-red-900 to-red-600",
    equipoVisita: "R. Madrid",
    equipoVisitaIcon: "⚪",
    equipoVisitaGradient: "from-blue-900 to-blue-600",
    marcador: "1—2",
    minuto: "67'",
    lead: {
      nombre: "LeonardoPred",
      avatarIcon: "🦁",
      avatarBg: "bg-orange-500",
      puntos: 18,
      totalJugadores: 312,
    },
  },
  {
    id: "live-2",
    liga: "Liga 1 Perú",
    ligaIcon: "🏆",
    equipoLocal: "Cristal",
    equipoLocalIcon: "🟢",
    equipoLocalGradient: "from-emerald-900 to-emerald-500",
    equipoVisita: "Melgar",
    equipoVisitaIcon: "🟡",
    equipoVisitaGradient: "from-orange-700 to-yellow-500",
    marcador: "0—0",
    minuto: "32'",
  },
];

interface TopDayRow {
  pos: number;
  nombre: string;
  avatarIcon: string;
  avatarBg: string; /* Tailwind bg-* */
  puntos: number;
}

const TOP_DAY_MOCK: TopDayRow[] = [
  { pos: 1, nombre: "LeonardoPred", avatarIcon: "🦁", avatarBg: "bg-orange-500", puntos: 18 },
  { pos: 2, nombre: "CrackPeruano", avatarIcon: "⚡", avatarBg: "bg-blue-500", puntos: 16 },
  { pos: 3, nombre: "PredictoPro99", avatarIcon: "🎯", avatarBg: "bg-purple-500", puntos: 15 },
  { pos: 4, nombre: "FutboleroLima", avatarIcon: "🔥", avatarBg: "bg-emerald-500", puntos: 14 },
];

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export async function MatchesSidebar() {
  const session = await auth();
  const balance = session?.user?.balanceLukas ?? null;

  return (
    <aside className="flex flex-col gap-3.5">
      <LiveAhoraWidget matches={LIVE_MOCK} />
      <TopDelDiaWidget rows={TOP_DAY_MOCK} />
      <BalanceWidget balance={balance} />
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
  return (
    <Link
      href="/live-match"
      className={`block px-3.5 py-3.5 transition-colors hover:bg-subtle ${withBottomBorder ? "border-b border-light" : ""}`}
    >
      {/* live-mini-top */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          <span aria-hidden>{match.ligaIcon}</span> {match.liga}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-urgent-critical">
          <span
            aria-hidden
            className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-urgent-critical"
          />
          En vivo
        </span>
      </div>

      {/* live-mini-teams */}
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <TeamMini
          name={match.equipoLocal}
          icon={match.equipoLocalIcon}
          gradient={match.equipoLocalGradient}
        />
        <div className="flex-shrink-0 text-center">
          <div className="min-w-[48px] font-display text-[20px] font-black leading-none text-brand-gold-dark">
            {match.marcador}
          </div>
          <div className="text-[10px] text-muted-d">
            <span aria-hidden>⏱</span> {match.minuto}
          </div>
        </div>
        <TeamMini
          name={match.equipoVisita}
          icon={match.equipoVisitaIcon}
          gradient={match.equipoVisitaGradient}
          align="right"
        />
      </div>

      {match.lead && (
        <div className="mb-2 flex items-center gap-2 rounded-sm bg-subtle px-2.5 py-2">
          <div
            aria-hidden
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${match.lead.avatarBg}`}
          >
            {match.lead.avatarIcon}
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
  icon,
  gradient,
  align = "left",
}: {
  name: string;
  icon: string;
  gradient: string;
  align?: "left" | "right";
}) {
  const alignCls = align === "right" ? "flex-row-reverse text-right" : "";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${alignCls}`}>
      <div
        aria-hidden
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[13px] text-white shadow-sm ${gradient}`}
      >
        {icon}
      </div>
      <div className="truncate font-display text-[13px] font-extrabold uppercase text-dark">
        {name}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget 2: 🏅 Top del día
// ---------------------------------------------------------------------------

function TopDelDiaWidget({ rows }: { rows: TopDayRow[] }) {
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
          Top del día
        </span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.04em] text-muted-d">
          Hoy
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-muted-d">
          Aún no hay puntajes del día.
        </div>
      ) : (
        rows.map((row, idx) => (
          <div
            key={`${row.pos}-${row.nombre}`}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 ${idx < rows.length - 1 ? "border-b border-light" : ""}`}
          >
            <span
              className={`w-5 text-center font-display text-[15px] font-black ${posColor(row.pos)}`}
            >
              {row.pos}
            </span>
            <div
              aria-hidden
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[13px] ${row.avatarBg}`}
            >
              {row.avatarIcon}
            </div>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-dark">
              {row.nombre}
            </span>
            <span className="font-display text-[15px] font-black text-brand-gold-dark">
              {row.puntos}
            </span>
          </div>
        ))
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Widget 3: 🪙 Tu balance (auth-aware)
// ---------------------------------------------------------------------------

function BalanceWidget({ balance }: { balance: number | null }) {
  const logged = balance !== null;
  return (
    <section className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-light px-3.5 py-3">
        <span aria-hidden className="text-[15px]">
          🪙
        </span>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Tu balance
        </span>
      </div>

      {logged ? (
        <LoggedBalance amount={balance} />
      ) : (
        <UnloggedBalance />
      )}
    </section>
  );
}

function LoggedBalance({ amount }: { amount: number }) {
  return (
    <div className="p-[18px] text-center">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        Disponible
      </div>
      <div className="font-display text-[40px] font-black leading-none text-brand-gold-dark">
        {amount.toLocaleString("es-PE")}
      </div>
      <div className="mt-1 text-[11px] text-muted-d">
        ≈ S/ {amount.toLocaleString("es-PE")} en créditos
      </div>
      <div className="mt-3.5 flex gap-2">
        <Link
          href="/wallet"
          className="flex-1 rounded-sm bg-brand-gold px-2.5 py-2.5 text-center text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
        >
          💳 Comprar
        </Link>
        <Link
          href="/tienda"
          className="flex-1 rounded-sm border border-light bg-subtle px-2.5 py-2.5 text-center text-[12px] font-bold text-dark transition-colors hover:border-brand-gold"
        >
          🎁 Tienda
        </Link>
      </div>
    </div>
  );
}

function UnloggedBalance() {
  return (
    <div className="p-[18px] text-center">
      <div aria-hidden className="mb-2 text-[28px] leading-none">
        🔒
      </div>
      <p className="mb-0.5 text-[13px] font-bold text-dark">
        Inicia sesión para ver tu balance
      </p>
      <p className="mb-3.5 text-[11px] leading-snug text-muted-d">
        Regístrate y recibe 500 Lukas de bienvenida para tu primera
        combinada.
      </p>
      <Link
        href="/auth/login?callbackUrl=/"
        className="block w-full rounded-sm bg-brand-gold px-2.5 py-2.5 text-[12px] font-bold text-black transition-colors hover:bg-brand-gold-light"
      >
        Entrar
      </Link>
    </div>
  );
}
