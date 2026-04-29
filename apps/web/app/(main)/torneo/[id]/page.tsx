// /torneo/:id — detalle del torneo.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. La página ya no
// muestra pozo, entrada ni distribución de premios. Pasa a ser una vista
// puramente de competencia: hero del partido + "X tipsters compitiendo"
// + lista de inscritos + reglas de puntaje + CTA "Hacer mi predicción".

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  listarInscritos,
  obtener,
} from "@/lib/services/torneos.service";
import { TorneoNoEncontrado } from "@/lib/services/errors";
import {
  buildTorneoDetailViewModel,
  type EstadoTorneoView,
} from "@/lib/utils/torneo-detail-view";
import { formatKickoff, formatCountdown } from "@/lib/utils/datetime";
import { getTeamColor, getTeamInitials } from "@/lib/utils/team-colors";
import { BackButton } from "@/components/torneos/BackButton";
import { InscritosList } from "@/components/torneos/InscritosList";
import { TorneoStickyCTA } from "@/components/torneos/TorneoStickyCTA";

interface Props {
  params: { id: string };
  searchParams?: { inscritosPage?: string };
}

export default async function TorneoDetallePage({ params, searchParams }: Props) {
  const session = await auth();
  let data;
  try {
    data = await obtener(params.id, session?.user?.id);
  } catch (err) {
    if (err instanceof TorneoNoEncontrado) notFound();
    throw err;
  }

  const { torneo, miTicket } = data;
  const { partido } = torneo;
  const now = new Date();

  const tienePlaceholder =
    miTicket !== null &&
    miTicket.predResultado === "LOCAL" &&
    miTicket.predBtts === false &&
    miTicket.predMas25 === false &&
    miTicket.predTarjetaRoja === false &&
    miTicket.predMarcadorLocal === 0 &&
    miTicket.predMarcadorVisita === 0;

  const showingAll = searchParams?.inscritosPage === "all";
  const inscritosResult = await listarInscritos(torneo.id, {
    limit: showingAll ? 500 : 20,
  });
  const miInscrito = session?.user?.id
    ? inscritosResult.inscritos.find((i) => i.usuarioId === session.user!.id)
    : null;
  const ticketsUsuario = miInscrito
    ? miInscrito.tickets.length
    : miTicket
      ? 1
      : 0;

  const vm = buildTorneoDetailViewModel({
    estado: torneo.estado as EstadoTorneoView,
    totalInscritos: torneo.totalInscritos,
    cierreAt: torneo.cierreAt,
    ticketsUsuario,
    tienePlaceholder,
    now,
  });

  const localColor = getTeamColor(partido.equipoLocal);
  const visitaColor = getTeamColor(partido.equipoVisita);
  const totalTickets = inscritosResult.inscritos.reduce(
    (acc, i) => acc + i.tickets.length,
    0,
  );

  return (
    <div
      className="mx-auto w-full max-w-[1040px] px-4 pb-32 pt-5 md:px-6 md:pt-7 lg:pb-10"
      data-testid="torneo-detail-root"
    >
      <TorneoJsonLd
        torneoId={torneo.id}
        equipoLocal={partido.equipoLocal}
        equipoVisita={partido.equipoVisita}
        liga={partido.liga}
        fechaInicio={partido.fechaInicio}
        venue={partido.venue ?? null}
      />
      <div className="mb-4">
        <BackButton fallbackHref="/matches" />
      </div>

      {/* MATCH HEADER */}
      <section className="mb-5 overflow-hidden rounded-lg bg-hero-blue p-6 text-white shadow-md md:p-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.06em]">
          <span className="rounded-full bg-white/15 px-3 py-1 text-white/80">
            🏆 {partido.liga}
            {partido.round && <> · {partido.round}</>}
          </span>
          <StatusBadge estado={vm.estadoResuelto} />
        </div>

        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
          <TeamBlock
            name={partido.equipoLocal}
            bg={localColor.bg}
            fg={localColor.fg}
          />
          <div className="text-center">
            <div className="font-display text-[42px] font-black leading-none text-white/80 md:text-[56px]">
              VS
            </div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">
              {formatKickoff(partido.fechaInicio)}
            </div>
          </div>
          <TeamBlock
            name={partido.equipoVisita}
            bg={visitaColor.bg}
            fg={visitaColor.fg}
            align="right"
          />
        </div>

        {partido.venue && (
          <div className="text-center text-[11px] text-white/60">
            📍 {partido.venue}
          </div>
        )}
      </section>

      {/* INSCRITOS HERO + STATS + LISTA */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* COMPITEN HERO */}
          <section
            className="rounded-lg border-2 border-brand-gold/40 bg-gradient-to-br from-brand-gold-dim to-transparent p-6 text-center shadow-md"
            data-testid="torneo-compiten-hero"
          >
            <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-d">
              {totalTickets === 1
                ? "Predicción enviada"
                : "Predicciones enviadas"}
            </div>
            <div className="mt-2 font-display text-[56px] font-black leading-none text-brand-gold-dark md:text-[72px]">
              {torneo.totalInscritos.toLocaleString("es-PE")}
            </div>
            <div className="mt-2 text-[14px] font-bold text-dark">
              {torneo.totalInscritos === 1 ? "tipster" : "tipsters"} compitiendo
            </div>
            <div className="mt-1 text-[11px] text-muted-d">
              Suben en el ranking según los puntos que sume su combinada.
            </div>
          </section>

          {/* STATS PILLS MOTIVACIONALES */}
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-3"
            data-testid="torneo-stats-pills"
          >
            <Pill
              icon="👥"
              value={torneo.totalInscritos.toLocaleString("es-PE")}
              label={
                torneo.totalInscritos === 1
                  ? "Tipster compitiendo"
                  : "Tipsters compitiendo"
              }
            />
            <Pill
              icon="🎯"
              value={totalTickets.toLocaleString("es-PE")}
              label="Combinadas enviadas"
            />
            <Pill
              icon={vm.estadoResuelto === "EN_JUEGO" ? "🔴" : "⏱"}
              value={estadoCopy(vm.estadoResuelto, torneo.cierreAt, now)}
              label={
                vm.estadoResuelto === "ABIERTO" ? "Cierra" : "Estado"
              }
              tone={
                vm.estadoResuelto === "EN_JUEGO"
                  ? "live"
                  : vm.estadoResuelto === "ABIERTO"
                    ? "normal"
                    : "muted"
              }
            />
          </div>

          {/* INSCRITOS */}
          <InscritosList
            inscritos={inscritosResult.inscritos}
            total={inscritosResult.total}
            mostrarPredicciones={vm.mostrarPredicciones}
            equipoLocal={partido.equipoLocal}
            equipoVisita={partido.equipoVisita}
            torneoId={torneo.id}
            showingAll={showingAll}
          />

          <div className="lg:hidden">
            <RulesCard />
          </div>
        </div>

        {/* SIDEBAR DESKTOP — CTA estelar arriba + Reglas abajo. */}
        <div className="hidden flex-col gap-4 lg:sticky lg:top-[88px] lg:flex lg:self-start">
          <TorneoStickyCTA
            torneoId={torneo.id}
            hasSession={!!session?.user}
            cta={vm.cta}
            callbackUrl={`/torneo/${torneo.id}`}
          />
          <RulesCard />
        </div>
      </div>

      {/* CTA MOBILE sticky al bottom. */}
      <div className="lg:hidden">
        <TorneoStickyCTA
          torneoId={torneo.id}
          hasSession={!!session?.user}
          cta={vm.cta}
          callbackUrl={`/torneo/${torneo.id}`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ estado }: { estado: EstadoTorneoView }) {
  if (estado === "ABIERTO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
        <span aria-hidden>🟢</span> Abierto
      </span>
    );
  }
  if (estado === "CERRADO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
        <span aria-hidden>🔒</span> Cerrado
      </span>
    );
  }
  if (estado === "EN_JUEGO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-urgent-critical px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
        <span
          aria-hidden
          className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-white"
        />
        En vivo
      </span>
    );
  }
  if (estado === "FINALIZADO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-black">
        <span aria-hidden>✅</span> Finalizado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
      <span aria-hidden>⏸</span> Cancelado
    </span>
  );
}

function TeamBlock({
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
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        aria-hidden
        className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full font-display text-[18px] font-black shadow-sm md:h-16 md:w-16 md:text-[22px]"
        style={{ background: bg, color: fg }}
      >
        {getTeamInitials(name)}
      </div>
      <div className="font-display text-[16px] font-extrabold uppercase leading-tight md:text-[20px]">
        {name}
      </div>
    </div>
  );
}

function Pill({
  icon,
  value,
  label,
  tone = "normal",
}: {
  icon: string;
  value: string;
  label: string;
  tone?: "normal" | "live" | "muted";
}) {
  const valueCls =
    tone === "live"
      ? "text-urgent-critical"
      : tone === "muted"
        ? "text-muted-d"
        : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card px-3 py-3 text-center shadow-sm">
      <div aria-hidden className="text-[16px] leading-none">
        {icon}
      </div>
      <div
        className={`mt-1 font-display text-[16px] font-black leading-none ${valueCls}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </div>
    </div>
  );
}

function RulesCard() {
  return (
    <aside
      className="rounded-md border border-light bg-card p-5 shadow-sm"
      data-testid="torneo-rules-card"
    >
      <h3 className="mb-3 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-dark">
        Reglas de puntaje
      </h3>
      <p className="mb-3 text-[12px] leading-relaxed text-body">
        Armá tu combinada de 5 predicciones — máximo{" "}
        <strong>21 puntos</strong>.
      </p>
      <ul className="space-y-2 text-[13px]">
        <RuleRowCompact n={1} title="Resultado" pts={3} />
        <RuleRowCompact n={2} title="Ambos anotan" pts={2} />
        <RuleRowCompact n={3} title="Más de 2.5 goles" pts={2} />
        <RuleRowCompact n={4} title="Tarjeta roja" pts={6} />
        <RuleRowCompact n={5} title="Marcador exacto" pts={8} />
      </ul>
      <p className="mt-3 text-[11px] text-muted-d">
        Las inscripciones se cierran al inicio del partido.
      </p>
    </aside>
  );
}

function RuleRowCompact({
  n,
  title,
  pts,
}: {
  n: number;
  title: string;
  pts: number;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-gold-dim font-display text-[11px] font-black text-brand-gold-dark"
      >
        {n}
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-dark">
        {title}
      </span>
      <span className="flex-shrink-0 rounded-sm bg-brand-gold-dim px-2 py-0.5 font-display text-[11px] font-black text-brand-gold-dark">
        {pts} pts
      </span>
    </li>
  );
}

function TorneoJsonLd({
  torneoId,
  equipoLocal,
  equipoVisita,
  liga,
  fechaInicio,
  venue,
}: {
  torneoId: string;
  equipoLocal: string;
  equipoVisita: string;
  liga: string;
  fechaInicio: Date;
  venue: string | null;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${equipoLocal} vs ${equipoVisita} — ${liga}`,
    description: `Torneo de predicciones de Habla! para ${equipoLocal} vs ${equipoVisita}.`,
    startDate: fechaInicio.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    sport: "Football",
    url: `${baseUrl}/torneo/${torneoId}`,
    homeTeam: { "@type": "SportsTeam", name: equipoLocal },
    awayTeam: { "@type": "SportsTeam", name: equipoVisita },
    location: venue
      ? { "@type": "Place", name: venue }
      : { "@type": "VirtualLocation", url: `${baseUrl}/torneo/${torneoId}` },
    organizer: { "@type": "Organization", name: "Habla!", url: baseUrl },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function estadoCopy(
  estado: EstadoTorneoView,
  cierreAt: Date,
  now: Date,
): string {
  if (estado === "ABIERTO") {
    return formatCountdown(cierreAt).replace(/^Cierra en\s*/i, "");
  }
  if (estado === "EN_JUEGO") return "EN VIVO";
  if (estado === "CERRADO") return "Esperando inicio";
  if (estado === "FINALIZADO") return "Finalizado";
  if (estado === "CANCELADO") return "Cancelado";
  void now;
  return "—";
}
