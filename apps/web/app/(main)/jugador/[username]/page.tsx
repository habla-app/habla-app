// /jugador/[username] — Lote N v3.2 · portación literal del
// `<section id="page-jugador">` del mockup
// (docs/habla-mockup-v3.2.html líneas 4442-4574).
//
// Perfil público de otro tipster. Solo accesible para usuarios logueados
// (regla del mockup: "Esta vista solo está disponible para usuarios
// registrados" — el footer lo afirma textualmente).
//
// Cero clases Tailwind utility — todo el CSS sale de mockup-styles.css.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { obtenerPerfilPublico } from "@/lib/services/perfil-publico.service";
import { tienePremiumActivo } from "@/lib/services/suscripciones.service";
import type { PerfilPublicoVista } from "@/lib/services/perfil-publico.service";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) {
    return { title: "Tipster no encontrado · Habla!", robots: { index: false } };
  }
  if (perfil.privacidad === "privado") {
    return {
      title: `@${perfil.username} · Habla!`,
      description: "Este tipster mantiene su perfil privado.",
      robots: { index: false },
    };
  }
  return {
    title: `@${perfil.username} · Tipster en La Liga Habla!`,
    description: `Trayectoria y predicciones recientes de @${perfil.username}: ${perfil.stats.jugadas} predicciones, ${Math.round(perfil.stats.aciertoPct)}% acierto.`,
    alternates: { canonical: `/jugador/${perfil.username}` },
  };
}

function iniciales(nombre: string, fallback: string): string {
  const fuente = (nombre || fallback || "").trim();
  if (!fuente) return "??";
  const partes = fuente.split(/\s+/).filter(Boolean).slice(0, 2);
  return partes.map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || fuente.slice(0, 2).toUpperCase();
}

function formatFechaCorta(d: Date): string {
  return `${MES_CORTO[d.getMonth()] ?? ""} ${d.getFullYear()}`;
}

function labelFechaCorta(d: Date, ahora: Date = new Date()): string {
  const tzAhora = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const tzD = new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const sameDay =
    tzAhora.getFullYear() === tzD.getFullYear() &&
    tzAhora.getMonth() === tzD.getMonth() &&
    tzAhora.getDate() === tzD.getDate();
  if (sameDay) return "Hoy";
  const ayer = new Date(tzAhora.getTime() - 24 * 60 * 60 * 1000);
  if (ayer.getFullYear() === tzD.getFullYear() && ayer.getMonth() === tzD.getMonth() && ayer.getDate() === tzD.getDate()) return "Ayer";
  return `${tzD.getDate()} ${MES_CORTO[tzD.getMonth()] ?? ""}`;
}

function horaLima(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function labelPred(p: string): string {
  if (p === "LOCAL") return "Local";
  if (p === "EMPATE") return "Empate";
  if (p === "VISITA") return "Visita";
  return p;
}

interface TrayectoriaMes {
  mes: string;
  nombreMes: string;
  posicion: number | null;
  aciertoPct: number | null;
  puntos: number;
  enCurso: boolean;
}

async function obtenerTrayectoria(usuarioId: string, n: number): Promise<TrayectoriaMes[]> {
  const ahora = new Date();
  const tz = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const out: TrayectoriaMes[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(tz.getFullYear(), tz.getMonth() - i, 1);
    const mesKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const nombreMes = `${MESES_LARGO[d.getMonth()] ?? ""} ${d.getFullYear()}`;
    if (i === 0) {
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const tickets = await prisma.ticket
        .findMany({
          where: {
            usuarioId,
            torneo: {
              partido: { fechaInicio: { gte: inicio, lt: fin } },
              estado: "FINALIZADO",
            },
          },
          select: { puntosFinales: true, posicionFinal: true },
        })
        .catch(() => []);
      const puntos = tickets.reduce((a, b) => a + (b.puntosFinales ?? 0), 0);
      const top10 = tickets.filter((t) => (t.posicionFinal ?? 1000) <= 10).length;
      const aciertoPct = tickets.length > 0 ? Math.round((top10 / tickets.length) * 100) : null;
      out.push({ mes: mesKey, nombreMes, posicion: null, aciertoPct, puntos, enCurso: true });
    } else {
      const lb = await prisma.leaderboard.findUnique({ where: { mes: mesKey } }).catch(() => null);
      if (!lb) {
        out.push({ mes: mesKey, nombreMes, posicion: null, aciertoPct: null, puntos: 0, enCurso: false });
        continue;
      }
      const arr = (lb.posiciones as Array<{ userId: string; posicion: number; puntos: number }>) ?? [];
      const fila = arr.find((f) => f.userId === usuarioId) ?? null;
      out.push({
        mes: mesKey,
        nombreMes,
        posicion: fila?.posicion ?? null,
        aciertoPct: null,
        puntos: fila?.puntos ?? 0,
        enCurso: false,
      });
    }
  }
  return out;
}

export default async function JugadorPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/jugador/${params.username}`);
  }

  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) notFound();

  if (perfil.privacidad === "privado") {
    return <PerfilPrivado username={perfil.username} />;
  }

  // Resolver usuarioId del perfil para queries adicionales
  const usuarioPerfil = await prisma.usuario.findFirst({
    where: { username: { equals: perfil.username, mode: "insensitive" }, deletedAt: null },
    select: { id: true },
  });
  const usuarioPerfilId = usuarioPerfil?.id ?? null;

  const esSocio = usuarioPerfilId
    ? await tienePremiumActivo(usuarioPerfilId).catch(() => false)
    : false;

  const trayectoria = usuarioPerfilId ? await obtenerTrayectoria(usuarioPerfilId, 4) : [];

  // Δ semana sobre el usuario del perfil (no el viewer)
  const ahora = new Date();
  const haceSietedias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const ticketsMes = usuarioPerfilId
    ? await prisma.ticket
        .findMany({
          where: {
            usuarioId: usuarioPerfilId,
            torneo: {
              partido: { fechaInicio: { gte: inicioMes, lt: finMes } },
              estado: "FINALIZADO",
            },
          },
          select: { puntosFinales: true, creadoEn: true },
        })
        .catch(() => [])
    : [];
  const puntosMes = ticketsMes.reduce((a, b) => a + (b.puntosFinales ?? 0), 0);
  const puntosHasta7 = ticketsMes
    .filter((t) => t.creadoEn < haceSietedias)
    .reduce((a, b) => a + (b.puntosFinales ?? 0), 0);
  const deltaSemana = puntosMes - puntosHasta7;

  const ini = iniciales(perfil.nombre, perfil.username);
  const fechaMiembro = formatFechaCorta(perfil.desde);
  const posLabel = perfil.mensual.posicionDelMes !== null ? `#${perfil.mensual.posicionDelMes}` : "—";
  const totalTipsters = perfil.mensual.totalUsuariosMes;
  const aciertoLabel = `${Math.round(perfil.stats.aciertoPct)}%`;

  return (
    <div className="container">
      <Link
        href="/liga"
        style={{ fontSize: 12, color: "var(--blue-main)", fontWeight: 700, marginBottom: 14, display: "inline-block" }}
      >
        ← Ranking de la Liga
      </Link>

      <PersonJsonLd perfil={perfil} />

      {/* Hero del jugador */}
      <div className="perfil-hero">
        <div className="perfil-avatar-big" style={{ background: "linear-gradient(135deg,#0EA5E9,#3B82F6)" }}>{ini}</div>
        <div className="perfil-info" style={{ flex: 1 }}>
          <h1>@{perfil.username}</h1>
          <div className="perfil-username">{perfil.nombre || "—"} · jugando desde {fechaMiembro}</div>
          <div className="perfil-badges">
            {perfil.mensual.posicionDelMes !== null && perfil.mensual.posicionDelMes <= 10 ? (
              <span className="badge badge-gold">🏆 Top {perfil.mensual.posicionDelMes} del mes</span>
            ) : null}
            <span className="badge badge-green">{aciertoLabel} acierto</span>
            {esSocio ? <span className="badge badge-blue">Socio</span> : null}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.2)" }}
        >
          📨 Seguir
        </button>
      </div>

      {/* Stats principales */}
      <div className="perfil-stats-grid">
        <div className="perfil-stat-card">
          <div className="perfil-stat-val gold">{puntosMes}</div>
          <div className="perfil-stat-lbl">Puntos del mes</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val gold">{posLabel}</div>
          <div className="perfil-stat-lbl">Posición · {totalTipsters} tipsters</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val">{aciertoLabel}</div>
          <div className="perfil-stat-lbl">% acierto general</div>
        </div>
        <div className="perfil-stat-card">
          <div className={deltaSemana >= 0 ? "perfil-stat-val green" : "perfil-stat-val"}>
            {deltaSemana >= 0 ? "+" : ""}{deltaSemana}
          </div>
          <div className="perfil-stat-lbl">Δ semana</div>
        </div>
      </div>

      {/* Trayectoria */}
      <div className="perfil-section">
        <div className="perfil-section-header">
          <div className="perfil-section-title">📊 Trayectoria · últimos {trayectoria.length} meses</div>
        </div>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px 0", letterSpacing: ".04em" }}>Mes</th>
              <th style={{ textAlign: "center", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px", letterSpacing: ".04em" }}>Pos</th>
              <th style={{ textAlign: "center", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px", letterSpacing: ".04em" }}>% acierto</th>
              <th style={{ textAlign: "right", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px 0", letterSpacing: ".04em" }}>Puntos</th>
            </tr>
          </thead>
          <tbody>
            {trayectoria.map((m, idx) => {
              const top10 = m.posicion !== null && m.posicion <= 10;
              const fondo = idx === 0 ? { background: "rgba(255,184,0,.05)" } : {};
              return (
                <tr key={m.mes} style={{ borderTop: "1px solid var(--border-light)", ...fondo }}>
                  <td style={{ padding: "10px 0" }}>
                    <strong>{m.nombreMes}</strong>{m.enCurso ? " · en curso" : ""}
                  </td>
                  <td style={{ textAlign: "center", padding: 10, color: top10 ? "var(--gold)" : undefined, fontWeight: top10 ? 800 : 700 }}>
                    {m.posicion === null ? "—" : top10 ? `🏆 #${m.posicion}` : `#${m.posicion}`}
                  </td>
                  <td style={{ textAlign: "center", padding: 10, color: m.aciertoPct !== null && m.aciertoPct >= 50 ? "var(--green)" : undefined, fontWeight: 700 }}>
                    {m.aciertoPct !== null ? `${m.aciertoPct}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "10px 0", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
                    {m.puntos}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Predicciones recientes (públicas) */}
      <div className="perfil-section">
        <div className="perfil-section-header">
          <div className="perfil-section-title">🎯 Predicciones recientes</div>
        </div>

        <div className="predicciones-list">
          {perfil.ultimasFinalizadas.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted-d)", textAlign: "center", padding: "16px 0" }}>
              Este tipster aún no tiene predicciones finalizadas públicas.
            </div>
          ) : (
            perfil.ultimasFinalizadas.map((t) => {
              const meta = `${t.partidoLiga} · ${labelPred(t.predResultado)}`;
              return (
                <div key={t.id} className="prediccion-item">
                  <div className="prediccion-fecha">{labelFechaCorta(t.partidoFechaInicio)}<br />{horaLima(t.partidoFechaInicio)}</div>
                  <div>
                    <div className="prediccion-partido">{t.partidoEquipoLocal} vs {t.partidoEquipoVisita}</div>
                    <div className="prediccion-meta">{meta}</div>
                  </div>
                  {t.puntosFinales > 0 ? (
                    <span className="badge badge-green">{t.puntosFinales} pts</span>
                  ) : (
                    <span className="badge badge-gray">— pts</span>
                  )}
                  <span className={t.puntosFinales > 0 ? "prediccion-pts" : "prediccion-pts zero"}>
                    {t.puntosFinales > 0 ? `+${t.puntosFinales} pts` : "— pts"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted-d)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Las predicciones son públicas para todos los miembros de la Liga Habla! · Esta vista solo está disponible para usuarios registrados.
      </p>
    </div>
  );
}

function PerfilPrivado({ username }: { username: string }) {
  return (
    <div className="container">
      <Link
        href="/liga"
        style={{ fontSize: 12, color: "var(--blue-main)", fontWeight: 700, marginBottom: 14, display: "inline-block" }}
      >
        ← Ranking de la Liga
      </Link>
      <div className="perfil-hero">
        <div className="perfil-avatar-big" style={{ background: "linear-gradient(135deg,#94A3B8,#64748B)" }}>🔒</div>
        <div className="perfil-info" style={{ flex: 1 }}>
          <h1>@{username}</h1>
          <div className="perfil-username">Perfil privado</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-body)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Este tipster mantiene su perfil <strong>privado</strong>. No exponemos sus stats ni su historial de predicciones.
      </p>
    </div>
  );
}

function PersonJsonLd({ perfil }: { perfil: PerfilPublicoVista }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const aggregateRating =
    perfil.stats.jugadas > 20
      ? {
          "@type": "AggregateRating",
          ratingValue: (perfil.stats.aciertoPct / 20).toFixed(2),
          ratingCount: perfil.stats.jugadas,
          bestRating: "5",
          worstRating: "0",
        }
      : undefined;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: `@${perfil.username}`,
    alternateName: perfil.nombre || `@${perfil.username}`,
    url: `${baseUrl}/jugador/${perfil.username}`,
    description: `Tipster en La Liga Habla! · ${perfil.stats.jugadas} predicciones realizadas.`,
    memberOf: { "@type": "Organization", name: "Habla!", url: baseUrl },
  };
  if (aggregateRating) data.aggregateRating = aggregateRating;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
