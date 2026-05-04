// CapturaCuotasSection — Lote V fase V.5 + Lote V.9.4 (May 2026).
//
// Sección server-rendered en /admin/partidos/[id] con la tabla de cuotas
// de las 7 casas + header con estado global + botones de refresh global,
// re-ejecutar discovery (V.6), y "Ver alertas (N)".
//
// Lote V.9.4: la vista pasa de 7 cards (.cuotas-casa-card) a una tabla
// densa (.cuotas-tabla) con 1 fila por casa. Permite comparar cuotas
// entre casas de un solo vistazo (ej. ver qué casa tiene el mejor 1
// para el local). Las columnas son: Casa, Estado, Última, 1X2, Doble Op,
// ±2.5, BTTS, Event ID, Acciones.
//
// Cero clases Tailwind utility — usa clases nominadas del mockup
// (`adm-pill`, `card`, `section-bar`, `btn`, etc) y CSS específico del
// Lote V que vive en mockup-styles.css.

import {
  obtenerCapturaCuotasPartido,
  ETIQUETAS_CASA,
  type CapturaCuotasFila,
} from "@/lib/services/admin-cuotas.service";
import { RefreshPartidoBtn } from "./RefreshPartidoBtn";
import { RefreshCasaBtn } from "./RefreshCasaBtn";
import { VincularEventIdModal } from "./VincularEventIdModal";
import { AlertasSection } from "./AlertasSection";
import { ReDiscoveryBtn } from "./ReDiscoveryBtn";

interface Props {
  partidoId: string;
}

const LIMA_TZ = "America/Lima";

function tiempoRelativo(d: Date | null): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "<1m";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

function fechaCorta(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function variacion(actual: number | null, anterior: number | null): {
  texto: string;
  className: string;
} {
  if (actual === null || anterior === null || anterior === 0) {
    return { texto: "", className: "cuota-var-flat" };
  }
  const pct = ((actual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.5) return { texto: "", className: "cuota-var-flat" };
  if (pct > 0)
    return {
      texto: `↑${Math.abs(pct).toFixed(1)}%`,
      className: "cuota-var-up",
    };
  return {
    texto: `↓${Math.abs(pct).toFixed(1)}%`,
    className: "cuota-var-down",
  };
}

function pillEstado(estado: CapturaCuotasFila["estado"]): {
  cls: string;
  label: string;
} {
  switch (estado) {
    case "OK":
      return { cls: "adm-pill adm-pill-green", label: "🟢 OK" };
    case "STALE":
      return { cls: "adm-pill adm-pill-amber", label: "⚠️ STALE" };
    case "ERROR":
      return { cls: "adm-pill adm-pill-red", label: "🔴 ERROR" };
    case "BLOQUEADO":
      return { cls: "adm-pill adm-pill-gray", label: "⛔ BLOQUEADO" };
    case "SIN_DATOS":
      return { cls: "adm-pill adm-pill-gray", label: "—" };
    default:
      return { cls: "adm-pill adm-pill-gray", label: "Sin captura" };
  }
}

function fmtCuota(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

/**
 * Celda con valor de cuota + flecha de variación arriba.
 * Compacta: el valor en grande, la variación pequeña debajo.
 */
function CeldaCuota({
  actual,
  anterior,
}: {
  actual: number | null;
  anterior: number | null;
}) {
  const v = variacion(actual, anterior);
  return (
    <span className="cuota-celda">
      <span className="cuota-celda-valor">{fmtCuota(actual)}</span>
      {v.texto ? (
        <span className={`cuota-celda-var ${v.className}`}>{v.texto}</span>
      ) : null}
    </span>
  );
}

/**
 * Bloque de mercado: 2-3 celdas separadas por slash. Cada celda con
 * label arriba (chico) y valor abajo. Mantiene la info densa pero legible.
 */
function MercadoCelda({
  pares,
}: {
  pares: { label: string; actual: number | null; anterior: number | null }[];
}) {
  return (
    <span className="cuotas-mercado-grupo">
      {pares.map((p, i) => (
        <span key={p.label} className="cuotas-mercado-par">
          <span className="cuotas-mercado-par-label">{p.label}</span>
          <CeldaCuota actual={p.actual} anterior={p.anterior} />
          {i < pares.length - 1 ? (
            <span className="cuotas-mercado-par-sep" aria-hidden="true">
              /
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function FilaCasa({
  fila,
  partidoId,
}: {
  fila: CapturaCuotasFila;
  partidoId: string;
}) {
  const pill = pillEstado(fila.estado);
  const tiempoTxt =
    fila.estado === "STALE" && fila.ultimoExito
      ? `OK hace ${tiempoRelativo(fila.ultimoExito)}`
      : fila.estado === "OK" && fila.capturadoEn
        ? `hace ${tiempoRelativo(fila.capturadoEn)}`
        : fila.ultimoIntento
          ? `hace ${tiempoRelativo(fila.ultimoIntento)}`
          : "nunca";

  // Filas tinted según estado (rojo / amber / normal).
  const rowCls =
    fila.estado === "ERROR"
      ? "cuotas-tabla-row cuotas-tabla-row-err"
      : fila.estado === "STALE"
        ? "cuotas-tabla-row cuotas-tabla-row-warn"
        : "cuotas-tabla-row";

  return (
    <tr className={rowCls}>
      <td className="cuotas-tabla-casa">{ETIQUETAS_CASA[fila.casa]}</td>
      <td className="cuotas-tabla-estado">
        <span className={pill.cls}>{pill.label}</span>
      </td>
      <td className="cuotas-tabla-tiempo" title={fechaCorta(fila.capturadoEn)}>
        {tiempoTxt}
      </td>
      <td>
        {fila.eventIdExterno ? (
          <MercadoCelda
            pares={[
              {
                label: "1",
                actual: fila.cuotaLocal,
                anterior: fila.cuotaLocalAnterior,
              },
              {
                label: "X",
                actual: fila.cuotaEmpate,
                anterior: fila.cuotaEmpateAnterior,
              },
              {
                label: "2",
                actual: fila.cuotaVisita,
                anterior: fila.cuotaVisitaAnterior,
              },
            ]}
          />
        ) : (
          <span className="cuotas-tabla-sin-datos">—</span>
        )}
      </td>
      <td>
        {fila.eventIdExterno ? (
          <MercadoCelda
            pares={[
              {
                label: "1X",
                actual: fila.cuota1X,
                anterior: fila.cuota1XAnterior,
              },
              {
                label: "12",
                actual: fila.cuota12,
                anterior: fila.cuota12Anterior,
              },
              {
                label: "X2",
                actual: fila.cuotaX2,
                anterior: fila.cuotaX2Anterior,
              },
            ]}
          />
        ) : (
          <span className="cuotas-tabla-sin-datos">—</span>
        )}
      </td>
      <td>
        {fila.eventIdExterno ? (
          <MercadoCelda
            pares={[
              {
                label: "+2.5",
                actual: fila.cuotaOver25,
                anterior: fila.cuotaOver25Anterior,
              },
              {
                label: "-2.5",
                actual: fila.cuotaUnder25,
                anterior: fila.cuotaUnder25Anterior,
              },
            ]}
          />
        ) : (
          <span className="cuotas-tabla-sin-datos">—</span>
        )}
      </td>
      <td>
        {fila.eventIdExterno ? (
          <MercadoCelda
            pares={[
              {
                label: "Sí",
                actual: fila.cuotaBttsSi,
                anterior: fila.cuotaBttsSiAnterior,
              },
              {
                label: "No",
                actual: fila.cuotaBttsNo,
                anterior: fila.cuotaBttsNoAnterior,
              },
            ]}
          />
        ) : (
          <span className="cuotas-tabla-sin-datos">—</span>
        )}
      </td>
      <td className="cuotas-tabla-eventid">
        {fila.eventIdExterno ? (
          <span className="cuotas-tabla-eventid-block">
            <code className="cuotas-casa-card-event-id">
              {fila.eventIdExterno}
            </code>
            <span
              className={`adm-pill adm-pill-${fila.metodoDiscovery === "MANUAL" ? "amber" : "blue"}`}
              style={{ fontSize: 9 }}
            >
              {fila.metodoDiscovery === "MANUAL" ? "manual" : "auto"}
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--text-muted-d)" }}>sin asignar</span>
        )}
      </td>
      <td className="cuotas-tabla-acciones">
        <RefreshCasaBtn
          partidoId={partidoId}
          casa={fila.casa}
          disabled={!fila.eventIdExterno}
        />
        <VincularEventIdModal
          partidoId={partidoId}
          casa={fila.casa}
          casaLabel={ETIQUETAS_CASA[fila.casa]}
          eventIdActual={fila.eventIdExterno}
          triggerLabel={fila.eventIdExterno ? "editar" : undefined}
        />
        {fila.estado === "ERROR" && fila.errorMensaje ? (
          <span
            className="cuotas-tabla-err-tip"
            title={`${fila.intentosFallidos > 0 ? `${fila.intentosFallidos} intentos · ` : ""}${fila.errorMensaje}`}
          >
            ⚠
          </span>
        ) : null}
      </td>
    </tr>
  );
}

interface SearchParams {
  alertas?: string;
  noVistas?: string;
}

export async function CapturaCuotasSection({
  partidoId,
  searchParams,
}: Props & { searchParams?: SearchParams }) {
  const data = await obtenerCapturaCuotasPartido(partidoId);
  if (!data) return null;
  if (!data.filtro1) {
    return (
      <div className="card" style={{ padding: 16, marginTop: 18 }}>
        <h3
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text-dark)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Captura de cuotas
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted-d)" }}>
          Activá Filtro 1 sobre este partido para empezar a capturar cuotas
          desde las 7 casas.
        </p>
      </div>
    );
  }

  const completas = data.filas.filter((f) => f.estado === "OK").length;
  const total = data.filas.length;
  const stale = data.filas.filter((f) => f.estado === "STALE").length;
  const errores = data.filas.filter((f) => f.estado === "ERROR").length;
  const pillGlobal =
    completas === total
      ? {
          cls: "adm-pill adm-pill-green",
          label: `🟢 COMPLETA (${completas}/${total})`,
        }
      : completas === 0
        ? { cls: "adm-pill adm-pill-red", label: `🔴 FALLIDA (0/${total})` }
        : {
            cls: "adm-pill adm-pill-amber",
            label: `⚠️ PARCIAL (${completas}/${total})`,
          };

  const verAlertas = searchParams?.alertas === "1";

  return (
    <section className="card" style={{ padding: 18, marginTop: 24 }}>
      <div className="section-bar" style={{ marginBottom: 14 }}>
        <div className="section-bar-left">
          <div className="section-bar-icon">📊</div>
          <div>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 14,
                fontWeight: 800,
                textTransform: "uppercase",
                color: "var(--text-dark)",
              }}
            >
              Captura de cuotas
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted-d)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span className={pillGlobal.cls}>{pillGlobal.label}</span>
              <span>·</span>
              <span>
                Última actualización:{" "}
                {data.ultimaCapturaEn
                  ? `hace ${tiempoRelativo(data.ultimaCapturaEn)} (${fechaCorta(data.ultimaCapturaEn)})`
                  : "nunca"}
              </span>
              {stale > 0 ? <span>· {stale} STALE</span> : null}
              {errores > 0 ? <span>· {errores} con error</span> : null}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <RefreshPartidoBtn partidoId={partidoId} />
          <ReDiscoveryBtn partidoId={partidoId} />
          <a
            href={
              verAlertas
                ? `/admin/partidos/${partidoId}`
                : `/admin/partidos/${partidoId}?alertas=1`
            }
            className="btn btn-ghost btn-xs"
          >
            {verAlertas
              ? "Ocultar alertas"
              : `Ver alertas (${data.alertasNoVistas})`}
          </a>
        </div>
      </div>

      <div className="cuotas-tabla-wrap">
        <table className="cuotas-tabla">
          <thead>
            <tr>
              <th>Casa</th>
              <th>Estado</th>
              <th>Última</th>
              <th>1X2</th>
              <th>Doble Op</th>
              <th>±2.5</th>
              <th>BTTS</th>
              <th>Event ID</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.filas.map((fila) => (
              <FilaCasa key={fila.casa} fila={fila} partidoId={partidoId} />
            ))}
          </tbody>
        </table>
      </div>

      {verAlertas ? (
        <AlertasSection
          partidoId={partidoId}
          soloNoVistas={searchParams?.noVistas !== "0"}
        />
      ) : null}
    </section>
  );
}
