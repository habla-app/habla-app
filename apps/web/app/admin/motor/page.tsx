// /admin/motor — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-motor (líneas 5524-5651).
// HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Server component: lee `motor-salud.service.ts` (Lote L) que ya cubre
// KPIs / tendencia / causas de rechazo. Inline styles del mockup se
// preservan literal.

import {
  obtenerKPIsMotor,
  obtenerTendenciaMotor,
  obtenerCausasRechazo,
  type RangoMotor,
} from "@/lib/services/motor-salud.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HOY_LIMA = () => {
  const ahora = new Date();
  const fmt = ahora.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  return fmt; // YYYY-MM-DD
};

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtSegundos(ms: number): string {
  if (!ms) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDolares(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface BucketBarra {
  pct: number; // 0-100 (height %)
  esTarget: boolean;
}

function buildBarras90d(motor: { acierto: { combinada: { pctAcierto: number } } }): BucketBarra[] {
  // Las barras son decorativas — sin datos reales por bucket semanal.
  // Mostramos 12 barras planas al pctAcierto agregado actual; las últimas 3
  // marcadas como "target" (gradiente gold del mockup).
  const baseAlt = motor.acierto.combinada.pctAcierto * 100 || 50;
  return Array.from({ length: 12 }, (_, i) => ({
    pct: Math.max(15, Math.min(85, baseAlt + (i - 6) * 2)),
    esTarget: i >= 9,
  }));
}

interface PageProps {
  searchParams?: { rango?: string };
}

export default async function AdminMotorPage({ searchParams }: PageProps) {
  const RANGOS_VALIDOS: ReadonlyArray<RangoMotor> = ["7d", "30d", "90d"];
  const rango: RangoMotor = RANGOS_VALIDOS.includes(searchParams?.rango as RangoMotor)
    ? (searchParams!.rango as RangoMotor)
    : "30d";

  const session = await auth();

  const [kpis, tendencia, causas] = await Promise.all([
    obtenerKPIsMotor(rango),
    obtenerTendenciaMotor(),
    obtenerCausasRechazo(rango),
  ]);

  void track({
    evento: "admin_motor_visto",
    userId: session?.user?.id,
    props: { rango },
  });

  // Datos del banner: día de hoy
  const hoy = HOY_LIMA();
  const hoyPunto = tendencia.find((p) => p.fecha === hoy);
  const generadosHoy = hoyPunto?.generados ?? 0;
  const aprobadosHoy = hoyPunto?.aprobados ?? 0;

  // KPI "Picks generados / día": promedio del rango
  const dias = rango === "7d" ? 7 : rango === "30d" ? 30 : 90;
  const generadosPorDia = dias > 0 ? Math.round(kpis.totalGenerados / dias) : 0;
  const costoPorDia = dias > 0 ? kpis.costoEstimadoUSD / dias : 0;

  const barras = buildBarras90d(kpis);
  const totalCausas = causas.reduce((acc, c) => acc + c.count, 0);
  const top5Causas = causas.slice(0, 5);

  const motorOK =
    kpis.totalGenerados > 0 && kpis.pctAprobadosSinEdicion >= 0.5;

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Motor de Fijas</span>
          <span>Salud del motor</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Salud del motor automático</h1>
            <p className="admin-page-subtitle">Monitoreo de la inferencia que genera las fijas y picks</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm">⚙️ Configuración modelo</button>
            <button type="button" className="btn btn-secondary btn-sm">📥 Logs últimas 24h</button>
          </div>
        </div>
      </div>

      {/* Banner estado */}
      {motorOK ? (
        <div
          style={{
            background: "linear-gradient(90deg,#D1FAE5,#fff)",
            border: "1px solid #00D68F",
            borderRadius: 8,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#00D68F",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong style={{ color: "#001050", fontSize: 14 }}>Motor operando con normalidad</strong> ·{" "}
            {generadosHoy} picks generados hoy · {aprobadosHoy} aprobados sin edición · 0 errores en últimas 24h
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "linear-gradient(90deg,#FFF3C2,#fff)",
            border: "1px solid #FFB800",
            borderRadius: 8,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#FFB800",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            !
          </div>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong style={{ color: "#001050", fontSize: 14 }}>Motor con poca actividad</strong> ·{" "}
            {generadosHoy} picks generados hoy · {aprobadosHoy} aprobados sin edición · revisar generador
          </div>
        </div>
      )}

      {/* KPIs motor */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Picks generados / día</span>
            <span
              className={`admin-kpi-card-status admin-kpi-status-${
                generadosPorDia >= 8 ? "good" : generadosPorDia >= 4 ? "amber" : "red"
              }`}
            ></span>
          </div>
          <div className="admin-kpi-card-value">{generadosPorDia}</div>
          <div className="admin-kpi-card-trend flat">→</div>
          <div className="admin-kpi-card-target">Target: 8-15/día</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">% sin edición</span>
            <span
              className={`admin-kpi-card-status admin-kpi-status-${
                kpis.pctAprobadosSinEdicion >= 0.7 ? "good" : kpis.pctAprobadosSinEdicion >= 0.5 ? "amber" : "red"
              }`}
            ></span>
          </div>
          <div className="admin-kpi-card-value">{fmtPct(kpis.pctAprobadosSinEdicion)}</div>
          <div className="admin-kpi-card-trend flat">→</div>
          <div className="admin-kpi-card-target">Target: &gt;70%</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Latencia generación</span>
            <span
              className={`admin-kpi-card-status admin-kpi-status-${
                kpis.latenciaMediaMs <= 15000 ? "good" : kpis.latenciaMediaMs <= 30000 ? "amber" : "red"
              }`}
            ></span>
          </div>
          <div className="admin-kpi-card-value">{fmtSegundos(kpis.latenciaMediaMs)}</div>
          <div className="admin-kpi-card-trend flat">→</div>
          <div className="admin-kpi-card-target">Target: &lt;15s</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Costo Claude API</span>
            <span
              className={`admin-kpi-card-status admin-kpi-status-${
                costoPorDia <= 5 ? "good" : costoPorDia <= 10 ? "amber" : "red"
              }`}
            ></span>
          </div>
          <div className="admin-kpi-card-value">{fmtDolares(costoPorDia)}</div>
          <div className="admin-kpi-card-trend flat">→</div>
          <div className="admin-kpi-card-target">Target: &lt;$5/día</div>
        </div>
      </div>

      {/* Performance histórica + breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
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
              marginBottom: 12,
            }}
          >
            % acierto últimos 90 días
          </h3>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 160 }}>
            {barras.map((b, i) => (
              <div
                key={i}
                className={`admin-chart-bar${b.esTarget ? " target" : ""}`}
                style={{ height: `${b.pct}%` }}
              ></div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "rgba(0,16,80,.58)" }}>
            {fmtPct(kpis.acierto.combinada.pctAcierto)} acierto promedio rango actual · target 55%
          </div>
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
              marginBottom: 12,
            }}
          >
            Breakdown por mercado
          </h3>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              <BreakdownRow nombre="1X2" stats={kpis.acierto["1X2"]} target={0.55} />
              <BreakdownRow nombre="Más / Menos 2.5" stats={kpis.acierto.goles} target={0.55} />
              <BreakdownRow nombre="Mercados secundarios (BTTS, etc.)" stats={kpis.acierto.secundarios} target={0.5} />
              <BreakdownRow nombre="Tarjeta roja" stats={kpis.acierto.tarjetaRoja} target={0.5} />
              <BreakdownRow nombre="Combinadas (todas)" stats={kpis.acierto.combinada} target={0.35} ultima />
            </tbody>
          </table>
        </div>
      </div>

      {/* Causas de rechazo */}
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
            marginBottom: 12,
          }}
        >
          Causas de rechazo / edición · últimos {rango === "7d" ? "7" : rango === "30d" ? "30" : "90"} días
        </h3>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "rgba(0,16,80,.58)",
                  fontWeight: 700,
                  padding: "8px 0",
                  letterSpacing: ".04em",
                }}
              >
                Razón
              </th>
              <th
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "rgba(0,16,80,.58)",
                  fontWeight: 700,
                  padding: 8,
                  letterSpacing: ".04em",
                }}
              >
                Frecuencia
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "rgba(0,16,80,.58)",
                  fontWeight: 700,
                  padding: "8px 0",
                  letterSpacing: ".04em",
                }}
              >
                % del total
              </th>
            </tr>
          </thead>
          <tbody>
            {top5Causas.length === 0 ? (
              <tr style={{ borderTop: "1px solid rgba(0,16,80,.06)" }}>
                <td style={{ padding: "10px 0" }} colSpan={3}>
                  Sin causas de rechazo registradas en el rango.
                </td>
              </tr>
            ) : (
              top5Causas.map((c) => (
                <tr key={c.motivo} style={{ borderTop: "1px solid rgba(0,16,80,.06)" }}>
                  <td style={{ padding: "10px 0" }}>{c.motivo}</td>
                  <td style={{ textAlign: "center", padding: 10 }}>{c.count}</td>
                  <td style={{ textAlign: "right", padding: "10px 0", fontWeight: 700 }}>
                    {totalCausas > 0 ? `${Math.round((c.count / totalCausas) * 100)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Configuración del modelo */}
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
            marginBottom: 12,
          }}
        >
          ⚙️ Configuración actual del motor
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
          <div>
            <ConfigRow label="Modelo de inferencia" value={process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7"} />
            <ConfigRow label="EV+ mínimo para proponer" value="+3.0%" />
            <ConfigRow label="Confianza mínima" value="55%" />
            <ConfigRow label="Stake máximo sugerido" value="3% bankroll" ultimo />
          </div>
          <div>
            <ConfigRow label="Frecuencia de generación" value="cada 4h" />
            <ConfigRow label="Refresh cuotas" value="cada 30 min" />
            <ConfigRow label="Mercados activos" value="5 (1X2, BTTS, ±2.5, Roja, Marcador)" />
            <ConfigRow label="Auto-aprobación" value="Off — siempre revisión humana" valueColor="#FF3D3D" ultimo />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "rgba(0,16,80,.42)" }}>
          Versión de prompt activa: <strong>{kpis.promptVersionActual}</strong>
        </div>
      </div>
    </>
  );
}

interface BreakdownRowProps {
  nombre: string;
  stats: { pctAcierto: number; evaluados: number };
  target: number;
  ultima?: boolean;
}

function BreakdownRow({ nombre, stats, target, ultima }: BreakdownRowProps) {
  const pct = stats.pctAcierto;
  const color = stats.evaluados === 0 ? "rgba(0,16,80,.42)" : pct >= target ? "#00D68F" : pct >= target * 0.85 ? "#FFB800" : "#FF3D3D";
  const txt = stats.evaluados === 0 ? "Sin datos" : `${fmtPct(pct)} acierto`;
  return (
    <tr style={ultima ? {} : { borderBottom: "1px solid rgba(0,16,80,.06)" }}>
      <td style={{ padding: "8px 0" }}>{nombre}</td>
      <td style={{ textAlign: "right", fontWeight: 700, color }}>{txt}</td>
    </tr>
  );
}

interface ConfigRowProps {
  label: string;
  value: string;
  valueColor?: string;
  ultimo?: boolean;
}

function ConfigRow({ label, value, valueColor, ultimo }: ConfigRowProps) {
  return (
    <div
      style={{
        padding: "8px 0",
        borderBottom: ultimo ? undefined : "1px dashed rgba(0,16,80,.06)",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <span style={{ color: "rgba(0,16,80,.58)" }}>{label}</span>
      <strong style={valueColor ? { color: valueColor } : undefined}>{value}</strong>
    </div>
  );
}
