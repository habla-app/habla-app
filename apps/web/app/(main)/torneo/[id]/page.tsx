// Detalle de torneo — Sub-Sprints 3 + 4.
//
// Público: cualquiera puede ver el detalle, reglas, pozo, inscritos.
// Para armar combinada se requiere sesión (el ComboLauncher maneja el
// redirect a login si no la hay).
//
// CTAs según estado:
//   - ABIERTO         → ComboLauncher (abre modal con torneoId; si ya
//                       hay placeholder, se actualiza en vez de cobrar
//                       entrada)
//   - CERRADO/EN_JUEGO→ Link "Ver ranking en vivo" → /live-match
//   - FINALIZADO      → Link "Ver ranking final" → /live-match
//   - CANCELADO       → Mensaje informativo + Lukas reembolsados

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtener } from "@/lib/services/torneos.service";
import { TorneoNoEncontrado } from "@/lib/services/errors";
import { calcularUrgencia, formatearUrgencyLabel } from "@/lib/urgency";
import { ComboLauncher } from "@/components/combo/ComboLauncher";

interface Props {
  params: { id: string };
}

export default async function TorneoDetallePage({ params }: Props) {
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
  const urgency = calcularUrgencia(torneo.cierreAt, now);
  const urgencyLabel = formatearUrgencyLabel(torneo.cierreAt, urgency, now);
  const isCritical = urgency === "critical";

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pt-6 md:px-6 md:pt-8">
      {/* BREADCRUMB */}
      <nav
        aria-label="breadcrumb"
        className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-d"
      >
        <Link href="/" className="transition-colors hover:text-brand-blue-main">
          Partidos
        </Link>
        <span aria-hidden>›</span>
        <span className="text-dark">
          {partido.equipoLocal} vs {partido.equipoVisita}
        </span>
      </nav>

      {/* DETAIL HEAD — hero azul con status + teams + meta */}
      <section className="mb-6 overflow-hidden rounded-lg bg-hero-blue p-7 text-white shadow-md">
        <StatusBadge estado={torneo.estado} urgencyLabel={urgencyLabel} />

        <div className="mb-5 mt-4 flex flex-wrap items-center justify-center gap-6">
          <div className="text-center">
            <div
              aria-hidden
              className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[30px]"
            >
              ⚽
            </div>
            <div className="font-display text-[18px] font-extrabold uppercase text-white">
              {partido.equipoLocal}
            </div>
          </div>
          <span className="font-display text-[32px] font-black text-white/50">
            VS
          </span>
          <div className="text-center">
            <div
              aria-hidden
              className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[30px]"
            >
              ⚽
            </div>
            <div className="font-display text-[18px] font-extrabold uppercase text-white">
              {partido.equipoVisita}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
          <Stat value={partido.liga} label="Liga" compact />
          <Stat
            value={formatearFechaHora(partido.fechaInicio)}
            label="Inicio"
            compact
          />
          <Stat
            value={`${torneo.entradaLukas} 🪙`}
            label="Entrada"
            compact
          />
          <Stat
            value={torneo.totalInscritos.toString()}
            label="Inscritos"
            compact
          />
        </div>
      </section>

      {/* POZO CARD */}
      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BigStat label="Pozo bruto" value={`${torneo.pozoBruto.toLocaleString("es-PE")} 🪙`} />
        <BigStat
          label="Rake (12%)"
          value={`${Math.floor(torneo.pozoBruto * 0.12).toLocaleString("es-PE")} 🪙`}
          muted
        />
        <BigStat
          label="Pozo neto estimado"
          value={`${Math.floor(torneo.pozoBruto * 0.88).toLocaleString("es-PE")} 🪙`}
          gold
        />
      </section>

      {/* RULES CARD — las 5 predicciones */}
      <section className="mb-6 rounded-md border border-light bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-display text-[22px] font-black uppercase tracking-[0.02em] text-dark">
          Reglas de puntaje
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-body">
          Arma tu combinada de 5 predicciones (máximo <strong>21 puntos</strong>).
          El Sub-Sprint 4 habilita el formulario; por ahora la inscripción crea
          un ticket placeholder.
        </p>
        <ul className="divide-y divide-light">
          <RuleRow n={1} title="Resultado" desc="Local / Empate / Visita" pts={3} />
          <RuleRow n={2} title="Ambos equipos anotan" desc="Sí / No" pts={2} />
          <RuleRow n={3} title="Más de 2.5 goles" desc="Sí / No" pts={2} />
          <RuleRow n={4} title="Habrá tarjeta roja" desc="Sí / No" pts={6} />
          <RuleRow n={5} title="Marcador exacto" desc="Ej. 2-1" pts={8} />
        </ul>
      </section>

      {/* DISTRIBUCIÓN DE PREMIOS */}
      <section className="mb-6 rounded-md border border-light bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-display text-[22px] font-black uppercase tracking-[0.02em] text-dark">
          Distribución del pozo neto
        </h2>
        <ul className="divide-y divide-light text-sm">
          <PremioRow pos="1°" pct={35} pozoNeto={Math.floor(torneo.pozoBruto * 0.88)} />
          <PremioRow pos="2°" pct={20} pozoNeto={Math.floor(torneo.pozoBruto * 0.88)} />
          <PremioRow pos="3°" pct={12} pozoNeto={Math.floor(torneo.pozoBruto * 0.88)} />
          <PremioRow pos="4° – 10°" pct={33} pozoNeto={Math.floor(torneo.pozoBruto * 0.88)} repartido />
        </ul>
      </section>

      {/* CTA */}
      <section>
        <CTA
          estado={torneo.estado}
          torneoId={torneo.id}
          entradaLukas={torneo.entradaLukas}
          session={session}
          yaInscrito={!!miTicket}
          urgent={isCritical}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({
  estado,
  urgencyLabel,
}: {
  estado: string;
  urgencyLabel: string;
}) {
  if (estado === "ABIERTO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
        <span aria-hidden>🟢</span>
        Abierto · Cierra {urgencyLabel}
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-black">
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

function Stat({
  value,
  label,
  compact = false,
}: {
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-display ${compact ? "text-[14px]" : "text-[18px]"} font-extrabold text-white`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/60">
        {label}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  gold = false,
  muted = false,
}: {
  label: string;
  value: string;
  gold?: boolean;
  muted?: boolean;
}) {
  const valueCls = gold
    ? "text-brand-gold-dark"
    : muted
      ? "text-muted-d"
      : "text-dark";
  return (
    <div className="rounded-md border border-light bg-card p-5 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-[28px] font-black leading-none ${valueCls}`}
      >
        {value}
      </div>
    </div>
  );
}

function RuleRow({
  n,
  title,
  desc,
  pts,
}: {
  n: number;
  title: string;
  desc: string;
  pts: number;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <div
        aria-hidden
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-gold-dim font-display text-[15px] font-black text-brand-gold-dark"
      >
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-dark">{title}</div>
        <div className="text-[12px] text-muted-d">{desc}</div>
      </div>
      <div className="flex-shrink-0 rounded-sm bg-brand-gold-dim px-2.5 py-1 font-display text-[14px] font-black text-brand-gold-dark">
        {pts} pts
      </div>
    </li>
  );
}

function PremioRow({
  pos,
  pct,
  pozoNeto,
  repartido = false,
}: {
  pos: string;
  pct: number;
  pozoNeto: number;
  repartido?: boolean;
}) {
  const monto = Math.floor((pozoNeto * pct) / 100);
  return (
    <li className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span className="w-16 font-display text-[14px] font-black text-dark">
          {pos}
        </span>
        <span className="text-[13px] text-muted-d">
          {pct}% del pozo neto{repartido ? " (repartido)" : ""}
        </span>
      </div>
      <span className="font-display text-[16px] font-black text-brand-gold-dark">
        ≈ {monto.toLocaleString("es-PE")} 🪙
      </span>
    </li>
  );
}

function formatearFechaHora(d: Date): string {
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = (d.getMonth() + 1).toString().padStart(2, "0");
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${dd}/${mon} ${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// CTA switch
// ---------------------------------------------------------------------------

function CTA({
  estado,
  torneoId,
  entradaLukas,
  session,
  yaInscrito,
  urgent,
}: {
  estado: string;
  torneoId: string;
  entradaLukas: number;
  session: { user?: { balanceLukas?: number } } | null;
  yaInscrito: boolean;
  urgent: boolean;
}) {
  void entradaLukas;
  if (estado === "ABIERTO") {
    // Abre el ComboModal directamente. Si hay placeholder (yaInscrito),
    // el endpoint sabe reemplazarlo y el header del modal muestra
    // "Entrada: Ya pagada". Si no hay placeholder, se descuenta la
    // entrada al confirmar.
    return (
      <ComboLauncher
        torneoId={torneoId}
        hasSession={!!session?.user}
        callbackUrl={`/torneo/${torneoId}`}
        label={
          yaInscrito
            ? "✏️ Editar mi combinada"
            : urgent
              ? "🔥 Crear combinada"
              : "🎯 Crear combinada"
        }
        variant={urgent ? "urgent" : "primary"}
        className="w-full"
      />
    );
  }

  if (estado === "CERRADO" || estado === "EN_JUEGO") {
    return (
      <Link
        href={`/live-match?torneoId=${torneoId}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue-main px-6 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-white shadow-md transition-all hover:-translate-y-px hover:bg-brand-blue-light"
      >
        Ver ranking en vivo →
      </Link>
    );
  }

  if (estado === "FINALIZADO") {
    return (
      <Link
        href={`/live-match?torneoId=${torneoId}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-light bg-card px-5 py-4 text-center text-[14px] font-semibold text-muted-d transition-all hover:border-brand-blue-main hover:text-brand-blue-main"
      >
        Ver ranking final →
      </Link>
    );
  }

  return (
    <div className="rounded-md border border-alert-info-border bg-alert-info-bg px-5 py-4 text-center text-[14px] font-semibold text-alert-info-text">
      ⏸ Este torneo fue cancelado. Los Lukas de entrada fueron reembolsados
      automáticamente.
    </div>
  );
}
