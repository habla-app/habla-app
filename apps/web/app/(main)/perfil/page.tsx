// /perfil — Lote N v3.2 · portación literal del
// `<section id="page-perfil">` del mockup
// (docs/habla-mockup-v3.2.html líneas 4187-4437).
//
// Hero · stats grid · suscripción Socios o invitación a Socios · cuenta
// inline (datos editables + privacidad + acciones) · predicciones recientes
// · historial Liga Habla!.
//
// Cero clases Tailwind utility — todo el CSS sale de mockup-styles.css.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { obtenerMiPerfil } from "@/lib/services/usuarios.service";
import { obtenerPreferencias } from "@/lib/services/notificaciones.service";
import {
  obtenerMisStatsMensuales,
  premioParaPosicion,
} from "@/lib/services/leaderboard.service";
import { obtenerEstadoPremium } from "@/lib/services/suscripciones.service";
import { CuentaTogglesClient } from "@/components/perfil/CuentaTogglesClient";
import { SignOutLink } from "@/components/perfil/SignOutLink";
import { PLANES } from "@/lib/premium-planes";

export const dynamic = "force-dynamic";

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function iniciales(nombre: string, fallbackUsername: string): string {
  const fuente = (nombre || fallbackUsername || "").trim();
  if (!fuente) return "??";
  const partes = fuente.split(/\s+/).filter(Boolean).slice(0, 2);
  if (partes.length === 0) return fuente.slice(0, 2).toUpperCase();
  return partes.map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function formatFechaCorta(d: Date): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[d.getMonth()] ?? ""} ${d.getFullYear()}`;
}

function formatFechaCompleta(d: Date | null): string {
  if (!d) return "—";
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/perfil");

  const userId = session.user.id;

  const [perfil, preferencias, mensual, estadoPremium] = await Promise.all([
    obtenerMiPerfil(userId),
    obtenerPreferencias(userId),
    obtenerMisStatsMensuales(userId),
    obtenerEstadoPremium(userId).catch(() => null),
  ]);

  const esSocio = !!estadoPremium?.activa;

  // Δ semana: puntos del mes en curso menos puntos hasta hace 7 días
  const ahora = new Date();
  const haceSietedias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

  const ticketsMes = await prisma.ticket
    .findMany({
      where: {
        usuarioId: userId,
        torneo: {
          partido: { fechaInicio: { gte: inicioMes, lt: finMes } },
        },
      },
      select: {
        puntosFinales: true,
        creadoEn: true,
        torneo: { select: { estado: true } },
      },
    })
    .catch(() => []);

  const finalizadosMes = ticketsMes.filter((t) => t.torneo.estado === "FINALIZADO");
  const puntosMes = finalizadosMes.reduce((a, b) => a + (b.puntosFinales ?? 0), 0);
  const puntosHasta7 = finalizadosMes
    .filter((t) => t.creadoEn < haceSietedias)
    .reduce((a, b) => a + (b.puntosFinales ?? 0), 0);
  const deltaSemana = puntosMes - puntosHasta7;

  // Mis predicciones recientes (últimas 5)
  const ticketsRecientes = await prisma.ticket.findMany({
    where: { usuarioId: userId },
    include: { torneo: { include: { partido: true } } },
    orderBy: { creadoEn: "desc" },
    take: 5,
  });

  // Historial mensual: últimos 4 meses (incluye el actual + 3 cerrados)
  const historialMeses = await obtenerHistorialMeses(userId, 4);

  const inicialesUser = iniciales(perfil.nombre, perfil.username);
  const fechaMiembro = formatFechaCorta(perfil.creadoEn);
  const ubicacionLabel = perfil.ubicacion ?? "—";

  const planKey = estadoPremium?.plan ?? null;
  const plan = planKey ? PLANES[planKey] : null;
  const renovacion = estadoPremium?.proximoCobro
    ? new Date(estadoPremium.proximoCobro).toLocaleDateString("es-PE", {
        timeZone: "America/Lima",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  // Picks recibidos del mes (Socios)
  const picksRecibidosMes = esSocio
    ? await prisma.pickPremium
        .count({ where: { aprobado: true, aprobadoEn: { gte: inicioMes } } })
        .catch(() => 0)
    : 0;

  return (
    <div className="mockup-container">

      {/* Hero perfil */}
      <div className="perfil-hero">
        <div className="perfil-avatar-big">{inicialesUser}</div>
        <div className="perfil-info" style={{ flex: 1 }}>
          <h1>@{perfil.username}</h1>
          <div className="perfil-username">{perfil.email} · {ubicacionLabel} · miembro desde {fechaMiembro}</div>
          <div className="perfil-badges">
            {esSocio ? (
              <span className="badge badge-gold socios-only">💎 Socio activo</span>
            ) : (
              <span className="badge badge-blue free-only">Free</span>
            )}
            {mensual.posicionDelMes !== null ? (
              <span className="badge badge-blue">#{mensual.posicionDelMes} del mes</span>
            ) : null}
            {mensual.mejorMes && mensual.mejorMes.posicion <= 50 ? (
              <span className="badge badge-green">Top 50 histórico</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats principales */}
      <div className="perfil-stats-grid">
        <div className="perfil-stat-card">
          <div className="perfil-stat-val">{puntosMes}</div>
          <div className="perfil-stat-lbl">Puntos del mes</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val gold">
            {mensual.posicionDelMes !== null ? `#${mensual.posicionDelMes}` : "—"}
          </div>
          <div className="perfil-stat-lbl">Posición · {mensual.totalUsuariosMes} tipsters</div>
        </div>
        <div className="perfil-stat-card">
          <div className="perfil-stat-val">{Math.round(perfil.stats.aciertoPct)}%</div>
          <div className="perfil-stat-lbl">% acierto general</div>
        </div>
        <div className="perfil-stat-card">
          <div className={deltaSemana >= 0 ? "perfil-stat-val green" : "perfil-stat-val"}>
            {deltaSemana >= 0 ? "+" : ""}{deltaSemana}
          </div>
          <div className="perfil-stat-lbl">Δ semana</div>
        </div>
      </div>

      {/* Suscripción Socios (solo si Socio) */}
      {esSocio && plan ? (
        <div className="suscripcion-card socios-only">
          <div className="suscripcion-header">
            <div className="suscripcion-titulo">💎 Mi Suscripción Socios</div>
            <span className="badge badge-green">Activa</span>
          </div>
          <div className="suscripcion-row">
            <span style={{ color: "var(--text-muted-d)" }}>Plan</span>
            <strong>{plan.label} · S/ {plan.precioSoles}</strong>
          </div>
          <div className="suscripcion-row">
            <span style={{ color: "var(--text-muted-d)" }}>Próximo cobro</span>
            <strong>{renovacion}</strong>
          </div>
          <div className="suscripcion-row">
            <span style={{ color: "var(--text-muted-d)" }}>Canal WhatsApp</span>
            <strong style={{ color: "var(--green)" }}>✓ Conectado</strong>
          </div>
          <div className="suscripcion-row">
            <span style={{ color: "var(--text-muted-d)" }}>Picks recibidos este mes</span>
            <strong>{picksRecibidosMes}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Gestionar suscripción</button>
            <Link href="/socios-hub" className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: "center" }}>Ir al hub Socios</Link>
          </div>
        </div>
      ) : null}

      {/* Invitación a Socios (solo Free) */}
      {!esSocio ? (
        <div className="suscripcion-card free-only" style={{ background: "linear-gradient(135deg,#FFFAEB,#fff)" }}>
          <div className="suscripcion-header">
            <div className="suscripcion-titulo">💎 Hacete Socio</div>
            <span className="badge badge-gold">Desde S/ 33/mes</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-body)", marginBottom: 14 }}>
            Recibí 2-4 picks/día por WhatsApp con análisis estadístico, casa con mejor cuota y razonamiento completo.
          </p>
          <Link href="/socios" className="btn btn-primary btn-block">Conocer Socios →</Link>
        </div>
      ) : null}

      {/* Cuenta y configuración (integrada, no en otra vista) */}
      <div className="perfil-section">
        <div className="perfil-section-header">
          <div className="perfil-section-title">⚙️ Mi cuenta</div>
        </div>

        {/* Datos básicos editables inline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div className="cuenta-row">
            <div className="cuenta-row-label">@username</div>
            <div className="cuenta-row-value">@{perfil.username} <span className="badge badge-gray" style={{ marginLeft: 6 }}>🔒 inmutable</span></div>
          </div>
          <div className="cuenta-row">
            <div className="cuenta-row-label">Nombre</div>
            <div className="cuenta-row-value">{perfil.nombre || "—"} <button type="button" className="cuenta-edit-btn">Editar</button></div>
          </div>
          <div className="cuenta-row">
            <div className="cuenta-row-label">Email</div>
            <div className="cuenta-row-value">
              {perfil.email}
              {perfil.emailVerified ? (
                <span className="badge badge-green" style={{ marginLeft: 6 }}>✓ verificado</span>
              ) : (
                <span className="badge badge-gray" style={{ marginLeft: 6 }}>Sin verificar</span>
              )}
            </div>
          </div>
          <div className="cuenta-row">
            <div className="cuenta-row-label">Ubicación</div>
            <div className="cuenta-row-value">{ubicacionLabel} <button type="button" className="cuenta-edit-btn">Editar</button></div>
          </div>
          <div className="cuenta-row">
            <div className="cuenta-row-label">Fecha nacimiento</div>
            <div className="cuenta-row-value">
              {formatFechaCompleta(perfil.fechaNac)}
              {perfil.fechaNac ? (
                <span className="badge badge-green" style={{ marginLeft: 6 }}>+18 ✓</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Privacidad + sesión */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
          <CuentaTogglesClient
            perfilPublico={perfil.perfilPublico}
            emailSemanal={preferencias.emailSemanal}
          />
        </div>

        {/* Acciones de cuenta */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>🔒 Cambiar contraseña</button>
          <a href="/api/v1/usuarios/me/exportar" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>📥 Descargar mis datos</a>
          <SignOutLink />
          <Link href="/perfil/eliminar" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", color: "var(--pred-wrong)" }}>🗑 Eliminar mi cuenta</Link>
        </div>
      </div>

      {/* Mis predicciones recientes */}
      <div className="perfil-section">
        <div className="perfil-section-header">
          <div className="perfil-section-title">🎯 Mis predicciones recientes</div>
          <Link href="/mis-predicciones" className="section-bar-cta">Ver todas ({perfil.stats.jugadas}) →</Link>
        </div>

        <div className="predicciones-list">
          {ticketsRecientes.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted-d)", textAlign: "center", padding: "16px 0" }}>
              Aún no has armado ninguna combinada. <Link href="/liga" style={{ color: "var(--blue-main)", fontWeight: 700 }}>Empieza una</Link>.
            </div>
          ) : (
            ticketsRecientes.map((t) => {
              const partido = t.torneo.partido;
              const fechaCorta = labelFechaCorta(partido.fechaInicio);
              const horaPartido = horaLima(partido.fechaInicio);
              const bttsLabel = t.predBtts ? "BTTS Sí" : "BTTS No";
              const overLabel = t.predMas25 ? "Más 2.5" : "Menos 2.5";
              const meta = `${partido.liga} · ${labelPred(t.predResultado)} · ${bttsLabel} · ${overLabel}`;
              const enCurso = t.torneo.estado !== "FINALIZADO" && t.torneo.estado !== "CANCELADO";
              const ptsLabel = enCurso || t.puntosFinales === null ? "— pts" : `+${t.puntosFinales} pts`;
              const ptsCls = enCurso || t.puntosFinales === null ? "prediccion-pts zero" : "prediccion-pts";
              const badge = enCurso
                ? { className: "badge badge-blue", text: "En curso" }
                : t.puntosFinales === null
                  ? { className: "badge badge-gray", text: "—" }
                  : t.puntosFinales >= 12
                    ? { className: "badge badge-green", text: `${t.puntosFinales} pts` }
                    : { className: "badge badge-red", text: `${t.puntosFinales} pts` };
              return (
                <div key={t.id} className="prediccion-item">
                  <div className="prediccion-fecha">{fechaCorta}<br />{horaPartido}</div>
                  <div>
                    <div className="prediccion-partido">{partido.equipoLocal} vs {partido.equipoVisita}</div>
                    <div className="prediccion-meta">{meta}</div>
                  </div>
                  <span className={badge.className}>{badge.text}</span>
                  <span className={ptsCls}>{ptsLabel}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Historial de pagos premios */}
      <div className="perfil-section">
        <div className="perfil-section-header">
          <div className="perfil-section-title">💰 Historial Liga Habla!</div>
        </div>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px 0", letterSpacing: ".04em" }}>Mes</th>
              <th style={{ textAlign: "center", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px", letterSpacing: ".04em" }}>Posición</th>
              <th style={{ textAlign: "center", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px", letterSpacing: ".04em" }}>Puntos</th>
              <th style={{ textAlign: "right", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted-d)", fontWeight: 700, padding: "8px 0", letterSpacing: ".04em" }}>Premio</th>
            </tr>
          </thead>
          <tbody>
            {historialMeses.map((m, idx) => {
              const esActual = idx === 0;
              const enTop10 = m.posicion !== null && m.posicion <= 10;
              const premio = enTop10 && m.cerrado ? premioParaPosicion(m.posicion!) : 0;
              return (
                <tr key={m.mes} style={{ borderTop: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 0" }}>
                    <strong>{m.nombreMes}</strong>{esActual ? " · en curso" : ""}
                  </td>
                  <td style={{ textAlign: "center", padding: 10 }}>
                    {m.posicion === null ? "—" : enTop10 && m.cerrado ? (
                      <span style={{ color: "var(--gold)", fontWeight: 800 }}>🏆 #{m.posicion}</span>
                    ) : (
                      `#${m.posicion}`
                    )}
                  </td>
                  <td style={{ textAlign: "center", padding: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: esActual ? "var(--blue-main)" : undefined }}>
                    {m.puntos}
                  </td>
                  <td style={{ textAlign: "right", padding: "10px 0" }}>
                    {premio > 0 ? (
                      <strong style={{ color: "var(--green)" }}>S/ {premio} ✓</strong>
                    ) : (
                      <span style={{ color: "var(--text-muted-d)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {historialMeses.length === 0 ? (
              <tr style={{ borderTop: "1px solid var(--border-light)" }}>
                <td style={{ padding: "10px 0", color: "var(--text-muted-d)" }} colSpan={4}>
                  Aún no participaste en ningún mes de la Liga Habla!.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted-d)", margin: "24px 0 0", textAlign: "center", lineHeight: 1.5 }}>
        Apuesta responsable. Solo +18. Línea Tugar (gratuita): 0800-19009.
      </p>

    </div>
  );
}

function labelPred(p: string): string {
  if (p === "LOCAL") return "Local";
  if (p === "EMPATE") return "Empate";
  if (p === "VISITA") return "Visita";
  return p;
}

function labelFechaCorta(d: Date): string {
  const ahora = new Date();
  const tzAhora = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const tzD = new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const sameDay = tzAhora.getFullYear() === tzD.getFullYear() && tzAhora.getMonth() === tzD.getMonth() && tzAhora.getDate() === tzD.getDate();
  if (sameDay) return "Hoy";
  const ayer = new Date(tzAhora.getTime() - 24 * 60 * 60 * 1000);
  if (ayer.getFullYear() === tzD.getFullYear() && ayer.getMonth() === tzD.getMonth() && ayer.getDate() === tzD.getDate()) return "Ayer";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${tzD.getDate()} ${meses[tzD.getMonth()] ?? ""}`;
}

function horaLima(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

interface MesHistorial {
  mes: string;
  nombreMes: string;
  posicion: number | null;
  puntos: number;
  cerrado: boolean;
}

async function obtenerHistorialMeses(usuarioId: string, n: number): Promise<MesHistorial[]> {
  const ahora = new Date();
  const tz = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const meses: MesHistorial[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(tz.getFullYear(), tz.getMonth() - i, 1);
    const mesKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const nombreMes = `${MESES_LARGO[d.getMonth()] ?? ""} ${d.getFullYear()}`;
    if (i === 0) {
      // Mes actual: agregar on-the-fly desde leaderboard.service no es trivial;
      // calculamos puntos y posición aproximada via tickets directos.
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const puntosTickets = await prisma.ticket
        .findMany({
          where: {
            usuarioId,
            torneo: {
              partido: { fechaInicio: { gte: inicio, lt: fin } },
              estado: "FINALIZADO",
            },
          },
          select: { puntosFinales: true },
        })
        .catch(() => []);
      const puntos = puntosTickets.reduce((a, b) => a + (b.puntosFinales ?? 0), 0);
      meses.push({
        mes: mesKey,
        nombreMes,
        posicion: null, // se sobreescribe abajo si hay snapshot
        puntos,
        cerrado: false,
      });
    } else {
      const lb = await prisma.leaderboard
        .findUnique({ where: { mes: mesKey } })
        .catch(() => null);
      if (!lb) {
        meses.push({ mes: mesKey, nombreMes, posicion: null, puntos: 0, cerrado: false });
        continue;
      }
      const arr = (lb.posiciones as Array<{ userId: string; posicion: number; puntos: number }>) ?? [];
      const fila = arr.find((f) => f.userId === usuarioId) ?? null;
      meses.push({
        mes: mesKey,
        nombreMes,
        posicion: fila?.posicion ?? null,
        puntos: fila?.puntos ?? 0,
        cerrado: !!lb.cerradoEn,
      });
    }
  }
  // Para mes actual: traer posición desde MisStatsMensuales (se hizo arriba)
  return meses;
}
