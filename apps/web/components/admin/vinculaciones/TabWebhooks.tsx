// TabWebhooks — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-vinculaciones tab webhooks
// (líneas 6529-6585).

import type { VinculacionWebhookFila } from "@/lib/services/vinculaciones.service";

interface Props {
  webhooks: VinculacionWebhookFila[];
}

export function TabWebhooks({ webhooks }: Props) {
  return (
    <div className="vinc-content" id="vinc-tab-webhooks">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Endpoint</th>
            <th className="center" style={{ textAlign: "center" }}>Estado</th>
            <th className="center" style={{ textAlign: "center" }}>Última señal</th>
            <th className="center" style={{ textAlign: "center" }}>Errores 24h</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {webhooks.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "rgba(0,16,80,.42)" }}>
                Sin webhooks registrados.
              </td>
            </tr>
          ) : (
            webhooks.map((w) => {
              const tinted = w.estado === "TIMEOUT" ? "rgba(255,184,0,.04)" : w.estado === "ERROR" ? "rgba(255,61,61,.04)" : undefined;
              return (
                <tr key={`${w.servicio}-${w.endpoint}`} style={tinted ? { background: tinted } : undefined}>
                  <td>
                    <strong>{w.servicio}</strong>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(0,16,80,.58)" }}>{w.endpoint}</td>
                  <td style={{ textAlign: "center" }}>
                    {w.estado === "OK" && <span className="adm-pill adm-pill-green">OK</span>}
                    {w.estado === "TIMEOUT" && <span className="adm-pill adm-pill-amber">Timeout</span>}
                    {w.estado === "ERROR" && <span className="adm-pill adm-pill-red">Error</span>}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 11 }}>{w.ultimaSenalTexto}</td>
                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: 700,
                      color: w.errores24h > 0 ? "#FF7A00" : undefined,
                    }}
                  >
                    {w.errores24h}
                  </td>
                  <td>
                    {w.estado === "OK" && <button type="button" className="btn btn-ghost btn-xs">Test</button>}
                    {w.estado === "TIMEOUT" && <button type="button" className="btn btn-secondary btn-xs">Reintentar</button>}
                    {w.estado === "ERROR" && <button type="button" className="btn btn-rechazar btn-xs">Reintentar</button>}
                    {w.servicio.startsWith("api-football") && (
                      <button type="button" className="btn btn-ghost btn-xs">Pull manual</button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
