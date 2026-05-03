// TabWhatsApp — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-vinculaciones tab whatsapp
// (líneas 6406-6498). HTML idéntico al mockup, clases del mockup que viven
// en `mockup-styles.css` desde el Lote R.
//
// Server component (sin estado). El page padre resuelve por query param ?tab=.

import type { VinculacionWhatsApp, VinculacionWhatsAppFila } from "@/lib/services/vinculaciones.service";

interface Props {
  data: VinculacionWhatsApp;
}

export function TabWhatsApp({ data }: Props) {
  return (
    <div className="vinc-content" id="vinc-tab-whatsapp">
      {/* Resumen WhatsApp */}
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
          Sincronía Channel ↔ DB
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <ResumenCard
            bg="#D1FAE5"
            value={data.conCanal}
            titulo="Socios con canal ✓"
            sub="activos · canal accesible"
          />
          <ResumenCard
            bg="#FFF3C2"
            value={data.pagoSinCanal}
            titulo="Pago confirmado · sin canal"
            sub="requieren atención manual"
          />
          <ResumenCard
            bg="#FFE5E5"
            value={data.enCanalSinPago}
            titulo="En canal · sin pago"
            sub="leak · remover"
          />
        </div>
      </div>

      {/* Tabla Socios */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Plan</th>
            <th>Teléfono</th>
            <th className="center" style={{ textAlign: "center" }}>Pago activo</th>
            <th className="center" style={{ textAlign: "center" }}>En Channel</th>
            <th className="center" style={{ textAlign: "center" }}>Última lectura</th>
            <th className="center" style={{ textAlign: "center" }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.filas.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "rgba(0,16,80,.42)" }}>
                Sin Socios activos para mostrar.
              </td>
            </tr>
          ) : (
            data.filas.map((f, i) => <FilaSocio key={`${f.usuarioId ?? "leak"}-${i}`} fila={f} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function ResumenCard({
  bg,
  value,
  titulo,
  sub,
}: {
  bg: string;
  value: number;
  titulo: string;
  sub: string;
}) {
  return (
    <div style={{ background: bg, borderRadius: 6, padding: 14 }}>
      <div
        style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: 24,
          fontWeight: 900,
          color: "#001050",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#001050", fontWeight: 700, marginTop: 4 }}>{titulo}</div>
      <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)" }}>{sub}</div>
    </div>
  );
}

const PLAN_PILL: Record<NonNullable<VinculacionWhatsAppFila["plan"]>, { label: string; pill: "blue" | "amber" }> = {
  MENSUAL: { label: "Mensual", pill: "blue" },
  TRIMESTRAL: { label: "Trimestral", pill: "amber" },
  ANUAL: { label: "Anual", pill: "amber" },
};

function FilaSocio({ fila }: { fila: VinculacionWhatsAppFila }) {
  const tinted =
    fila.estado === "FALTA_TEL"
      ? "rgba(255,184,0,.04)"
      : fila.estado === "LEAK"
      ? "rgba(255,61,61,.04)"
      : undefined;

  return (
    <tr style={tinted ? { background: tinted } : undefined}>
      <td>
        {fila.usuarioId && fila.username ? (
          <>
            <div style={{ fontWeight: 600, color: "#001050" }}>@{fila.username}</div>
            <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)" }}>{fila.email}</div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, color: "#001050" }}>{fila.telefono ?? "—"}</div>
            <div style={{ fontSize: 11, color: "#FF3D3D" }}>⚠️ no asociado a usuario</div>
          </>
        )}
      </td>
      <td>
        {fila.plan ? (
          <span className={`adm-pill adm-pill-${PLAN_PILL[fila.plan].pill}`}>{PLAN_PILL[fila.plan].label}</span>
        ) : (
          "—"
        )}
      </td>
      <td style={{ fontFamily: "monospace", fontSize: 11 }}>
        {fila.telefono ?? <span style={{ fontFamily: "inherit" }}>⚠️ pendiente</span>}
      </td>
      <td style={{ textAlign: "center" }}>
        {fila.pagoActivo ? (
          <span className="adm-pill adm-pill-green">✓</span>
        ) : (
          <span className="adm-pill adm-pill-red">✗</span>
        )}
      </td>
      <td style={{ textAlign: "center" }}>
        {fila.enChannel ? (
          fila.estado === "LEAK" && !fila.pagoActivo ? (
            <span className="adm-pill adm-pill-red">✓ sin pago</span>
          ) : (
            <span className="adm-pill adm-pill-green">✓</span>
          )
        ) : (
          <span className="adm-pill adm-pill-red">✗</span>
        )}
      </td>
      <td style={{ textAlign: "center", fontSize: 11, color: "rgba(0,16,80,.58)" }}>
        {fila.ultimaLecturaTexto}
      </td>
      <td style={{ textAlign: "center" }}>
        {fila.estado === "OK" && <span className="adm-pill adm-pill-green">OK</span>}
        {fila.estado === "FALTA_TEL" && <span className="adm-pill adm-pill-amber">Falta tel</span>}
        {fila.estado === "LEAK" && <span className="adm-pill adm-pill-red">Leak</span>}
      </td>
      <td>
        {fila.estado === "OK" && <button type="button" className="btn btn-ghost btn-xs">Ver</button>}
        {fila.estado === "FALTA_TEL" && <button type="button" className="btn btn-secondary btn-xs">Pedir tel</button>}
        {fila.estado === "LEAK" && <button type="button" className="btn btn-rechazar btn-xs">Remover</button>}
      </td>
    </tr>
  );
}
