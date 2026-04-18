// MatchCard — réplica de `.mcard` del mockup (docs/habla-mockup-completo.html
// líneas 244-293). Cards con urgencia basada en tiempo de cierre que cambia
// el borde, el banner superior, el badge y el CTA.
//
// Usado por `/` (landing) en Fase 2 con mock data; Sub-Sprint 3 lo reutiliza
// en `/matches` con data real de api-football. Fase 3 agrega urgency
// calculation desde `cierreAt`.
import Link from "next/link";

export type Urgency = "critical" | "high" | "med" | "low";

export type TipoBadge =
  | "premium"
  | "express"
  | "estandar"
  | "champions"
  | "clasico"
  | "mundial"
  | "liberta";

const TYPE_BADGE_CLASSES: Record<TipoBadge, string> = {
  premium:
    "border-brand-gold bg-brand-gold-dim text-brand-gold-dark",
  express:
    "border-accent-express bg-accent-express-bg text-accent-express-dark",
  estandar:
    "border-accent-libertadores bg-accent-libertadores-bg text-accent-libertadores-dark",
  champions:
    "border-brand-blue-main bg-accent-champions-bg text-accent-champions-dark",
  clasico:
    "border-accent-clasico bg-accent-clasico-bg text-accent-clasico-dark",
  mundial:
    "border-accent-mundial bg-accent-mundial-bg text-accent-mundial-dark",
  liberta:
    "border-accent-libertadores bg-accent-libertadores-bg text-accent-libertadores-dark",
};

const TYPE_BADGE_LABELS: Record<TipoBadge, string> = {
  premium: "Premium",
  express: "Express",
  estandar: "Estándar",
  champions: "Champions",
  clasico: "Clásico",
  mundial: "Mundial",
  liberta: "Libertadores",
};

export interface MatchCardData {
  id: string;
  liga: string;
  ligaIcon?: string;
  tipoBadge: TipoBadge;
  equipoLocal: string;
  equipoLocalIcon?: string;
  equipoLocalColor?: string;
  equipoVisita: string;
  equipoVisitaIcon?: string;
  equipoVisitaColor?: string;
  pozoBruto: number;
  entradaLukas: number;
  totalInscritos: number;
  urgency: Urgency;
  urgencyLabel: string; /* "¡Cierra en 8 min!" | "⏰ 42 min" | "2h 15m" | "19:30" */
  featured?: boolean;
}

interface MatchCardProps {
  torneo: MatchCardData;
  /** Destino del CTA. Default: `/torneo/{id}`. */
  href?: string;
}

export function MatchCard({ torneo, href }: MatchCardProps) {
  const isCritical = torneo.urgency === "critical";
  const isHigh = torneo.urgency === "high";
  const isMed = torneo.urgency === "med";

  const mcardBg =
    isCritical
      ? "bg-mcard-critical"
      : isHigh
        ? "bg-mcard-high"
        : "bg-card";

  const mcardBorder =
    isCritical
      ? "border-2 border-urgent-critical animate-pulse-border"
      : isHigh
        ? "border-2 border-urgent-high"
        : isMed
          ? "border-[1.5px] border-brand-gold/40"
          : "border border-light";

  const topStripe = isCritical
    ? "h-[5px] bg-mcard-critical-stripe bg-[length:200%_100%] animate-shimmer"
    : isHigh
      ? "h-1 bg-urgent-high"
      : "";

  const destination = href ?? `/torneo/${torneo.id}`;

  const ctaCritical = isCritical;
  const ctaText = ctaCritical
    ? "🔥 Inscribirme antes que cierre"
    : "🎯 Crear combinada";
  const ctaClasses = ctaCritical
    ? "bg-urgent-critical text-white shadow-urgent-btn hover:bg-urgent-critical-hover hover:-translate-y-px"
    : "bg-brand-gold text-black shadow-gold-btn hover:bg-brand-gold-light hover:-translate-y-px hover:shadow-gold";

  const urgBadgeClasses = {
    critical:
      "bg-urgent-critical text-white animate-live-pulse",
    high: "bg-urgent-high-bg text-urgent-high-dark border border-urgent-high",
    med: "bg-urgent-med-bg text-brand-gold-dark border border-brand-gold/40",
    low: "bg-urgent-low-bg text-muted-d border border-light",
  }[torneo.urgency];

  return (
    <article
      className={`group relative overflow-hidden rounded-md shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${mcardBg} ${mcardBorder} ${torneo.featured ? "p-6" : ""}`}
    >
      {topStripe && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 ${topStripe}`}
        />
      )}

      <div className={torneo.featured ? "" : "p-[18px]"}>
        {/* top row — liga + urgency/type badges */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-d">
            {torneo.ligaIcon && <span aria-hidden>{torneo.ligaIcon}</span>}
            {torneo.liga}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[4px] text-[11px] font-extrabold uppercase tracking-[0.04em] ${TYPE_BADGE_CLASSES[torneo.tipoBadge]}`}
            >
              {TYPE_BADGE_LABELS[torneo.tipoBadge]}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] font-display text-[13px] font-extrabold uppercase tracking-[0.03em] ${urgBadgeClasses}`}
            >
              {isCritical && (
                <span
                  aria-hidden
                  className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-white"
                />
              )}
              {torneo.urgencyLabel}
            </span>
          </div>
        </div>

        {/* teams row */}
        <div
          className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 ${torneo.featured ? "my-4" : "my-3.5"}`}
        >
          <TeamCol
            name={torneo.equipoLocal}
            icon={torneo.equipoLocalIcon}
            color={torneo.equipoLocalColor}
            featured={torneo.featured}
          />
          <span
            className={`font-display font-black text-soft ${torneo.featured ? "text-[32px]" : "text-[22px]"}`}
          >
            VS
          </span>
          <TeamCol
            name={torneo.equipoVisita}
            icon={torneo.equipoVisitaIcon}
            color={torneo.equipoVisitaColor}
            featured={torneo.featured}
          />
        </div>

        {/* stats row */}
        <div className="mb-3.5 grid grid-cols-3 gap-2 border-y border-light py-3">
          <Stat
            value={torneo.pozoBruto.toLocaleString("es-PE")}
            label="Pozo"
            gold
          />
          <Stat
            value={`${torneo.entradaLukas} 🪙`}
            label="Entrada"
          />
          <Stat
            value={torneo.totalInscritos.toString()}
            label="Inscritos"
          />
        </div>

        {/* CTA */}
        <div className="flex gap-2">
          <Link
            href={destination}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm px-4 py-3 text-[13px] font-extrabold transition-all duration-150 ${ctaClasses}`}
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </article>
  );
}

function TeamCol({
  name,
  icon,
  color,
  featured,
}: {
  name: string;
  icon?: string;
  color?: string;
  featured?: boolean;
}) {
  const shieldBg = color
    ? `bg-gradient-to-br ${color}`
    : "bg-subtle";
  const shieldSize = featured ? "h-16 w-16 text-[30px]" : "h-12 w-12 text-[22px]";
  const nameSize = featured ? "text-[22px]" : "text-[17px]";
  return (
    <div className="text-center">
      <div
        aria-hidden
        className={`mx-auto mb-2 flex items-center justify-center rounded-full shadow-sm ${shieldBg} ${shieldSize}`}
      >
        {icon}
      </div>
      <div
        className={`font-display font-black uppercase text-dark ${nameSize}`}
      >
        {name}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  gold = false,
}: {
  value: string;
  label: string;
  gold?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`font-display text-[19px] font-black leading-none ${gold ? "text-brand-gold-dark" : "text-dark"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </div>
    </div>
  );
}
