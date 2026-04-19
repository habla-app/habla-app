// MatchCard v4 — diseño compacto (~150px) con pozo dorado featured,
// avatares hash-color y CTA lateral 110px. Responsive: <640px el CTA
// pasa a fila inferior full-width.
//
// Props: MatchCardData trae los datos crudos del torneo + partido; los
// labels de kickoff/countdown/urgencia se calculan en render. El server
// resuelve todo en el primer pass.
//
// Hotfix 19 Abr (Bug #2): el CTA lateral ahora es MatchCardCTA (client),
// que abre el ComboModal inline sin salir de /matches. El resto del card
// (accent bar + body) va envuelto en un `<Link>` hacia `/torneo/:id` —
// así el usuario sigue pudiendo navegar al detalle haciendo click en la
// zona del body (para ver reglas/pozo antes de inscribirse), pero el
// botón dorado ya no navega: abre el modal directo. Los dos targets son
// hermanos en el árbol (no nested) para evitar `<a>` dentro de `<a>`.
import Link from "next/link";
import {
  formatCountdown,
  formatKickoff,
  urgencyLevel,
  type UrgencyTier,
} from "@/lib/utils/datetime";
import { getTeamColor, getTeamInitials } from "@/lib/utils/team-colors";
import { MatchCardCTA } from "./MatchCardCTA";

export interface MatchCardData {
  id: string;
  liga: string;
  round: string | null;
  venue: string | null;
  equipoLocal: string;
  equipoVisita: string;
  pozoBruto: number;
  entradaLukas: number;
  totalInscritos: number;
  fechaInicio: Date;
  cierreAt: Date;
}

interface MatchCardProps {
  torneo: MatchCardData;
  /** Si hay sesión, el CTA abre el modal directo. Si no, va a login
   *  con el callbackUrl armado por el caller. */
  hasSession: boolean;
  /** URL a la que volver post-login si el usuario sin sesión clickea el
   *  CTA. Debe incluir `?openCombo=<torneoId>` para que
   *  AutoOpenComboFromQuery detecte la intención al volver. */
  ctaCallbackUrl: string;
}

// ---------------------------------------------------------------------------
// Tokens derivados
// ---------------------------------------------------------------------------

const URGENCY_TEXT_CLASS: Record<UrgencyTier, string> = {
  crit: "text-urgent-critical",
  high: "text-urgent-high",
  med: "text-brand-gold-dark",
  low: "text-muted-d",
};

const URGENCY_WEIGHT_CLASS: Record<UrgencyTier, string> = {
  crit: "font-extrabold",
  high: "font-bold",
  med: "font-semibold",
  low: "font-medium",
};

/**
 * Accent bar color por liga. No usamos tokens Tailwind porque el color
 * se aplica como `style.background` para ser tintable contra fondos
 * variables.
 */
function getLigaAccent(liga: string): string {
  const L = liga.toLowerCase();
  if (L.includes("mundial")) return "#8B5CF6"; // accent-mundial
  if (L.includes("champions")) return "#1E3A8A"; // accent-champions-dark
  if (L.includes("libertadores")) return "#059669"; // accent-libertadores
  if (L.includes("premier")) return "#7C3AED"; // violet
  if (L.includes("la liga")) return "#DC2626"; // clasico red
  if (L.includes("liga 1") || L.includes("peru")) return "#B45309"; // amber
  return "#FFB800"; // brand-gold fallback
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function MatchCard({ torneo, hasSession, ctaCallbackUrl }: MatchCardProps) {
  const urgency = urgencyLevel(torneo.cierreAt);
  const kickoff = formatKickoff(torneo.fechaInicio);
  const countdown = formatCountdown(torneo.cierreAt);

  const accentColor = getLigaAccent(torneo.liga);
  const detalleHref = `/torneo/${torneo.id}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md sm:flex-row">
      {/* Body clickable → /torneo/:id. Accent bar + body viven dentro del
          mismo Link, de modo que el click en cualquier parte del body
          (excepto el CTA lateral que es hermano) navega al detalle. */}
      <Link
        href={detalleHref}
        aria-label={`Ver detalle del torneo ${torneo.equipoLocal} vs ${torneo.equipoVisita}`}
        className="flex min-w-0 flex-1 flex-col sm:flex-row"
      >
        {/* accent bar izquierda (desktop) / superior (mobile) */}
        <span
          aria-hidden
          className="h-1 w-full flex-shrink-0 sm:h-auto sm:w-1"
          style={{ background: accentColor }}
        />

        {/* body */}
        <div className="min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
          {/* header: liga·round + kickoff/countdown */}
          <header className="mb-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                {torneo.liga.toUpperCase()}
                {torneo.round && (
                  <>
                    <span className="mx-1.5 text-soft">·</span>
                    <span>{torneo.round.toUpperCase()}</span>
                  </>
                )}
              </div>
              {torneo.venue && (
                <div className="truncate text-[11px] leading-snug text-soft">
                  {torneo.venue}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end">
              <span className="font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-dark">
                {kickoff}
              </span>
              <span
                className={`text-[11px] ${URGENCY_TEXT_CLASS[urgency]} ${URGENCY_WEIGHT_CLASS[urgency]}`}
              >
                {countdown}
              </span>
            </div>
          </header>

          {/* teams row */}
          <div className="my-2 flex items-center gap-3">
            <TeamAvatar name={torneo.equipoLocal} />
            <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold uppercase text-dark">
              {torneo.equipoLocal}
            </span>
            <span className="flex-shrink-0 font-display text-[15px] font-black text-soft">
              VS
            </span>
            <span className="min-w-0 flex-1 truncate text-right font-display text-[15px] font-extrabold uppercase text-dark">
              {torneo.equipoVisita}
            </span>
            <TeamAvatar name={torneo.equipoVisita} />
          </div>

          {/* stats row: entrada | pozo (featured 1.7fr) | jugadores */}
          <div className="mt-2.5 grid grid-cols-[1fr_1.7fr_1fr] gap-2">
            <StatBox
              label="ENTRADA"
              value={`${torneo.entradaLukas.toLocaleString("es-PE")} 🪙`}
              variant="neutral"
            />
            <StatBox
              label="POZO EN JUEGO"
              value={`${torneo.pozoBruto.toLocaleString("es-PE")} 🪙`}
              variant="featured"
            />
            <StatBox
              label="JUGADORES"
              value={torneo.totalInscritos.toLocaleString("es-PE")}
              variant="neutral-green"
            />
          </div>
        </div>
      </Link>

      {/* CTA — hermano del Link del body. Abre ComboModal directamente. */}
      <MatchCardCTA
        torneoId={torneo.id}
        hasSession={hasSession}
        callbackUrl={ctaCallbackUrl}
      />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function TeamAvatar({ name }: { name: string }) {
  const color = getTeamColor(name);
  const initials = getTeamInitials(name);
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-black uppercase shadow-sm"
      style={{ background: color.bg, color: color.fg }}
    >
      {initials}
    </div>
  );
}

type StatVariant = "neutral" | "featured" | "neutral-green";

const STAT_VARIANT_CLASSES: Record<
  StatVariant,
  { wrap: string; label: string; value: string }
> = {
  neutral: {
    wrap: "bg-brand-blue-main/[0.06] border border-light",
    label: "text-muted-d",
    value: "text-dark text-[18px]",
  },
  featured: {
    wrap: "bg-brand-gold/[0.18] border-[1.5px] border-brand-gold/55 shadow-sm",
    label: "text-[#7A5500]",
    value: "text-brand-gold-dark text-[22px]",
  },
  "neutral-green": {
    wrap: "bg-brand-green/[0.12] border border-light",
    label: "text-muted-d",
    value: "text-dark text-[18px]",
  },
};

function StatBox({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: StatVariant;
}) {
  const cls = STAT_VARIANT_CLASSES[variant];
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-sm px-2 py-1.5 ${cls.wrap}`}
    >
      <span
        className={`text-[9px] font-bold uppercase tracking-[0.06em] ${cls.label}`}
      >
        {label}
      </span>
      <span
        className={`font-display font-black leading-tight ${cls.value}`}
      >
        {value}
      </span>
    </div>
  );
}
