// /admin/embudo — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-embudo (líneas 6227-6356).
// HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Server component que lee `embudo.service.ts` (Lote P) para alimentar:
//   - Funnel principal (3 etapas + bifurcación A/B)
//   - Tabla comparativa Casas vs Socios
//   - Insights derivados del funnel

import {
  obtenerEmbudoCompleto,
  type RangoEmbudo,
} from "@/lib/services/embudo.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";
import { EmbudoRangoSelector } from "@/components/admin/embudo/EmbudoRangoSelector";

export const dynamic = "force-dynamic";

const RANGOS_VALIDOS: ReadonlyArray<RangoEmbudo> = ["7d", "30d", "mes_actual", "90d"];

function fmtPEN(n: number): string {
  if (n >= 1000) return `S/ ${(n / 1000).toFixed(1)}K`;
  return `S/ ${Math.round(n).toLocaleString("es-PE")}`;
}

function fmtMRR(n: number): string {
  if (n >= 1000) return `S/ ${(n / 1000).toFixed(1)}K MRR`;
  return `S/ ${Math.round(n).toLocaleString("es-PE")} MRR`;
}

interface PageProps {
  searchParams?: { rango?: string };
}

export default async function AdminEmbudoPage({ searchParams }: PageProps) {
  const rango: RangoEmbudo = RANGOS_VALIDOS.includes(searchParams?.rango as RangoEmbudo)
    ? (searchParams!.rango as RangoEmbudo)
    : "30d";

  const session = await auth();
  void track({
    evento: "admin_embudo_visto",
    userId: session?.user?.id,
    props: { rango },
  });

  const data = await obtenerEmbudoCompleto(rango);

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Monetización</span>
          <span>Embudo</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Embudo de Monetización</h1>
            <p className="admin-page-subtitle">De visitante a Socio · de Free a casa de apuestas · ¿dónde se cae el funnel?</p>
          </div>
          <EmbudoRangoSelector rangoActual={rango} />
        </div>
      </div>

      {/* Funnel visual */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
          borderRadius: 8,
          padding: 24,
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
            marginBottom: 18,
          }}
        >
          Embudo principal · {rango === "7d" ? "últimos 7 días" : rango === "90d" ? "últimos 90 días" : rango === "mes_actual" ? "mes actual" : "últimos 30 días"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 720, margin: "0 auto" }}>
          {/* Etapa 0 */}
          <FunnelRow
            label="Visitantes únicos"
            sub="Etapa 0 · entrada al sitio"
            value={data.principal.visitantes.value}
            pct={100}
            widthPct={100}
            gradient="linear-gradient(90deg,#001050,#0052CC)"
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "rgba(0,16,80,.58)", paddingRight: 90 }}>
            ↓ <span style={{ fontWeight: 700 }}>{data.rebotePct}%</span> rebote · <span style={{ color: "#FF7A00", fontWeight: 700 }}>acción: optimizar Home</span>
          </div>

          {/* Etapa 1 */}
          <FunnelRow
            label="Comprometidos"
            sub="Etapa 1 · sesión >30s + 2 pgs"
            value={data.principal.comprometidos.value}
            pct={data.principal.comprometidos.pctSobreEntrada}
            widthPct={data.principal.comprometidos.widthPct}
            gradient="linear-gradient(90deg,#0038B8,#1A6EFF)"
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "rgba(0,16,80,.58)", paddingRight: 90 }}>
            ↓ <span style={{ fontWeight: 700, color: data.registroSobreComprometidosPct >= 8 ? "#00D68F" : "#FFB800" }}>{data.registroSobreComprometidosPct}%</span> registra ·{" "}
            <span style={{ color: data.registroSobreComprometidosPct >= 8 ? "#00D68F" : "#FFB800", fontWeight: 700 }}>
              {data.registroSobreComprometidosPct >= 8 ? "por encima target (8%)" : "bajo target (8%)"}
            </span>
          </div>

          {/* Etapa 2 */}
          <FunnelRow
            label="Registrados Free"
            sub="Etapa 2 · cuenta Habla!"
            value={data.principal.registradosFree.value}
            pct={data.principal.registradosFree.pctSobreEntrada}
            widthPct={data.principal.registradosFree.widthPct}
            gradient="linear-gradient(90deg,#0052CC,#5C95FF)"
          />

          {/* DIVERGENCIA */}
          <div
            style={{
              margin: "12px 0 6px",
              textAlign: "center",
              fontSize: 11,
              fontWeight: 800,
              color: "rgba(0,16,80,.58)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            ↓ ↓ Dos caminos paralelos ↓ ↓
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 6 }}>
            {/* Camino A: Casas */}
            <div style={{ borderLeft: "3px solid #DC2626", paddingLeft: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#DC2626",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  marginBottom: 8,
                }}
              >
                CAMINO A · CASAS DE APUESTAS (afiliación)
              </div>
              <CaminoBox
                bg="#FFEBEB"
                value={`${data.caminoCasas.clicksCasa.toLocaleString("es-PE")} click a casa`}
                sub={`${data.caminoCasas.pctClicksSobreRegistrados}% de registrados · target 25%+ ${
                  data.caminoCasas.pctClicksSobreRegistrados >= 25 ? "✓" : ""
                }`}
              />
              <CaminoBox
                bg="#FEDFDF"
                indent={18}
                value={`${data.caminoCasas.registrosCasa.toLocaleString("es-PE")} registró en casa`}
                sub={`${
                  data.caminoCasas.clicksCasa > 0
                    ? Math.round((data.caminoCasas.registrosCasa / data.caminoCasas.clicksCasa) * 100)
                    : 0
                }% de clicks`}
              />
              <CaminoBox
                bg="#DC2626"
                color="#fff"
                indent={36}
                value={`${data.caminoCasas.ftds.toLocaleString("es-PE")} FTD`}
                sub={`${
                  data.caminoCasas.registrosCasa > 0
                    ? Math.round((data.caminoCasas.ftds / data.caminoCasas.registrosCasa) * 100)
                    : 0
                }% de registros casa · ${fmtPEN(data.caminoCasas.revenueAfiliacionPEN)} revenue afiliación`}
                subColor="rgba(255,255,255,.85)"
              />
            </div>

            {/* Camino B: Socios */}
            <div style={{ borderLeft: "3px solid #FFB800", paddingLeft: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#7A4A00",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  marginBottom: 8,
                }}
              >
                CAMINO B · SOCIOS (suscripción)
              </div>
              <CaminoBox
                bg="#FFFAEB"
                value={`${data.caminoSocios.vioPaywall.toLocaleString("es-PE")} vio paywall Socios`}
                sub={`${data.caminoSocios.pctPaywallSobreRegistrados}% de registrados`}
              />
              <CaminoBox
                bg="#FFEBC2"
                indent={18}
                value={`${data.caminoSocios.inicioCheckout.toLocaleString("es-PE")} inició checkout`}
                sub={`${
                  data.caminoSocios.vioPaywall > 0
                    ? Math.round((data.caminoSocios.inicioCheckout / data.caminoSocios.vioPaywall) * 100)
                    : 0
                }% de paywall`}
              />
              <CaminoBox
                bg="#FFB800"
                color="#001050"
                indent={36}
                value={`${data.caminoSocios.pagoSocios.toLocaleString("es-PE")} pagó Socios`}
                sub={`${
                  data.caminoSocios.inicioCheckout > 0
                    ? Math.round((data.caminoSocios.pagoSocios / data.caminoSocios.inicioCheckout) * 100)
                    : 0
                }% de checkout · ${fmtMRR(data.caminoSocios.mrrPEN)}`}
                subColor="#7A4A00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Comparativa de caminos */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,16,80,.06)",
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
            color: "#001050",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Performance comparada
        </h3>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thCompar("left", "rgba(0,16,80,.58)")}>Métrica</th>
              <th style={thCompar("right", "#DC2626")}>Casas (afiliación)</th>
              <th style={thCompar("right", "#7A4A00")}>Socios (MRR)</th>
            </tr>
          </thead>
          <tbody>
            <CompararRow label="Conversión Free → conversión final" a={`${data.comparativa.conversionFinalCasasPct.toFixed(1)}%`} b={`${data.comparativa.conversionFinalSociosPct.toFixed(1)}%`} />
            <CompararRow label="Revenue por conversión" a={fmtPEN(data.comparativa.revenuePorConversionCasasPEN)} b={`${fmtPEN(data.comparativa.revenuePorConversionSociosPEN)} / 12 meses`} />
            <CompararRow label="LTV estimado" a={`${fmtPEN(data.comparativa.ltvCasasPEN)} (3 año)`} b={`${fmtPEN(data.comparativa.ltvSociosPEN)} (8 mes)`} />
            <CompararRow label="Tiempo a conversión" a={`${data.comparativa.diasAConversionCasas.toFixed(1)} días`} b={`${data.comparativa.diasAConversionSocios.toFixed(1)} días`} />
            <CompararRow label="Conversión cruzada (también el otro)" a={`${Math.round(data.comparativa.conversionCruzadaCasasPct)}%`} b={`${Math.round(data.comparativa.conversionCruzadaSociosPct)}%`} />
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div
        style={{
          background: "#FFFAEB",
          border: "1px solid #FFB800",
          borderRadius: 8,
          padding: 18,
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
          ⚡ Insights del embudo
        </h3>
        <ul
          style={{
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <li>
            📌 <strong>{Math.round(data.comparativa.conversionCruzadaSociosPct)}% de Socios también clickea casas</strong> — los caminos no compiten, se complementan. Validar el cross-sell.
          </li>
          <li>
            📌 <strong>Caída más grande</strong>: registrado → click casa ({100 - data.caminoCasas.pctClicksSobreRegistrados}% drop). Hipótesis: el botón &ldquo;Apostar →&rdquo; no es lo suficientemente prominente.
          </li>
          <li>
            ⚠️ <strong>Solo {data.caminoSocios.pctPaywallSobreRegistrados}% de registrados ve el paywall Socios</strong> — bajo. Subir visibilidad del pick bloqueado en /las-fijas/[slug].
          </li>
          <li>
            ✅ <strong>Conversión paywall → checkout</strong>:{" "}
            {data.caminoSocios.vioPaywall > 0
              ? Math.round((data.caminoSocios.inicioCheckout / data.caminoSocios.vioPaywall) * 100)
              : 0}
            %, {data.caminoSocios.vioPaywall > 0 && (data.caminoSocios.inicioCheckout / data.caminoSocios.vioPaywall) >= 0.1 ? "por encima del benchmark del sector (10-12%)." : "por debajo del benchmark del sector (10-12%)."}
          </li>
        </ul>
      </div>
    </>
  );
}

function thCompar(align: "left" | "right" | "center", color: string) {
  return {
    textAlign: align,
    fontSize: 10,
    textTransform: "uppercase" as const,
    color,
    fontWeight: 700,
    padding: align === "left" ? "10px 0" : align === "right" ? "10px 0" : 10,
    letterSpacing: ".04em",
  };
}

function CompararRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr style={{ borderTop: "1px solid rgba(0,16,80,.06)" }}>
      <td style={{ padding: "10px 0" }}>{label}</td>
      <td style={{ textAlign: "right", padding: 10, fontWeight: 700 }}>{a}</td>
      <td style={{ textAlign: "right", padding: "10px 0", fontWeight: 700 }}>{b}</td>
    </tr>
  );
}

interface FunnelRowProps {
  label: string;
  sub: string;
  value: number;
  pct: number;
  widthPct: number;
  gradient: string;
}

function FunnelRow({ label, sub, value, pct, widthPct, gradient }: FunnelRowProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 14, alignItems: "center" }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, color: "#001050", fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)" }}>{sub}</div>
      </div>
      <div
        style={{
          background: gradient,
          height: 48,
          borderRadius: 6,
          width: `${widthPct}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        {value.toLocaleString("es-PE")}
      </div>
      <div style={{ textAlign: "right", fontWeight: 700, color: "#001050" }}>{pct}%</div>
    </div>
  );
}

interface CaminoBoxProps {
  bg: string;
  color?: string;
  value: string;
  sub: string;
  subColor?: string;
  indent?: number;
}

function CaminoBox({ bg, color, value, sub, subColor, indent }: CaminoBoxProps) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: 6,
        padding: "10px 14px",
        marginBottom: 6,
        marginLeft: indent,
        color,
      }}
    >
      <div style={{ fontWeight: 700, color: color ?? "#001050", fontSize: 13 }}>{value}</div>
      <div style={{ fontSize: 11, color: subColor ?? "rgba(0,16,80,.58)" }}>{sub}</div>
    </div>
  );
}
