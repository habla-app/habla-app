// AlertasSection — Lote V fase V.5.
//
// Sección "Alertas de cambios de cuota" en /admin/partidos/[id]?alertas=1.
// Server-rendered. Lista alertas en orden cronológico desc con flecha
// arriba/abajo según signo de variación + botón "marcar visto" por fila.

import {
  listarAlertasPorPartido,
  ETIQUETAS_CASA,
} from "@/lib/services/admin-cuotas.service";
import { AlertaMarcarVistaBtn } from "./AlertaMarcarVistaBtn";

interface Props {
  partidoId: string;
  soloNoVistas?: boolean;
}

const LIMA_TZ = "America/Lima";

function tiempoRelativo(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "hace <1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

function _fechaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const SELECCION_LABEL: Record<string, string> = {
  local: "Local",
  empate: "Empate",
  visita: "Visita",
  "1x": "1X",
  "12": "12",
  x2: "X2",
  over25: "Over 2.5",
  under25: "Under 2.5",
  btts_si: "BTTS Sí",
  btts_no: "BTTS No",
};

const MERCADO_LABEL: Record<string, string> = {
  "1X2": "1X2",
  DOBLE_OP: "Doble Op",
  MAS_MENOS_25: "±2.5 goles",
  BTTS: "BTTS",
};

export async function AlertasSection({ partidoId, soloNoVistas = true }: Props) {
  const alertas = await listarAlertasPorPartido(partidoId, {
    soloNoVistas,
    limit: 50,
  });

  return (
    <div style={{ marginTop: 18, padding: 16, borderTop: "1px solid var(--border-light)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            textTransform: "uppercase",
            color: "var(--text-dark)",
          }}
        >
          Alertas de cambios de cuota
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={`/admin/partidos/${partidoId}?alertas=1${soloNoVistas ? "&noVistas=0" : ""}`}
            className="btn btn-ghost btn-xs"
            style={{ fontSize: 11 }}
          >
            {soloNoVistas ? "Mostrar todas" : "Solo no vistas"}
          </a>
        </div>
      </div>

      {alertas.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted-d)",
            padding: 12,
            textAlign: "center",
          }}
        >
          {soloNoVistas
            ? "No hay alertas sin vista."
            : "No hay alertas registradas para este partido."}
        </div>
      ) : (
        <div className="alertas-list">
          {alertas.map((a) => {
            const subio = a.variacionPct >= 0;
            return (
              <div key={a.id} className="alerta-row">
                <span
                  className={
                    subio
                      ? "alerta-row-flecha alerta-row-up"
                      : "alerta-row-flecha alerta-row-down"
                  }
                  aria-hidden="true"
                >
                  {subio ? "↑" : "↓"}
                </span>
                <div className="alerta-row-info">
                  <div className="alerta-row-title">
                    {ETIQUETAS_CASA[a.casa] ?? a.casa} ·{" "}
                    {MERCADO_LABEL[a.mercado] ?? a.mercado} ·{" "}
                    {SELECCION_LABEL[a.seleccion] ?? a.seleccion}
                  </div>
                  <div className="alerta-row-cuotas">
                    {a.cuotaAnterior.toFixed(2)} → {a.cuotaNueva.toFixed(2)}{" "}
                    <span
                      style={{
                        color: subio ? "var(--pred-right)" : "var(--pred-wrong)",
                        fontWeight: 700,
                      }}
                    >
                      ({subio ? "+" : ""}
                      {a.variacionPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="alerta-row-time">
                  Detectado: {tiempoRelativo(a.detectadoEn)}
                </div>
                <div>
                  {a.vistaPorAdmin ? (
                    <span
                      className="adm-pill adm-pill-gray"
                      style={{ fontSize: 10 }}
                    >
                      Visto
                    </span>
                  ) : (
                    <AlertaMarcarVistaBtn alertaId={a.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
