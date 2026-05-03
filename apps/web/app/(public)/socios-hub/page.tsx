// /socios-hub — Lote N v3.2 · portación literal del
// `<section id="page-socios-hub">` del mockup
// (docs/habla-mockup-v3.2.html líneas 4579-4735).
//
// Hub para Socios activos: picks de hoy, performance histórica, análisis
// profundos, gestión de suscripción.
//
// Si el usuario no es Socio activo → redirect a /socios.
//
// Cero clases Tailwind utility — todo el CSS sale de mockup-styles.css.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { obtenerEstadoPremium } from "@/lib/services/suscripciones.service";
import { PLANES } from "@/lib/premium-planes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi hub Socios · Habla!",
  description: "Hub Socios: picks del día, performance, análisis profundos.",
  robots: { index: false, follow: false },
};

interface PickHoy {
  id: string;
  hora: string;
  liga: string;
  enviadoLabel: string;
  equipos: string;
  mercadoLabel: string;
  cuota: number;
  casa: string;
  evPct: number | null;
  estado: "EN_VIVO" | "PROGRAMADO";
}

const LIGA_ICON: Record<string, string> = {
  "Premier League": "🏆",
  "La Liga": "🏆",
  "Serie A": "🏆",
  "Bundesliga": "🏆",
  "Ligue 1": "🏆",
  "Champions League": "🏆",
  "Liga 1 Perú": "🇵🇪",
  "Liga 1": "🇵🇪",
};

function ligaIcon(liga: string): string {
  return LIGA_ICON[liga] ?? "🏆";
}

function horaLima(fecha: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

function formatMercadoCorto(mercado: string, outcome: string): string {
  switch (mercado) {
    case "RESULTADO_1X2":
      if (outcome === "home") return "Local";
      if (outcome === "draw") return "Empate";
      if (outcome === "away") return "Visita";
      return "1X2";
    case "BTTS":
      return outcome === "btts_si" ? "BTTS Sí" : "BTTS No";
    case "OVER_UNDER_25":
      return outcome === "over" ? "Más 2.5" : "Menos 2.5";
    case "TARJETA_ROJA":
      return outcome === "roja_si" ? "Roja Sí" : "Roja No";
    case "MARCADOR_EXACTO":
      return outcome;
    default:
      return mercado;
  }
}

export default async function SociosHubPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/socios-hub");
  }
  const userId = session.user.id;
  const username = session.user.username ?? "tipster";

  const estadoPremium = await obtenerEstadoPremium(userId).catch(() => null);
  if (!estadoPremium || !estadoPremium.activa) {
    redirect("/socios");
  }

  const ahora = new Date();
  const inicioHoyLima = (() => {
    const d = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return new Date(start.getTime() - d.getTimezoneOffset() * 60000);
  })();
  const finHoyLima = new Date(inicioHoyLima.getTime() + 24 * 60 * 60 * 1000);
  const inicioMes = (() => {
    const d = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
    return new Date(d.getFullYear(), d.getMonth(), 1);
  })();

  // Picks de hoy
  const picksDeHoyRaw = await prisma.pickPremium
    .findMany({
      where: {
        aprobado: true,
        partido: {
          fechaInicio: { gte: inicioHoyLima, lt: finHoyLima },
        },
      },
      orderBy: { partido: { fechaInicio: "asc" } },
      take: 6,
      select: {
        id: true,
        mercado: true,
        outcome: true,
        cuotaSugerida: true,
        evPctSugerido: true,
        enviadoEn: true,
        casaRecomendada: { select: { nombre: true } },
        partido: {
          select: {
            equipoLocal: true,
            equipoVisita: true,
            liga: true,
            fechaInicio: true,
            estado: true,
          },
        },
      },
    })
    .catch(() => []);

  const picksDeHoy: PickHoy[] = picksDeHoyRaw.map((p) => ({
    id: p.id,
    hora: horaLima(p.partido.fechaInicio),
    liga: p.partido.liga,
    enviadoLabel: p.enviadoEn ? `enviado ${horaLima(p.enviadoEn)}` : "programado",
    equipos: `${p.partido.equipoLocal} vs ${p.partido.equipoVisita}`,
    mercadoLabel: formatMercadoCorto(p.mercado, p.outcome),
    cuota: p.cuotaSugerida,
    casa: p.casaRecomendada?.nombre ?? "—",
    evPct: p.evPctSugerido,
    estado: p.partido.estado === "EN_VIVO" ? "EN_VIVO" : "PROGRAMADO",
  }));

  // Performance del último mes
  const aprobadosMes = await prisma.pickPremium
    .findMany({
      where: {
        aprobado: true,
        aprobadoEn: { gte: inicioMes },
      },
      select: {
        evPctSugerido: true,
        cuotaSugerida: true,
        resultadoFinal: true,
      },
    })
    .catch(() => []);

  const evValores = aprobadosMes
    .map((p) => p.evPctSugerido)
    .filter((v): v is number => typeof v === "number");
  const evPromedio =
    evValores.length > 0
      ? evValores.reduce((a, b) => a + b, 0) / evValores.length
      : null;
  const cuotaProm =
    aprobadosMes.length > 0
      ? aprobadosMes.reduce((a, b) => a + b.cuotaSugerida, 0) / aprobadosMes.length
      : null;
  const ganados = aprobadosMes.filter((p) => p.resultadoFinal === "GANADO").length;
  const evaluados = aprobadosMes.filter((p) => p.resultadoFinal !== null).length;
  const aciertosPct = evaluados > 0 ? Math.round((ganados / evaluados) * 100) : null;
  const picksRecibidos = aprobadosMes.length;

  const planKey = estadoPremium.plan;
  const plan = PLANES[planKey];
  const renovacion = estadoPremium.proximoCobro
    ? new Date(estadoPremium.proximoCobro).toLocaleDateString("es-PE", {
        timeZone: "America/Lima",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  const renovacionTexto = estadoPremium.proximoCobro
    ? `Plan ${plan.label} · próxima renovación ${renovacion} · canal sincronizado`
    : `Plan ${plan.label} · canal sincronizado`;

  const channelLink = process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? "#";

  const evHeroLabel =
    evPromedio === null
      ? "—"
      : `${evPromedio >= 0 ? "+" : ""}${(evPromedio * 100).toFixed(1)}%`;
  const aciertosHeroLabel = aciertosPct === null ? "—" : `${aciertosPct}%`;
  const cuotaPromLabel = cuotaProm === null ? "—" : cuotaProm.toFixed(2);

  return (
    <div className="mockup-container">

      {/* Hero hub */}
      <div className="socios-hub-hero">
        <div className="socios-hub-hero-left">
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gold)", fontWeight: 700, marginBottom: 6 }}>
            💎 Hub Socios · Activo
          </div>
          <h1>Hola, @{username}</h1>
          <div style={{ fontSize: 13, color: "rgba(238,242,255,.85)", marginTop: 8 }}>
            {renovacionTexto}
          </div>
        </div>
        <div className="socios-hub-hero-stats">
          <div className="socios-hub-stat">
            <div className="socios-hub-stat-val">{evHeroLabel}</div>
            <div className="socios-hub-stat-lbl">EV+ del mes</div>
          </div>
          <div className="socios-hub-stat">
            <div className="socios-hub-stat-val">{picksRecibidos}</div>
            <div className="socios-hub-stat-lbl">Picks recibidos</div>
          </div>
          <div className="socios-hub-stat">
            <div className="socios-hub-stat-val">{aciertosHeroLabel}</div>
            <div className="socios-hub-stat-lbl">% aciertos picks</div>
          </div>
        </div>
      </div>

      {/* Picks de hoy */}
      <div className="section-bar" style={{ marginTop: 24 }}>
        <div className="section-bar-left">
          <div className="section-bar-icon">🎯</div>
          <div>
            <div className="section-bar-title">Picks de hoy · resumen</div>
            <div className="section-bar-subtitle">Detalle completo en tu canal de WhatsApp</div>
          </div>
        </div>
        <a href={channelLink} target="_blank" rel="noopener noreferrer" className="section-bar-cta">Abrir canal →</a>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {picksDeHoy.length === 0 ? (
          <div className="hub-pick-card">
            <div className="hub-pick-time">—</div>
            <div className="hub-pick-content">
              <div className="hub-pick-meta">Sin picks de hoy todavía</div>
              <div className="hub-pick-equipos">El editor publica entre 2 y 4 picks por día</div>
              <div className="hub-pick-detalle">
                <span className="hub-pick-mercado">Revisá el canal de WhatsApp para alertas</span>
              </div>
            </div>
            <span className="badge badge-gray">—</span>
          </div>
        ) : (
          picksDeHoy.map((pick) => (
            <div key={pick.id} className="hub-pick-card">
              <div className="hub-pick-time">{pick.hora}</div>
              <div className="hub-pick-content">
                <div className="hub-pick-meta">{ligaIcon(pick.liga)} {pick.liga} · {pick.enviadoLabel}</div>
                <div className="hub-pick-equipos">{pick.equipos}</div>
                <div className="hub-pick-detalle">
                  <span className="hub-pick-mercado">{pick.mercadoLabel}</span>
                  <span className="hub-pick-cuota">@ {pick.cuota.toFixed(2)}</span>
                  <span className="hub-pick-casa">{pick.casa}</span>
                  {pick.evPct !== null ? (
                    <span className="hub-pick-ev">EV+ {(pick.evPct * 100).toFixed(1)}%</span>
                  ) : null}
                </div>
              </div>
              <span className={pick.estado === "EN_VIVO" ? "badge badge-blue" : "badge badge-gray"}>
                {pick.estado === "EN_VIVO" ? "En curso" : "Programado"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Performance histórica */}
      <div className="section-bar">
        <div className="section-bar-left">
          <div className="section-bar-icon">📈</div>
          <div>
            <div className="section-bar-title">Performance histórica de los picks</div>
            <div className="section-bar-subtitle">Resultados públicos · transparencia total</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        <div className="perfil-stat-card">
          <div
            className="perfil-stat-val green"
          >
            {evHeroLabel}
          </div>
          <div className="perfil-stat-lbl">EV+ último mes</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val">{aciertosHeroLabel}</div>
          <div className="perfil-stat-lbl">Aciertos último mes</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val">{ganados} / {picksRecibidos}</div>
          <div className="perfil-stat-lbl">Picks ganados</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val gold">{cuotaPromLabel}</div>
          <div className="perfil-stat-lbl">Cuota promedio</div>
        </div>
      </div>

      {/* Análisis profundo (Socios only) */}
      <div className="perfil-section">
        <div className="perfil-section-header">
          <div className="perfil-section-title">🧠 Análisis profundos · solo Socios</div>
          <a className="section-bar-cta">Ver todos →</a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 14, background: "linear-gradient(90deg,#FFFAEB,transparent)", borderLeft: "3px solid var(--gold)", borderRadius: "0 8px 8px 0" }}>
            <div style={{ fontSize: 24 }}>📊</div>
            <div>
              <div style={{ fontWeight: 800, color: "var(--text-dark)", fontSize: 14 }}>Champions cuartos: el value escondido en BTTS</div>
              <div style={{ fontSize: 11, color: "var(--text-muted-d)", marginTop: 2 }}>Análisis quincenal · publicado hace 2 días · 8 min lectura</div>
              <p style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5, marginTop: 6 }}>
                Las casas están sobreajustando los Más 2.5 en partidos europeos de eliminación. Identificamos 3 partidos con BTTS subvaluado para la próxima fecha.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 14, background: "linear-gradient(90deg,#FFFAEB,transparent)", borderLeft: "3px solid var(--gold)", borderRadius: "0 8px 8px 0" }}>
            <div style={{ fontSize: 24 }}>🇵🇪</div>
            <div>
              <div style={{ fontWeight: 800, color: "var(--text-dark)", fontSize: 14 }}>Liga 1 Apertura: ranking de defensas más explotables</div>
              <div style={{ fontSize: 11, color: "var(--text-muted-d)", marginTop: 2 }}>Análisis quincenal · publicado hace 1 sem · 12 min lectura</div>
              <p style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5, marginTop: 6 }}>
                5 equipos con xG en contra en alza, contra los que conviene jugar Local + Más en visita.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suscripción + canal */}
      <div className="suscripcion-card">
        <div className="suscripcion-header">
          <div className="suscripcion-titulo">💎 Mi Suscripción</div>
          <span className="badge badge-green">Activa</span>
        </div>
        <div className="suscripcion-row"><span style={{ color: "var(--text-muted-d)" }}>Plan</span><strong>{plan.label} · S/ {plan.precioSoles}</strong></div>
        <div className="suscripcion-row"><span style={{ color: "var(--text-muted-d)" }}>Próximo cobro</span><strong>{renovacion}</strong></div>
        <div className="suscripcion-row"><span style={{ color: "var(--text-muted-d)" }}>Canal WhatsApp</span><strong style={{ color: "var(--green)" }}>✓ Conectado</strong></div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <a href="/perfil" className="btn btn-ghost btn-sm" style={{ flex: 1, textAlign: "center" }}>Gestionar suscripción</a>
          <a href={channelLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: "center" }}>Abrir canal WhatsApp</a>
        </div>
      </div>

    </div>
  );
}
