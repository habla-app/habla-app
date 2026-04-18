// Landing pública — replica `/matches` del mockup (docs/habla-mockup-completo.html
// líneas 1687-1850+). En Fase 2 se muestra con mock data y sin sidebar de
// balance. Sub-Sprint 3 construye `/matches` con layout completo (sidebar
// sticky + data real api-football). Los CTAs del MatchCard redirigen a login
// con `callbackUrl=/` cuando no hay sesión.
import { Chip } from "@/components/ui";
import { MatchCard, type MatchCardData } from "@/components/matches/MatchCard";

const FILTROS_LIGA = [
  "Todas las ligas",
  "Liga 1 Perú",
  "Champions",
  "Libertadores",
  "Premier",
  "Mundial 2026",
];

const MOCK_TORNEOS: MatchCardData[] = [
  {
    id: "mock-1",
    liga: "Liga 1 Perú · Apertura",
    ligaIcon: "⚽",
    tipoBadge: "clasico",
    equipoLocal: "Alianza Lima",
    equipoLocalIcon: "💙",
    equipoLocalColor: "from-blue-900 to-blue-600",
    equipoVisita: "Universitario",
    equipoVisitaIcon: "❤️",
    equipoVisitaColor: "from-red-800 to-red-500",
    pozoBruto: 4800,
    entradaLukas: 5,
    totalInscritos: 612,
    urgency: "critical",
    urgencyLabel: "¡Cierra en 8 min!",
    featured: true,
  },
  {
    id: "mock-2",
    liga: "Champions League · Cuartos",
    ligaIcon: "🏆",
    tipoBadge: "champions",
    equipoLocal: "Man. United",
    equipoLocalIcon: "🔴",
    equipoLocalColor: "from-red-900 to-red-600",
    equipoVisita: "Real Madrid",
    equipoVisitaIcon: "⚪",
    equipoVisitaColor: "from-blue-900 to-blue-600",
    pozoBruto: 27_400,
    entradaLukas: 100,
    totalInscritos: 312,
    urgency: "high",
    urgencyLabel: "⏰ 42 min",
  },
  {
    id: "mock-3",
    liga: "Copa Libertadores · Fase de grupos",
    ligaIcon: "🌎",
    tipoBadge: "liberta",
    equipoLocal: "S. Cristal",
    equipoLocalIcon: "🔷",
    equipoLocalColor: "from-blue-800 to-blue-500",
    equipoVisita: "Boca Juniors",
    equipoVisitaIcon: "⭐",
    equipoVisitaColor: "from-yellow-600 to-orange-400",
    pozoBruto: 8_120,
    entradaLukas: 15,
    totalInscritos: 541,
    urgency: "med",
    urgencyLabel: "2h 15min",
  },
  {
    id: "mock-4",
    liga: "Premier League · Fecha 32",
    ligaIcon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tipoBadge: "estandar",
    equipoLocal: "Arsenal",
    equipoLocalIcon: "🔴",
    equipoLocalColor: "from-red-600 to-red-400",
    equipoVisita: "Chelsea",
    equipoVisitaIcon: "🔵",
    equipoVisitaColor: "from-blue-800 to-blue-500",
    pozoBruto: 12_500,
    entradaLukas: 25,
    totalInscritos: 412,
    urgency: "low",
    urgencyLabel: "Hoy 21:00",
  },
  {
    id: "mock-5",
    liga: "Mundial FIFA 2026 · Grupo A",
    ligaIcon: "🌍",
    tipoBadge: "mundial",
    equipoLocal: "México",
    equipoLocalIcon: "🇲🇽",
    equipoLocalColor: "from-green-800 to-red-600",
    equipoVisita: "Canadá",
    equipoVisitaIcon: "🇨🇦",
    equipoVisitaColor: "from-red-700 to-white",
    pozoBruto: 45_800,
    entradaLukas: 50,
    totalInscritos: 918,
    urgency: "low",
    urgencyLabel: "11 jun · 19:00",
  },
];

export default function MatchesHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6 md:pt-8 lg:max-w-3xl">
      {/* PAGE HEAD */}
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          Partidos de hoy
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Inscríbete al torneo, arma tu combinada de 5 predicciones y compite
          por el pozo.
        </p>
      </header>

      {/* FILTER STRIP — decorativo en Fase 2. Sub-Sprint 3 conecta a
          GET /torneos?liga=… */}
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1">
        {FILTROS_LIGA.map((filtro, idx) => (
          <Chip key={filtro} active={idx === 0}>
            {filtro}
          </Chip>
        ))}
      </div>

      {/* SECTION BAR — próximos torneos */}
      <div className="mb-5 flex items-center gap-4 rounded-r-sm border-l-4 border-brand-gold bg-section-subtle px-4 py-3">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold text-[20px] text-black shadow-gold"
        >
          ⚡
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="mb-0.5 font-display text-[22px] font-black uppercase leading-none tracking-[0.02em] text-dark">
            Próximos torneos
          </h2>
          <p className="text-[13px] leading-tight text-muted-d">
            Los partidos que están a punto de arrancar
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-brand-gold px-3.5 py-1 font-display text-[15px] font-extrabold text-black">
          {MOCK_TORNEOS.length} abiertos
        </span>
      </div>

      <div className="mb-10 flex flex-col gap-3.5">
        {MOCK_TORNEOS.map((torneo) => (
          <MatchCard key={torneo.id} torneo={torneo} />
        ))}
      </div>

      {/* SECTION BAR — finalizados (vacío en Fase 2) */}
      <div className="mb-4 flex items-center gap-4 rounded-r-sm border-l-4 border-brand-green bg-section-finalized px-4 py-3">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-brand-green text-[20px] text-black shadow-green-glow"
        >
          🏆
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="mb-0.5 font-display text-[22px] font-black uppercase leading-none tracking-[0.02em] text-dark">
            Ya ganaron hoy
          </h2>
          <p className="text-[13px] leading-tight text-muted-d">
            Resultados de los torneos que cerraron hoy
          </p>
        </div>
      </div>

      <div className="rounded-md border border-light bg-card px-6 py-10 text-center shadow-sm">
        <div aria-hidden className="mb-3 text-4xl">
          🕓
        </div>
        <p className="text-sm font-semibold text-dark">
          Aún no hay resultados hoy
        </p>
        <p className="mt-1 text-[13px] text-muted-d">
          Los torneos que cierren durante el día aparecerán aquí.
        </p>
      </div>
    </div>
  );
}
