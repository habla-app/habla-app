// CapturaCuotasSection — Lote V fase V.5.
//
// Sección server-rendered en /admin/partidos/[id] con los 7 bloques de
// casa (uno por scraper) + header con estado global + botones de
// refresh global y "Ver alertas (N)".
//
// Cero clases Tailwind utility — usa clases nominadas del mockup
// (`adm-pill`, `card`, `section-bar`, `btn`, etc) y CSS específico del
// Lote V que vive en mockup-styles.css (`.cuotas-casa-card`,
// `.cuotas-mercado-row`, `.cuotas-mercado-cuota`, etc).

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
  if (diffMin < 1) return "hace <1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
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
  signo: "=" | "↑" | "↓";
  texto: string;
  className: string;
} {
  if (actual === null || anterior === null || anterior === 0) {
    return { signo: "=", texto: "(=)", className: "cuota-var-flat" };
  }
  const pct = ((actual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.5)
    return { signo: "=", texto: "(=)", className: "cuota-var-flat" };
  if (pct > 0)
    return {
      signo: "↑",
      texto: `(↑${Math.abs(pct).toFixed(1)}%)`,
      className: "cuota-var-up",
    };
  return {
    signo: "↓",
    texto: `(↓${Math.abs(pct).toFixed(1)}%)`,
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

function CuotaConVar({
  label,
  actual,
  anterior,
}: {
  label: string;
  actual: number | null;
  anterior: number | null;
}) {
  const v = variacion(actual, anterior);
  return (
    <span className="cuotas-mercado-cuota">
      <span className="cuotas-mercado-label">{label}</span>{" "}
      <span className="cuotas-mercado-valor">{fmtCuota(actual)}</span>{" "}
      <span className={v.className}>{v.texto}</span>
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
  const tiempo =
    fila.estado === "STALE" && fila.ultimoExito
      ? `último éxito ${tiempoRelativo(fila.ultimoExito)}`
      : fila.estado === "OK" && fila.capturadoEn
        ? tiempoRelativo(fila.capturadoEn)
        : fila.ultimoIntento
          ? tiempoRelativo(fila.ultimoIntento)
          : "nunca";

  return (
    <div className="cuotas-casa-card">
      <div className="cuotas-casa-card-head">
        <div className="cuotas-casa-card-title">
          {ETIQUETAS_CASA[fila.casa]}
        </div>
        <span className={pill.cls}>{pill.label}</span>
        <span className="cuotas-casa-card-time">· {tiempo}</span>
        <div className="cuotas-casa-card-actions">
          <RefreshCasaBtn
            partidoId={partidoId}
            casa={fila.casa}
            disabled={!fila.eventIdExterno}
          />
        </div>
      </div>

      {fila.estado === "ERROR" && fila.errorMensaje ? (
        <div className="cuotas-casa-card-error">
          {fila.intentosFallidos > 0
            ? `${fila.intentosFallidos} intentos fallidos · `
            : ""}
          {fila.errorMensaje}
        </div>
      ) : null}

      {fila.eventIdExterno ? (
        <div className="cuotas-mercado-row">
          <CuotaConVar
            label="Local"
            actual={fila.cuotaLocal}
            anterior={fila.cuotaLocalAnterior}
          />
          <span className="cuota-sep" aria-hidden="true">
            ·
          </span>
          <CuotaConVar
            label="Emp"
            actual={fila.cuotaEmpate}
            anterior={fila.cuotaEmpateAnterior}
          />
          <span className="cuota-sep" aria-hidden="true">
            ·
          </span>
          <CuotaConVar
            label="Vis"
            actual={fila.cuotaVisita}
            anterior={fila.cuotaVisitaAnterior}
          />
        </div>
      ) : null}

      {fila.eventIdExterno ? (
        <div className="cuotas-mercado-row">
          <CuotaConVar
            label="1X"
            actual={fila.cuota1X}
            anterior={fila.cuota1XAnterior}
          />
          <span className="cuota-sep" aria-hidden="true">
            ·
          </span>
          <CuotaConVar
            label="12"
            actual={fila.cuota12}
            anterior={fila.cuota12Anterior}
          />
          <span className="cuota-sep" aria-hidden="true">
            ·
          </span>
          <CuotaConVar
            label="X2"
            actual={fila.cuotaX2}
            anterior={fila.cuotaX2Anterior}
          />
        </div>
      ) : null}

      {fila.eventIdExterno ? (
        <div className="cuotas-mercado-row">
          <CuotaConVar
            label="Over 2.5"
            actual={fila.cuotaOver25}
            anterior={fila.cuotaOver25Anterior}
          />
          <span className="cuota-sep" aria-hidden="true">
            ·
          </span>
          <CuotaConVar
            label="Under 2.5"
            actual={fila.cuotaUnder25}
            anterior={fila.cuotaUnder25Anterior}
          />
        </div>
      ) : null}

      {fila.eventIdExterno ? (
        <div className="cuotas-mercado-row">
          <CuotaConVar
            label="BTTS Sí"
            actual={fila.cuotaBttsSi}
            anterior={fila.cuotaBttsSiAnterior}
          />
          <span className="cuota-sep" aria-hidden="true">
            ·
          </span>
          <CuotaConVar
            label="BTTS No"
            actual={fila.cuotaBttsNo}
            anterior={fila.cuotaBttsNoAnterior}
          />
        </div>
      ) : null}

      <div className="cuotas-casa-card-event">
        Event ID externo:{" "}
        {fila.eventIdExterno ? (
          <>
            <code className="cuotas-casa-card-event-id">
              {fila.eventIdExterno}
            </code>{" "}
            <span
              className={`adm-pill adm-pill-${fila.metodoDiscovery === "MANUAL" ? "amber" : "blue"}`}
              style={{ fontSize: 9 }}
            >
              {fila.metodoDiscovery === "MANUAL" ? "manual" : "auto"}
            </span>{" "}
            <VincularEventIdModal
              partidoId={partidoId}
              casa={fila.casa}
              casaLabel={ETIQUETAS_CASA[fila.casa]}
              eventIdActual={fila.eventIdExterno}
              triggerLabel="editar"
            />
          </>
        ) : (
          <>
            <span style={{ color: "var(--text-muted-d)" }}>
              sin asignar
            </span>{" "}
            <VincularEventIdModal
              partidoId={partidoId}
              casa={fila.casa}
              casaLabel={ETIQUETAS_CASA[fila.casa]}
            />
          </>
        )}
      </div>
    </div>
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
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--text-dark)", textTransform: "uppercase", marginBottom: 8 }}>
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
      ? { cls: "adm-pill adm-pill-green", label: `🟢 COMPLETA (${completas}/${total})` }
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
              }}
            >
              <span className={pillGlobal.cls}>{pillGlobal.label}</span>
              <span>·</span>
              <span>
                Última actualización:{" "}
                {data.ultimaCapturaEn
                  ? `${tiempoRelativo(data.ultimaCapturaEn)} (${fechaCorta(data.ultimaCapturaEn)})`
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
            {verAlertas ? "Ocultar alertas" : `Ver alertas (${data.alertasNoVistas})`}
          </a>
        </div>
      </div>

      <div className="cuotas-casa-grid">
        {data.filas.map((fila) => (
          <FilaCasa key={fila.casa} fila={fila} partidoId={partidoId} />
        ))}
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
