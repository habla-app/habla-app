// TabCasas — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-vinculaciones tab casas
// (líneas 6499-6527).

import type { VinculacionCasaFila } from "@/lib/services/vinculaciones.service";

interface Props {
  casas: VinculacionCasaFila[];
}

function fmtPEN(n: number): string {
  return `S/ ${Math.round(n).toLocaleString("es-PE")}`;
}

export function TabCasas({ casas }: Props) {
  const totalRevenue = casas.reduce((acc, c) => acc + c.revenuePEN, 0);
  const top2Revenue = casas.slice(0, 2).reduce((acc, c) => acc + c.revenuePEN, 0);
  const concentracion = totalRevenue > 0 ? Math.round((top2Revenue / totalRevenue) * 100) : 0;

  return (
    <div className="vinc-content" id="vinc-tab-casas">
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
          Distribución de FTDs por casa
        </h3>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th("left")}>Casa</th>
              <th style={th("center")}>Clicks</th>
              <th style={th("center")}>FTDs</th>
              <th style={th("center")}>CTR → FTD</th>
              <th style={th("right")}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {casas.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "rgba(0,16,80,.42)" }}>
                  Sin casas activas para mostrar.
                </td>
              </tr>
            ) : (
              casas.map((c) => {
                const ctrColor = c.ctr >= 8 ? "#00D68F" : c.ctr >= 5 ? "#FFB800" : "#FF3D3D";
                return (
                  <tr key={c.nombre} style={{ borderTop: "1px solid rgba(0,16,80,.06)" }}>
                    <td style={{ padding: "10px 0" }}>
                      <strong>{c.nombre}</strong>
                    </td>
                    <td style={{ textAlign: "center", padding: 10 }}>{c.clicks}</td>
                    <td style={{ textAlign: "center", padding: 10 }}>{c.ftds}</td>
                    <td style={{ textAlign: "center", padding: 10, fontWeight: 700, color: ctrColor }}>
                      {c.ctr.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", padding: "10px 0", fontWeight: 700 }}>{fmtPEN(c.revenuePEN)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          background: "#FFFAEB",
          border: "1px solid #FFB800",
          borderRadius: 8,
          padding: 14,
          fontSize: 13,
          color: "rgba(0,16,80,.85)",
        }}
      >
        📌 <strong>Insight:</strong>{" "}
        {casas.length >= 2
          ? `${casas[0]?.nombre} y ${casas[1]?.nombre} concentran ${concentracion}% del revenue. Diversificar promoción de las casas con mejor CTR.`
          : "Aún no hay casas con tráfico suficiente para análisis."}
      </div>
    </div>
  );
}

function th(align: "left" | "center" | "right") {
  return {
    textAlign: align,
    fontSize: 10,
    textTransform: "uppercase" as const,
    color: "rgba(0,16,80,.58)",
    fontWeight: 700,
    padding: align === "left" || align === "right" ? "10px 0" : 10,
    letterSpacing: ".04em",
  };
}
