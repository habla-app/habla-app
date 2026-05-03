// /admin/cohortes — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-cohortes (líneas 7401-7577).
// HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// El mockup v3.2 reemplaza el heatmap mensual del Lote G (con buckets day
// 0/1/7/14/30/60/90) por un heatmap SEMANAL (sem 0..sem 7) más enfocado
// en retention 30d. Los componentes del Lote G (CohorteHeatmap,
// MetricSelector, etc.) quedan huérfanos: no se borran porque no afectan
// operación, pero ya no son la vista principal.

import {
  obtenerCohortesSemanal,
  categoriaCohorteCell,
  type MetricaCohorteSemanal,
  type GranularidadCohorte,
} from "@/lib/services/cohortes-semanal.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";
import { CohortesFiltros } from "@/components/admin/cohortes/CohortesFiltros";

export const dynamic = "force-dynamic";

const METRICAS_VALIDAS: ReadonlyArray<MetricaCohorteSemanal> = ["retention", "ftd", "socios"];
const GRANULARIDAD_VALIDA: ReadonlyArray<GranularidadCohorte> = ["semanal", "diaria", "mensual"];

interface PageProps {
  searchParams?: { metrica?: string; granularidad?: string };
}

export default async function AdminCohortesPage({ searchParams }: PageProps) {
  const metrica: MetricaCohorteSemanal = METRICAS_VALIDAS.includes(searchParams?.metrica as MetricaCohorteSemanal)
    ? (searchParams!.metrica as MetricaCohorteSemanal)
    : "retention";
  const granularidad: GranularidadCohorte = GRANULARIDAD_VALIDA.includes(searchParams?.granularidad as GranularidadCohorte)
    ? (searchParams!.granularidad as GranularidadCohorte)
    : "semanal";

  const session = await auth();
  void track({
    evento: "admin_cohortes_visto",
    userId: session?.user?.id,
    props: { metrica, granularidad },
  });

  const data = await obtenerCohortesSemanal(metrica, granularidad);

  // Marcar cohorte mejor con ⭐
  const mejorLabel = data.resumen.mejorCohorte?.label;

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Análisis</span>
          <span>Cohortes</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Cohortes · Retention 30d</h1>
            <p className="admin-page-subtitle">% usuarios que vuelven cada semana después del registro</p>
          </div>
          <CohortesFiltros metricaActual={metrica} granularidadActual={granularidad} />
        </div>
      </div>

      {/* Cards resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Mejor cohorte</span>
          </div>
          <div className="admin-kpi-card-value">{data.resumen.mejorCohorte?.label.split(" ").slice(0, 2).join(" ") ?? "—"}</div>
          <div className="admin-kpi-card-target">
            {data.resumen.mejorCohorte ? `${data.resumen.mejorCohorte.pct30d}% retention 30d` : "Sin datos"}
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Peor cohorte</span>
          </div>
          <div className="admin-kpi-card-value">{data.resumen.peorCohorte?.label.split(" ").slice(0, 2).join(" ") ?? "—"}</div>
          <div className="admin-kpi-card-target">
            {data.resumen.peorCohorte ? `${data.resumen.peorCohorte.pct30d}% retention 30d` : "Sin datos"}
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Promedio últimas 8</span>
          </div>
          <div className="admin-kpi-card-value">{data.resumen.promedioUltimas8 !== null ? `${data.resumen.promedioUltimas8}%` : "—"}</div>
          <div className="admin-kpi-card-trend flat">→</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Target plan v3.1</span>
          </div>
          <div className="admin-kpi-card-value">{data.resumen.targetPct}%</div>
          <div className="admin-kpi-card-target">Retention 30d</div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="cohort-heatmap">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Cohorte (semana de registro)</th>
              <th>Tamaño</th>
              <th>Sem 0</th>
              <th>Sem 1</th>
              <th>Sem 2</th>
              <th>Sem 3</th>
              <th>Sem 4</th>
              <th>Sem 5</th>
              <th>Sem 6</th>
              <th>Sem 7</th>
            </tr>
          </thead>
          <tbody>
            {data.cohortes.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 32, color: "rgba(0,16,80,.42)" }}>
                  Sin cohortes disponibles aún.
                </td>
              </tr>
            ) : (
              data.cohortes.map((c) => (
                <tr key={c.inicioSemanaISO}>
                  <td className="cohort-label">
                    {c.label}
                    {c.label === mejorLabel ? " ⭐" : ""}
                  </td>
                  <td style={{ fontWeight: 700 }}>{c.tamano}</td>
                  {c.semanas.map((pct, i) => (
                    <td key={i}>
                      {pct !== null ? <div className={`cohort-cell ${categoriaCohorteCell(pct)}`}>{pct}%</div> : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 18,
          marginTop: 18,
        }}
      >
        <h3
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "#001050",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          📊 Observaciones
        </h3>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 13, lineHeight: 1.5 }}>
          {data.resumen.mejorCohorte && (
            <li>
              ✅ <strong>Cohorte {data.resumen.mejorCohorte.label.split(" ").slice(0, 2).join(" ")}</strong> superó por mucho el promedio. Hipótesis: coincide con lanzamiento de premios reales en la Liga.
            </li>
          )}
          {data.resumen.peorCohorte && (
            <li>
              ⚠️ <strong>Cohorte {data.resumen.peorCohorte.label.split(" ").slice(0, 2).join(" ")}</strong> retention bajo ({data.resumen.peorCohorte.pct30d}% sem 4). Hipótesis: los partidos top de esa semana fueron pocos (parón internacional).
            </li>
          )}
          <li>
            📌 <strong>Sem 1 → Sem 2</strong> es el drop más grande consistente (~10pp). Acción: focalizar push notifications a usuarios de 7-14 días.
          </li>
        </ul>
      </div>
    </>
  );
}
