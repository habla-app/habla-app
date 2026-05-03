// /admin/liga-verificacion — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-liga-verificacion (líneas
// 6008-6222). Vista NUEVA del Lote O.
//
// Nota sobre la columna DNI: el mockup la incluye como parte del flujo
// estándar de pago de premios. La regla 28 del CLAUDE.md (decisión §1.3
// del análisis-repo-vs-mockup-v3.2) prohíbe capturar DNI: el premio Liga
// se paga por Yape como premio publicitario, datos mínimos. Por eso la
// columna queda renderizada en HTML idéntico al mockup pero los datos
// siempre son "No verificado" (divergencia 4 — lógica de negocio).

import { obtenerVistaVerificacionTop10 } from "@/lib/services/admin-liga-verificacion.service";
import { TopFlagPill, EstadoFinalPill } from "@/components/admin/liga/VerificacionPills";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verificación Top 10 · Admin Habla!" };

export default async function AdminLigaVerificacionPage() {
  const vista = await obtenerVistaVerificacionTop10();

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Liga</span>
          <span>Verificación Top 10</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Verificación Top 10 · {vista.mesEtiqueta}</h1>
            <p className="admin-page-subtitle">
              Estado de identidad, contacto y datos bancarios para procesar premios al cierre
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled>
              📨 Recordar a pendientes
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled>
              📥 Exportar planilla
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Top 10 verificados</span>
            <span className={`admin-kpi-card-status admin-kpi-status-${vista.resumen.verificados === vista.filas.length ? "good" : "amber"}`} />
          </div>
          <div className="admin-kpi-card-value">{vista.resumen.verificados} / {vista.filas.length}</div>
          <div className="admin-kpi-card-target">
            {vista.resumen.verificados < vista.filas.length ? "Falta yape/datos" : "Listos para cobrar"}
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Bloqueantes para pago</span>
            <span className={`admin-kpi-card-status admin-kpi-status-${vista.resumen.bloqueantes === 0 ? "good" : "red"}`} />
          </div>
          <div className="admin-kpi-card-value">{vista.resumen.bloqueantes}</div>
          <div className="admin-kpi-card-target">No podrán cobrar al cierre</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Días hasta cierre</span>
          </div>
          <div className="admin-kpi-card-value">{vista.resumen.diasAlCierre}</div>
          <div className="admin-kpi-card-target">Tiempo para regularizar</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Total a pagar</span>
          </div>
          <div className="admin-kpi-card-value">S/ {vista.resumen.totalPremios.toLocaleString("es-PE")}</div>
          <div className="admin-kpi-card-target">Premios mensuales</div>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Tipster</th>
            <th className="center" style={{ textAlign: "center" }}>+18</th>
            <th className="center" style={{ textAlign: "center" }}>DNI</th>
            <th className="center" style={{ textAlign: "center" }}>Email</th>
            <th className="center" style={{ textAlign: "center" }}>Teléfono</th>
            <th className="center" style={{ textAlign: "center" }}>Yape / cuenta</th>
            <th className="center" style={{ textAlign: "center" }}>T&amp;C aceptados</th>
            <th className="center" style={{ textAlign: "center" }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vista.filas.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "rgba(0,16,80,.42)" }}>
                Sin Top 10 todavía. Aparecerá cuando haya tickets finalizados del mes en partidos elegibles.
              </td>
            </tr>
          )}
          {vista.filas.map((f) => {
            const filaBg = f.estadoFinal === "Bloqueante" ? "rgba(255,61,61,.04)" : undefined;
            const colorPos = f.posicion === 1 ? "#FFB800" : "rgba(0,16,80,.85)";
            return (
              <tr key={f.usuarioId} style={{ background: filaBg }}>
                <td>
                  <strong style={{ color: colorPos, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16 }}>
                    {f.posicion}°
                  </strong>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#001050" }}>{f.nombre}</div>
                  <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)" }}>@{f.username}</div>
                </td>
                <td style={{ textAlign: "center" }}>
                  <TopFlagPill flag={f.flags.mayorEdad} labelOk="✓" labelAmber="No verificado" labelRed="✗ Falta" />
                </td>
                <td style={{ textAlign: "center" }}>
                  <TopFlagPill flag={f.flags.dni} labelOk="✓" labelAmber="No verificado" labelRed="✗ Falta" />
                </td>
                <td style={{ textAlign: "center" }}>
                  <TopFlagPill flag={f.flags.email} labelOk="✓" labelAmber="Pendiente" labelRed="✗ Falta" />
                </td>
                <td style={{ textAlign: "center" }}>
                  <TopFlagPill flag={f.flags.telefono} labelOk="✓" labelAmber="Pendiente" labelRed="✗ Falta" />
                </td>
                <td style={{ textAlign: "center" }}>
                  <TopFlagPill
                    flag={f.flags.yape}
                    labelOk={`✓ ${f.yapeMetodo ?? "Yape"}`}
                    labelAmber="Pendiente"
                    labelRed="✗ Falta"
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <TopFlagPill flag={f.flags.tyc} labelOk="✓" labelAmber="Pendiente" labelRed="✗ Falta" />
                </td>
                <td style={{ textAlign: "center" }}>
                  <EstadoFinalPill estado={f.estadoFinal} />
                </td>
                <td>
                  {f.estadoFinal === "Listo" ? (
                    <a href={`/admin/usuarios/${f.usuarioId}`} className="btn btn-ghost btn-xs">
                      Ver perfil
                    </a>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-xs" disabled>
                      📨 Recordar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 14, marginTop: 14, fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.6 }}>
        <strong style={{ color: "#001050" }}>Política de pagos:</strong> al cerrar el torneo el día 1 a las 00:01 PET, el cron asigna premios automáticamente solo al Top 10 con yape verificado. Si un Top 10 no completó la verificación, el premio queda en cola hasta 30 días después; si no se regulariza, se reasigna al puesto 11. La columna DNI es informativa: el premio Liga Habla! se paga por Yape como premio publicitario y no requiere captura de DNI.
      </div>
    </>
  );
}
