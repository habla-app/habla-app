// /admin/motor-cuotas — Lote V fase V.5 (May 2026): dashboard del motor.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.4.
//
// Server component con 4 cuadrantes:
//   1. Salud de scrapers (tabla 7 filas)
//   2. Métricas globales (4 admin-kpi-card)
//   3. Cola BullMQ (card con counts)
//   4. Acciones globales (refresh global + reactivar bloqueado)
//
// Cero clases Tailwind utility — usa clases admin del mockup-styles.css.

import { obtenerSaludMotor } from "@/lib/services/motor-cuotas-dashboard.service";
import { ETIQUETAS_CASA } from "@/lib/services/admin-cuotas.service";
import { AccionesGlobalesPanel } from "@/components/admin/cuotas/AccionesGlobalesPanel";
import type { CasaCuotas } from "@/lib/services/scrapers/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Motor de cuotas · Admin Habla!" };

const LIMA_TZ = "America/Lima";

function tiempoRelativo(d: Date | null): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "hace <1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

function _fechaCorta(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function MotorCuotasDashboard() {
  const data = await obtenerSaludMotor();

  const cobertura =
    data.metricas.cuotasEsperadas > 0
      ? (
          (data.metricas.cuotasVivas / data.metricas.cuotasEsperadas) *
          100
        ).toFixed(0)
      : "—";

  const casasBloqueadas = data.scrapers
    .filter((s) => s.estado === "BLOQUEADO")
    .map((s) => ({ casa: s.casa as string, label: ETIQUETAS_CASA[s.casa as CasaCuotas] }));

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Motor de Fijas</span>
          <span>Cuotas</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Motor de cuotas</h1>
            <p className="admin-page-subtitle">
              Captura diaria de las 7 casas peruanas autorizadas · Refresh
              5:00 AM Lima · {data.metricas.partidosFiltro1Activo} partidos
              activos
            </p>
          </div>
        </div>
      </div>

      {/* === Métricas globales === */}
      <div
        className="admin-kpi-section"
        style={{ marginBottom: 18 }}
      >
        <div className="admin-kpi-section-header">
          <h2 className="admin-kpi-section-title">📊 Estado global</h2>
        </div>
        <div className="admin-kpi-grid">
          <KpiCard
            label="Partidos con Filtro 1"
            valor={data.metricas.partidosFiltro1Activo.toString()}
            target="con captura activa"
          />
          <KpiCard
            label="Cobertura captura"
            valor={`${cobertura}%`}
            target={`${data.metricas.cuotasVivas}/${data.metricas.cuotasEsperadas} cuotas vivas`}
            status={
              cobertura !== "—" && Number(cobertura) >= 70
                ? "good"
                : cobertura !== "—" && Number(cobertura) >= 40
                  ? "amber"
                  : "red"
            }
          />
          <KpiCard
            label="Estado partidos"
            valor={`${data.metricas.partidosCompleta} / ${data.metricas.partidosParcial} / ${data.metricas.partidosFallida}`}
            target="completas / parciales / fallidas"
          />
          <KpiCard
            label="Alertas no vistas"
            valor={data.metricas.alertasNoVistas.toString()}
            target="cambios ≥5%"
            status={data.metricas.alertasNoVistas > 0 ? "amber" : "good"}
          />
        </div>
      </div>

      {/* === Salud de scrapers === */}
      <section className="card" style={{ padding: 16, marginBottom: 18 }}>
        <h3
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text-dark)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Salud de scrapers
        </h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Casa</th>
              <th>Estado</th>
              <th>Última ejecución</th>
              <th>Último éxito</th>
              <th>Días con error consec.</th>
              <th>Detalle error</th>
            </tr>
          </thead>
          <tbody>
            {data.scrapers.map((s) => {
              const pill =
                s.estado === "SANO"
                  ? { cls: "adm-pill adm-pill-green", label: "🟢 SANO" }
                  : s.estado === "DEGRADADO"
                    ? { cls: "adm-pill adm-pill-amber", label: "🟡 DEGRADADO" }
                    : { cls: "adm-pill adm-pill-red", label: "🔴 BLOQUEADO" };
              return (
                <tr key={s.casa}>
                  <td>
                    <strong>{ETIQUETAS_CASA[s.casa as CasaCuotas]}</strong>
                  </td>
                  <td>
                    <span className={pill.cls}>{pill.label}</span>
                  </td>
                  <td>{tiempoRelativo(s.ultimaEjecucion)}</td>
                  <td>{tiempoRelativo(s.ultimoExito)}</td>
                  <td
                    style={{
                      fontWeight: s.diasConsecutivosError > 0 ? 700 : 400,
                      color:
                        s.diasConsecutivosError >= 3
                          ? "var(--pred-wrong)"
                          : s.diasConsecutivosError > 0
                            ? "var(--gold)"
                            : "var(--text-muted-d)",
                    }}
                  >
                    {s.diasConsecutivosError}
                  </td>
                  <td
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted-d)",
                      maxWidth: 360,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={s.detalleError ?? undefined}
                  >
                    {s.detalleError ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* === Cola BullMQ === */}
      <section
        className="card"
        style={{ padding: 16, marginBottom: 18 }}
      >
        <h3
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text-dark)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Cola BullMQ
        </h3>
        {data.cola.disponible ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            <ColaStat label="En cola" valor={data.cola.enCola} />
            <ColaStat label="En proceso" valor={data.cola.enProceso} />
            <ColaStat
              label="Fallidos retenidos"
              valor={data.cola.fallidos}
              alerta={data.cola.fallidos > 50}
            />
            <ColaStat label="Completados" valor={data.cola.completados} />
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted-d)",
              padding: 12,
              background: "var(--bg-page)",
              borderRadius: 6,
            }}
          >
            ⚠️ Cola no disponible (verificar REDIS_URL en Railway).
          </div>
        )}
      </section>

      {/* === Acciones globales === */}
      <section style={{ marginBottom: 18 }}>
        <h3
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text-dark)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Acciones globales
        </h3>
        <AccionesGlobalesPanel casasBloqueadas={casasBloqueadas} />
      </section>

      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 12,
          fontSize: 11,
          color: "var(--text-muted-d)",
          textAlign: "right",
        }}
      >
        Generado: {data.generadoEn.toLocaleString("es-PE")}
      </div>
    </>
  );
}

function KpiCard({
  label,
  valor,
  target,
  status = "good",
}: {
  label: string;
  valor: string;
  target?: string;
  status?: "good" | "amber" | "red";
}) {
  return (
    <div className="admin-kpi-card">
      <div className="admin-kpi-card-head">
        <div className="admin-kpi-card-label">{label}</div>
        <div
          className={`admin-kpi-card-status admin-kpi-status-${status}`}
        >
          {status === "good" ? "●" : status === "amber" ? "▲" : "●"}
        </div>
      </div>
      <div className="admin-kpi-card-value">{valor}</div>
      {target ? <div className="admin-kpi-card-target">{target}</div> : null}
    </div>
  );
}

function ColaStat({
  label,
  valor,
  alerta = false,
}: {
  label: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-page)",
        border: "1px solid var(--border-light)",
        borderRadius: 6,
        padding: 12,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted-d)",
          textTransform: "uppercase",
          letterSpacing: ".04em",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 28,
          fontWeight: 900,
          color: alerta ? "var(--pred-wrong)" : "var(--text-dark)",
          lineHeight: 1,
        }}
      >
        {valor}
      </div>
    </div>
  );
}
