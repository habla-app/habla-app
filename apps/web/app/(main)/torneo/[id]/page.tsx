// /torneo/:id — detalle del torneo. Hotfix #5 Bug #13 rediseñó la
// vista como pantalla motivacional para entrar al torneo:
//
//   1. Back button arriba-izquierda (router.back() con fallback).
//   2. Hero del partido (equipos con colores, score VS, liga, venue,
//      kickoff en hora Lima, estado del torneo).
//   3. Hero del "Pozo" (un solo número grande) — NUNCA se expone
//      "pozo neto", "pozo bruto" ni "rake" al jugador.
//   4. Distribución del pozo en Lukas absolutos (35/20/12/33%).
//   5. Pills de stats motivacionales (jugadores, tickets, cierre).
//   6. Lista de inscritos: @handle + nivel + cantidad de tickets.
//      - ABIERTO: sin predicciones (privacidad competitiva).
//      - CERRADO/EN_JUEGO/FINALIZADO: con 5 chips por ticket + puntos.
//   7. CTA estelar — delega a ComboLauncher (hook useComboOpener) para
//      abrir el modal. Sticky al bottom en mobile, inline en desktop.
//
// Público: cualquiera puede ver el detalle. El CTA cambia a /auth/login
// con callbackUrl si no hay sesión (lo maneja ComboLauncher).

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

  // Detectar placeholder default del Sub-Sprint 3 para cambiar el CTA
  // a "Editar mi combinada".
  const tienePlaceholder =
    miTicket !== null &&
    miTicket.predResultado === "LOCAL" &&
    miTicket.predBtts === false &&
    miTicket.predMas25 === false &&
    miTicket.predTarjetaRoja === false &&
    miTicket.predMarcadorLocal === 0 &&
    miTicket.predMarcadorVisita === 0;

  // Cantidad de tickets que tiene el usuario en este torneo (límite 10).
  // El service `obtener` solo devuelve 1 (findFirst) — para el count
  // exacto no disparamos otra query: no aportamos los 10 tickets del
  // usuario a la UI, solo el booleano "¿ya 10?". Reusamos el inscritos
  // listing de abajo.
  const showingAll = searchParams?.inscritosPage === "all";
  const inscritosResult = await listarInscritos(torneo.id, {
    limit: showingAll ? 500 : 20,
  });
  const miInscrito = session?.user?.id
    ? inscritosResult.inscritos.find((i) => i.usuarioId === session.user!.id)
    : null;
  // `miInscrito` puede estar fuera del slice paginado; si no está en la
  // primera página, igual sabemos que el user tiene miTicket !== null.
  // Fallback: si hay miTicket y no se encontró en el slice, asumimos 1.
  const ticketsUsuario = miInscrito
    ? miInscrito.tickets.length
    : miTicket
      ? 1
      : 0;

  const vm = buildTorneoDetailViewModel({
    estado: torneo.estado as EstadoTorneoView,
    pozoBruto: torneo.pozoBruto,
    pozoNeto: torneo.pozoNeto,
    totalInscritos: torneo.totalInscritos,
    entradaLukas: torneo.entradaLukas,
    cierreAt: torneo.cierreAt,
    ticketsUsuario,
    tienePlaceholder,
    now,
  });

  const localColor = getTeamColor(partido.equipoLocal);
  const visitaColor = getTeamColor(partido.equipoVisita);

  return (
    <div
      className="mx-auto w-full max-w-[1040px] px-4 pb-32 pt-5 md:px-6 md:pt-7 lg:pb-10"
      data-testid="torneo-detail-root"
    >
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

      {/* POZO HERO + DISTRIBUCIÓN + STATS (layout en 2 cols desktop) */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* POZO HERO */}
          <section
            className="rounded-lg border-2 border-brand-gold/40 bg-gradient-to-br from-brand-gold-dim to-transparent p-6 text-center shadow-md"
            data-testid="torneo-pozo-hero"
          >
            <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-d">
              Pozo del torneo
            </div>
            <div className="mt-2 font-display text-[56px] font-black leading-none text-brand-gold-dark md:text-[72px]">
              {vm.pozoMostrado.toLocaleString("es-PE")}{" "}
              <span aria-hidden>🪙</span>
            </div>
            <div className="mt-2 text-[12px] text-muted-d">
              Entrada {torneo.entradaLukas} 🪙 · Top 10 se lleva premio
            </div>
          </section>

          {/* STATS PILLS MOTIVACIONALES */}
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
            data-testid="torneo-stats-pills"
          >
            <Pill
              icon="👥"
              value={torneo.totalInscritos.toLocaleString("es-PE")}
              label={
                torneo.totalInscritos === 1
                  ? "Jugador inscrito"
                  : "Jugadores inscritos"
              }
            />
            <Pill
              icon="🎯"
              value={inscritosResult.inscritos
                .reduce((acc, i) => acc + i.tickets.length, 0)
                .toLocaleString("es-PE")}
              label="Tickets enviados"
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
            <Pill
              icon="🏆"
              value={`${(vm.premios[0]?.lukas ?? 0).toLocaleString("es-PE")} 🪙`}
              label="1er premio"
              tone="gold"
            />
          </div>

          {/* DISTRIBUCIÓN DEL POZO (en Lukas absolutos, sin mostrar %).
              Hotfix #6: la curva depende de totalInscritos — mostramos
              top 10 + indicador si hay más pagados. */}
          <section
            className="rounded-md border border-light bg-card p-5 shadow-sm"
            data-testid="torneo-distribucion"
          >
            <h2 className="mb-4 font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
              Cómo se reparte el pozo
            </h2>
            <ul className="divide-y divide-light text-[14px]">
              {vm.premios.slice(0, 10).map((p) => (
                <PremioRow
                  key={p.posicion}
                  pos={posIcon(p.posicion)}
                  lukas={p.lukas}
                  highlight={p.posicion === 1}
                />
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-d">
              {vm.pagados === 0
                ? "Aún no se definen pagados — el torneo necesita al menos 2 inscritos."
                : vm.pagados > 10
                  ? `Pagan los primeros ${vm.pagados} puestos — se muestran los 10 mejores. El pozo puede crecer hasta el cierre.`
                  : `Pagan los primeros ${vm.pagados} puestos. El pozo puede crecer hasta el cierre.`}
            </p>
          </section>

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

          {/* CTA DESKTOP (inline — el sticky va fijo al bottom en mobile) */}
          <div className="hidden lg:block">
            <TorneoStickyCTA
              torneoId={torneo.id}
              hasSession={!!session?.user}
              cta={vm.cta}
              callbackUrl={`/torneo/${torneo.id}`}
            />
          </div>
        </div>

        {/* SIDEBAR STICKY — Reglas de puntaje (solo desktop; en mobile
            va como accordion arriba de inscritos) */}
        <div className="lg:sticky lg:top-[88px] lg:self-start">
          <RulesCard />
        </div>
      </div>

      {/* CTA MOBILE (sticky al bottom; hidden en desktop porque el inline
          se muestra inline arriba) */}
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
  tone?: "normal" | "gold" | "live" | "muted";
}) {
  const valueCls =
    tone === "gold"
      ? "text-brand-gold-dark"
      : tone === "live"
        ? "text-urgent-critical"
        : tone === "muted"
          ? "text-muted-d"
          : "text-dark";
  const borderCls =
    tone === "gold"
      ? "border-brand-gold/40 bg-brand-gold-dim"
      : "border-light bg-card";
  return (
    <div
      className={`rounded-md border px-3 py-3 text-center shadow-sm ${borderCls}`}
    >
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

function PremioRow({
  pos,
  lukas,
  highlight = false,
}: {
  pos: string;
  lukas: number;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <span
        className={`font-display text-[14px] font-extrabold ${
          highlight ? "text-brand-gold-dark" : "text-dark"
        }`}
      >
        {pos}
      </span>
      <span
        className={`font-display text-[16px] font-black ${
          highlight ? "text-brand-gold-dark" : "text-dark"
        }`}
      >
        {lukas.toLocaleString("es-PE")} 🪙
      </span>
    </li>
  );
}

function posIcon(p: number): string {
  if (p === 1) return "🥇 1°";
  if (p === 2) return "🥈 2°";
  if (p === 3) return "🥉 3°";
  return `${p}°`;
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
        Se cierran las inscripciones 5 min antes del partido.
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
  // guard — `now` unused si no caímos en ABIERTO; lo forzamos a leer
  // para evitar warning de lint en algunas configs.
  void now;
  return "—";
}

