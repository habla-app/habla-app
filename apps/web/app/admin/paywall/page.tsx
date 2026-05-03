// /admin/paywall — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-paywall (líneas 5656-5791).
// HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Vista de monitoreo y preview — la política Free vs Socios está
// hardcodeada en `lib/config/paywall.ts` (decisión §1.5 + §1.1). Los
// toggles del mockup son placeholder (no persisten — son visuales).
// Cuando un cambio real haga falta, se edita `paywall.ts` y se commitea.

import { auth } from "@/lib/auth";
import { track } from "@/lib/services/analytics.service";
import { obtenerKPIsConversionPaywall } from "@/lib/services/paywall-monitoreo.service";

export const dynamic = "force-dynamic";

export default async function AdminPaywallPage() {
  const session = await auth();
  void track({
    evento: "admin_paywall_visto",
    userId: session?.user?.id,
  });

  const conv = await obtenerKPIsConversionPaywall();

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Motor de Fijas</span>
          <span>Free vs Socios</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Política Free vs Socios</h1>
            <p className="admin-page-subtitle">
              Estructura fija: Free = 1X2, Socios = combinada. Acá ajustás detalles del paywall y monitoreás conversión.
            </p>
          </div>
        </div>
      </div>

      {/* Banner explicativo */}
      <div
        style={{
          background: "linear-gradient(90deg,#EEF2FF,#fff)",
          border: "1px solid #0052CC",
          borderRadius: 8,
          padding: 18,
          marginBottom: 18,
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div style={{ fontSize: 24 }}>📋</div>
        <div style={{ flex: 1, fontSize: 13, color: "rgba(0,16,80,.85)", lineHeight: 1.6 }}>
          <strong style={{ color: "#001050", fontSize: 14, display: "block", marginBottom: 4 }}>
            Política base (no editable)
          </strong>
          Cada partido del Filtro 1 tiene <strong>siempre 2 niveles de análisis</strong>:{" "}
          <strong style={{ color: "#0052CC" }}>Free</strong> con 1X2 + probabilidades + mejor cuota + redacción corta ·{" "}
          <strong style={{ color: "#7A4A00" }}>Socios</strong> con combinada óptima + stake + EV+ + razonamiento. Esta
          estructura es fija. Acá podés ajustar elementos secundarios y el copy del paywall.
        </div>
      </div>

      {/* Comparación visual */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div
          style={{
            background: "#fff",
            border: "1.5px solid #0052CC",
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: "#0052CC",
                textTransform: "uppercase",
              }}
            >
              📊 Análisis Free
            </div>
            <span className="adm-pill adm-pill-blue">Estructura fija</span>
          </div>
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <li>✅ Pronóstico Habla! (Local / Empate / Visita)</li>
            <li>✅ Probabilidad de cada outcome</li>
            <li>✅ Mejor cuota disponible (con casa)</li>
            <li>✅ Comparador con todas las casas afiliadas</li>
            <li>✅ Forma reciente · H2H · lesiones (datos)</li>
            <li>✅ Redacción corta (~40 palabras)</li>
            <li>✅ Banner Liga &ldquo;armá tu combinada gratis&rdquo;</li>
          </ul>
        </div>

        <div
          style={{
            background: "linear-gradient(180deg,#FFFAEB,#fff)",
            border: "1.5px solid #FFB800",
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: "#7A4A00",
                textTransform: "uppercase",
              }}
            >
              💎 Análisis Socios
            </div>
            <span className="adm-pill adm-pill-amber">Estructura fija</span>
          </div>
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <li>✅ Todo lo de Free</li>
            <li>✅ Combinada óptima del partido</li>
            <li>✅ Stake sugerido en % del bankroll</li>
            <li>✅ EV+ calculado</li>
            <li>✅ Confianza del modelo</li>
            <li>✅ Mercados secundarios con value (BTTS, ±2.5)</li>
            <li>✅ Razonamiento detallado (~150 palabras)</li>
            <li>✅ Distribución por canal WhatsApp en vivo</li>
          </ul>
        </div>
      </div>

      {/* Ajustes editables */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 18,
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
          ⚙️ Ajustes del paywall (editable)
        </h3>

        <ToggleRow
          titulo="Mostrar análisis Socios con blur a Free"
          desc="Mostrar el contenido borroso para crear FOMO"
          on
        />
        <ToggleRow
          titulo="Trial gratis 7 días al ganador del Top 10"
          desc="Premio mensual de la Liga incluye Socios temporal"
          on
        />
        <ToggleRow
          titulo="Mostrar % acierto histórico del motor a Free"
          desc='Prueba social: "61% de acierto últimos 90 días"'
          on
        />
        <ToggleRow
          titulo="Mostrar EV+ del último mes a Free (transparencia)"
          desc='Ej: "+12.4% EV+ realizado en abril 2026"'
          on={false}
          ultimo
        />
      </div>

      {/* Copy del paywall */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 18,
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
          ✏️ Copy del paywall (editable)
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#001050",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              display: "block",
              marginBottom: 6,
            }}
          >
            Título del bloqueo
          </label>
          <input className="admin-filter-input" style={{ width: "100%" }} defaultValue="💎 Análisis Socios bloqueado" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#001050",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              display: "block",
              marginBottom: 6,
            }}
          >
            Subtítulo
          </label>
          <input
            className="admin-filter-input"
            style={{ width: "100%" }}
            defaultValue="Mercados con value · combinadas óptimas · stake sugerido · razonamiento estadístico completo"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#001050",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              display: "block",
              marginBottom: 6,
            }}
          >
            CTA
          </label>
          <input className="admin-filter-input" style={{ width: "100%" }} defaultValue="Hacete Socio para desbloquear →" />
        </div>
      </div>

      {/* Conversión actual */}
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
          📊 Conversión del paywall · últimos 30 días
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
          <div className="admin-kpi-card">
            <div className="admin-kpi-card-head">
              <span className="admin-kpi-card-label">Vistas paywall</span>
            </div>
            <div className="admin-kpi-card-value">{conv.vistasPaywall.toLocaleString("es-PE")}</div>
            <div className="admin-kpi-card-trend flat">→</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-card-head">
              <span className="admin-kpi-card-label">Clicks &ldquo;Hacete Socio&rdquo;</span>
              <span
                className={`admin-kpi-card-status admin-kpi-status-${
                  conv.clicksHaceteSocio > 0 ? "good" : "amber"
                }`}
              ></span>
            </div>
            <div className="admin-kpi-card-value">{conv.clicksHaceteSocio.toLocaleString("es-PE")}</div>
            <div className="admin-kpi-card-trend flat">→</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-card-head">
              <span className="admin-kpi-card-label">% conversión a Socio</span>
              <span
                className={`admin-kpi-card-status admin-kpi-status-${
                  conv.pctConversionSocio >= 0.04 ? "good" : conv.pctConversionSocio >= 0.02 ? "amber" : "red"
                }`}
              ></span>
            </div>
            <div className="admin-kpi-card-value">{(conv.pctConversionSocio * 100).toFixed(1)}%</div>
            <div className="admin-kpi-card-trend flat">→</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.5 }}>
          📌 <strong>Insight:</strong> El target inicial de conversión paywall → Socio es 4%. La estrategia 1X2 free +
          combinada Socios busca mantenerse por encima.
        </p>
      </div>
    </>
  );
}

interface ToggleRowProps {
  titulo: string;
  desc: string;
  on: boolean;
  ultimo?: boolean;
}

function ToggleRow({ titulo, desc, on, ultimo }: ToggleRowProps) {
  return (
    <div
      className="cuenta-toggle-row"
      style={{
        padding: "14px 0",
        borderBottom: ultimo ? undefined : "1px solid rgba(0,16,80,.06)",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: "#001050", fontSize: 14 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: "rgba(0,16,80,.58)", marginTop: 2 }}>{desc}</div>
      </div>
      <div className={`toggle-switch ${on ? "on" : "off"}`}>
        <div className="toggle-thumb"></div>
      </div>
    </div>
  );
}
