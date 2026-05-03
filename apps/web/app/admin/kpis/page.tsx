// /admin/kpis — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-kpis (líneas 7286-7396).
// HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// El mockup v3.2 reemplaza el drill-down genérico del Lote G por una
// vista enfocada en UN solo KPI: "Free → Premium · Conversión mensual"
// (decisión: el mockup manda — los demás KPIs se monitorean desde el
// dashboard general). Los componentes del Lote G (KPISelectorGrid,
// KPIDetalleHeader, KPIChart, etc.) quedan huérfanos: no se borran
// porque no afectan operación, pero ya no son la vista principal.

import { obtenerKpiFreeAPremium, type RangoKpi } from "@/lib/services/kpis-free-premium.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";
import { KpisRangoSelector } from "@/components/admin/kpis/KpisRangoSelector";

export const dynamic = "force-dynamic";

const RANGOS_VALIDOS: ReadonlyArray<RangoKpi> = ["7d", "30d", "90d", "12m"];

interface PageProps {
  searchParams?: { rango?: string };
}

export default async function AdminKpisPage({ searchParams }: PageProps) {
  const rango: RangoKpi = RANGOS_VALIDOS.includes(searchParams?.rango as RangoKpi)
    ? (searchParams!.rango as RangoKpi)
    : "90d";

  const session = await auth();
  void track({
    evento: "admin_kpis_visto",
    userId: session?.user?.id,
    props: { rango },
  });

  const data = await obtenerKpiFreeAPremium(rango);

  const valorStatus = data.valorActual >= data.targetInicial ? "good" : data.valorActual >= data.targetInicial * 0.7 ? "amber" : "red";
  const dirNuevas = data.nuevasSuscripciones > 0 ? "up" : "flat";

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Análisis</span>
          <span>KPIs</span>
          <span>Free → Premium</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Free → Premium · Conversión mensual</h1>
            <p className="admin-page-subtitle">% de MAU que se convierte en suscriptor Socios cada mes</p>
          </div>
          <KpisRangoSelector rangoActual={rango} />
        </div>
      </div>

      {/* Stats actuales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Valor actual</span>
            <span className={`admin-kpi-card-status admin-kpi-status-${valorStatus}`}></span>
          </div>
          <div className="admin-kpi-card-value">{data.valorActual.toFixed(1)}%</div>
          <div className="admin-kpi-card-trend flat">→ vs período anterior</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Target inicial</span>
          </div>
          <div className="admin-kpi-card-value" style={{ color: "rgba(0,16,80,.42)" }}>
            {data.targetInicial.toFixed(1)}%
          </div>
          <div className="admin-kpi-card-target">Mes 1-3 plan v3.1</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Target maduro</span>
          </div>
          <div className="admin-kpi-card-value" style={{ color: "rgba(0,16,80,.42)" }}>
            {data.targetMaduro.toFixed(1)}%
          </div>
          <div className="admin-kpi-card-target">Mes 4+ plan v3.1</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Suscripciones nuevas</span>
            <span className={`admin-kpi-card-status admin-kpi-status-${data.nuevasSuscripciones > 0 ? "good" : "amber"}`}></span>
          </div>
          <div className="admin-kpi-card-value">{data.nuevasSuscripciones}</div>
          <div className={`admin-kpi-card-trend ${dirNuevas}`}>{dirNuevas === "up" ? "↗" : "→"}</div>
        </div>
      </div>

      {/* Chart placeholder */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <h3
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 16,
              fontWeight: 800,
              color: "#001050",
              textTransform: "uppercase",
            }}
          >
            Evolución últimos {rango === "7d" ? "7 días" : rango === "30d" ? "30 días" : rango === "12m" ? "12 meses" : "90 días"}
          </h3>
          <div style={{ fontSize: 12, color: "rgba(0,16,80,.58)" }}>Línea ámbar = target inicial 1%</div>
        </div>
        <div className="admin-chart-placeholder">
          <div className="admin-chart-target-line" style={{ bottom: "30%" }}></div>
          {data.evolucion.map((b, i) => (
            <div
              key={i}
              className={`admin-chart-bar${b.esTarget ? " target" : ""}`}
              style={{ height: `${Math.max(8, Math.min(95, b.pct * 30))}%` }}
            ></div>
          ))}
        </div>
      </div>

      {/* Acciones sugeridas */}
      <div
        style={{
          background: "#FFFAEB",
          border: "1px solid #FFB800",
          borderRadius: 8,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <h3
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "#7A4A00",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          ⚡ Acciones sugeridas
        </h3>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <li>📌 Aumentar visibilidad del paywall en /las-fijas/[slug] · pick bloqueado debe estar above the fold</li>
          <li>📌 Activar trial gratis 7 días para Top 50 del leaderboard mensual (cron de cierre)</li>
          <li>📌 A/B test del precio anual S/399 vs S/349 — objetivo subir conversión sin reducir LTV</li>
        </ul>
      </div>

      {/* Breakdown por origen */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(0,16,80,.06)",
            borderRadius: 8,
            padding: 18,
          }}
        >
          <h3
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 14,
              fontWeight: 800,
              color: "#001050",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Origen de la conversión
          </h3>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {data.origen.length === 0 ? (
                <tr>
                  <td style={{ padding: "8px 0" }}>Sin datos en el rango</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>—</td>
                </tr>
              ) : (
                data.origen.map((o, i) => (
                  <tr key={o.etiqueta} style={i < data.origen.length - 1 ? { borderBottom: "1px solid rgba(0,16,80,.06)" } : undefined}>
                    <td style={{ padding: "8px 0" }}>{o.etiqueta}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{o.pct}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(0,16,80,.06)",
            borderRadius: 8,
            padding: 18,
          }}
        >
          <h3
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 14,
              fontWeight: 800,
              color: "#001050",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Plan elegido
          </h3>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {data.plan.length === 0 ? (
                <tr>
                  <td style={{ padding: "8px 0" }}>Sin datos en el rango</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>—</td>
                </tr>
              ) : (
                data.plan.map((p, i) => (
                  <tr key={p.etiqueta} style={i < data.plan.length - 1 ? { borderBottom: "1px solid rgba(0,16,80,.06)" } : undefined}>
                    <td style={{ padding: "8px 0" }}>{p.etiqueta}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{p.pct}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
