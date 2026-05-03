// FijasList — Lote T v3.2 (May 2026): port literal 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-list (líneas 2574-2765).
//
// Estructura del mockup:
//   <table class="fijas-list-table">…</table>
//   <div class="fijas-list-mobile">…</div>
//
// La visibilidad de cada uno es responsabilidad del CSS (mockup-styles.css):
// `.fijas-list-table { display: none }` en mobile, `.fijas-list-mobile { display: none }`
// en desktop. Cero clases Tailwind utility en este componente.
//
// Mobile (≤767px): cards `.fija-card` con `.fija-card-cuotas` mini-grid.
// Desktop (≥768px): tabla densa `.fijas-list-table` con 9 columnas.

import Link from "next/link";
import type { FijaListItem } from "@/lib/services/las-fijas.service";

interface Props {
  partidos: FijaListItem[];
}

export function FijasList({ partidos }: Props) {
  if (partidos.length === 0) {
    return <FijasEmpty />;
  }
  return (
    <>
      <FijasTableDesktop partidos={partidos} />
      <FijasCardsMobile partidos={partidos} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Desktop tabla (mockup line 2574-2674)
// ---------------------------------------------------------------------------

function FijasTableDesktop({ partidos }: Props) {
  return (
    <table className="fijas-list-table">
      <thead>
        <tr>
          <th>Liga · Hora</th>
          <th>Partido</th>
          <th className="center" colSpan={3}>
            1X2
          </th>
          <th className="center">±2.5</th>
          <th className="center">BTTS</th>
          <th>Mejor cuota</th>
          <th></th>
        </tr>
        <tr>
          <th></th>
          <th></th>
          <th className="center">Local</th>
          <th className="center">Empate</th>
          <th className="center">Visita</th>
          <th className="center">Más / Menos</th>
          <th className="center">Sí / No</th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {partidos.map((p) => (
          <FilaTabla key={p.id} partido={p} />
        ))}
      </tbody>
    </table>
  );
}

function FilaTabla({ partido }: { partido: FijaListItem }) {
  const enVivo = partido.estado === "EN_VIVO";
  const horaTexto = formatHora(partido.fechaInicio, partido.estado, partido.liveElapsed);
  const cuotas = derivarCuotas(partido);
  const ligaShort = formatLigaCorta(partido.liga);
  const navHref = `/las-fijas/${partido.slug}`;

  return (
    <tr className="fijas-row">
      <td>
        <div className="cell-liga">
          {enVivo ? <span className="live-dot" /> : null}
          {ligaShort}
        </div>
        <div
          className="cell-hora"
          style={enVivo ? { color: "var(--live)" } : undefined}
        >
          {horaTexto}
        </div>
      </td>
      <td>
        <div className="cell-equipos">
          {partido.equipoLocal} <span className="vs">vs</span>{" "}
          {partido.equipoVisita}
        </div>
      </td>
      <td className="center">
        <CuotaCell value={cuotas.local} best={cuotas.bestKey === "local"} />
      </td>
      <td className="center">
        <CuotaCell value={cuotas.empate} best={cuotas.bestKey === "empate"} />
      </td>
      <td className="center">
        <CuotaCell value={cuotas.visita} best={cuotas.bestKey === "visita"} />
      </td>
      <td className="center">
        <CuotaCell value={cuotas.over25} />
        <span className="cuota-sep"> / </span>
        <CuotaCell value={cuotas.under25} />
      </td>
      <td className="center">
        <CuotaCell value={cuotas.bttsSi} />
        <span className="cuota-sep"> / </span>
        <CuotaCell value={cuotas.bttsNo} />
      </td>
      <td>
        <div className="cell-casa">
          <div
            className="casa-mini-logo"
            style={cuotas.bestCasaColor ? { background: cuotas.bestCasaColor } : undefined}
          >
            {cuotas.bestCasaSigla}
          </div>
          {cuotas.bestCasaNombre}
        </div>
      </td>
      <td>
        <Link
          href={navHref}
          className="cta-fila"
          style={enVivo ? { color: "var(--live)" } : undefined}
        >
          {enVivo ? "EN VIVO" : "Análisis"}
        </Link>
      </td>
    </tr>
  );
}

function CuotaCell({ value, best = false }: { value: string; best?: boolean }) {
  return <span className={`cuota-cell${best ? " best" : ""}`}>{value}</span>;
}

// ---------------------------------------------------------------------------
// Mobile cards (mockup line 2677-2765)
// ---------------------------------------------------------------------------

function FijasCardsMobile({ partidos }: Props) {
  return (
    <div className="fijas-list-mobile">
      {partidos.map((p) => (
        <FijaCard key={p.id} partido={p} />
      ))}
    </div>
  );
}

function FijaCard({ partido }: { partido: FijaListItem }) {
  const enVivo = partido.estado === "EN_VIVO";
  const horaTexto = formatHora(partido.fechaInicio, partido.estado, partido.liveElapsed);
  const cuotas = derivarCuotas(partido);
  const ligaShort = formatLigaCorta(partido.liga);
  const probPct =
    partido.probabilidadPronostico !== null
      ? Math.round(partido.probabilidadPronostico * 100)
      : null;
  const badgeLabel = badgePronostico(partido.pronostico1x2, probPct);

  return (
    <Link href={`/las-fijas/${partido.slug}`} className={`fija-card${enVivo ? " live" : ""}`}>
      <div className="fija-card-top">
        <div>
          <div className="fija-card-meta">
            {enVivo ? <span className="live-dot" /> : null}
            {ligaShort} · {horaTexto}
          </div>
          <div className="fija-card-equipos">
            {partido.equipoLocal} vs {partido.equipoVisita}
          </div>
        </div>
        {enVivo ? (
          <span className="badge badge-live">EN VIVO</span>
        ) : badgeLabel ? (
          <span className="badge badge-blue">{badgeLabel}</span>
        ) : null}
      </div>
      <div className="fija-card-cuotas">
        <div className="fija-mini-cuota">
          <div className="fija-mini-cuota-label">Local</div>
          <div className="fija-mini-cuota-val">{cuotas.local}</div>
        </div>
        <div className="fija-mini-cuota">
          <div className="fija-mini-cuota-label">Empate</div>
          <div className="fija-mini-cuota-val">{cuotas.empate}</div>
        </div>
        <div className="fija-mini-cuota">
          <div className="fija-mini-cuota-label">Visita</div>
          <div className="fija-mini-cuota-val">{cuotas.visita}</div>
        </div>
      </div>
      <div className="fija-card-bottom">
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <div
            className="casa-mini-logo"
            style={cuotas.bestCasaColor ? { background: cuotas.bestCasaColor } : undefined}
          >
            {cuotas.bestCasaSigla}
          </div>
          <span style={{ color: "var(--text-muted-d)" }}>
            mejor en {cuotas.bestCasaNombre}
          </span>
        </div>
        <span className="cta-fila" style={enVivo ? { color: "var(--live)" } : undefined}>
          {enVivo ? "EN VIVO" : "Análisis"}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

function badgePronostico(
  pron: "LOCAL" | "EMPATE" | "VISITA" | null,
  probPct: number | null,
): string | null {
  if (!pron || probPct === null) return null;
  const label = pron === "LOCAL" ? "Local" : pron === "EMPATE" ? "Empate" : "Visita";
  return `${label} ${probPct}%`;
}

function formatHora(
  fecha: Date,
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO",
  liveElapsed: number | null,
): string {
  if (estado === "EN_VIVO") {
    return liveElapsed !== null ? `${liveElapsed}'` : "EN VIVO";
  }
  // Hoy/Mañana/etc relativo a hora Lima.
  const ahoraLima = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Lima" }),
  );
  const fechaLima = new Date(
    fecha.toLocaleString("en-US", { timeZone: "America/Lima" }),
  );
  const hoy = ahoraLima.toDateString();
  const manana = new Date(ahoraLima.getTime() + 24 * 60 * 60 * 1000).toDateString();
  const hora = fecha.toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (fechaLima.toDateString() === hoy) return `Hoy ${hora}`;
  if (fechaLima.toDateString() === manana) return `Mañana ${hora}`;
  return fecha.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLigaCorta(liga: string): string {
  // Heurística simple para pegar emoji + nombre corto (mockup: "🏆 Premier",
  // "🇵🇪 Liga 1"). Si la liga ya tiene emoji al inicio se respeta.
  const lower = liga.toLowerCase();
  if (lower.includes("liga 1") || lower.includes("perú")) return `🇵🇪 ${liga}`;
  return `🏆 ${liga}`;
}

// ---------------------------------------------------------------------------
// Derivar cuotas para la fila/card:
//   - Si el partido tiene `cuotasSnapshot` (lo trae el análisis aprobado vía
//     `inputsJSON.cuotasReferenciales`), usamos esos valores.
//   - Si no hay snapshot, "—" placeholder en todas las celdas.
//   - La columna "best" se resalta en la cuota del pronóstico Habla! (1X2).
// ---------------------------------------------------------------------------

interface Cuotas {
  local: string;
  empate: string;
  visita: string;
  over25: string;
  under25: string;
  bttsSi: string;
  bttsNo: string;
  bestKey: "local" | "empate" | "visita" | null;
  bestCasaSigla: string;
  bestCasaNombre: string;
  bestCasaColor: string | null;
}

function fmt(n: number | null): string {
  return n !== null ? n.toFixed(2) : "—";
}

function derivarCuotas(partido: FijaListItem): Cuotas {
  const pron = partido.pronostico1x2;
  const snap = partido.cuotasSnapshot;
  const bestKey =
    pron === "LOCAL"
      ? "local"
      : pron === "EMPATE"
        ? "empate"
        : pron === "VISITA"
          ? "visita"
          : null;

  return {
    local: fmt(snap?.local ?? null),
    empate: fmt(snap?.empate ?? null),
    visita: fmt(snap?.visita ?? null),
    over25: fmt(snap?.over25 ?? null),
    under25: fmt(snap?.under25 ?? null),
    bttsSi: fmt(snap?.bttsSi ?? null),
    bttsNo: fmt(snap?.bttsNo ?? null),
    bestKey,
    bestCasaSigla: snap?.bestSigla ?? "—",
    bestCasaNombre: snap?.bestCasa ?? "—",
    bestCasaColor: snap?.bestColor ?? null,
  };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function FijasEmpty() {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio-icono">🌙</div>
      <h2 className="estado-vacio-titulo">Hoy no hay fijas cubiertas</h2>
      <p className="estado-vacio-desc">
        Estamos esperando que arranquen las próximas fechas de las ligas
        cubiertas. Mientras tanto, mirá quiénes están peleando el ranking del
        mes en la Liga Habla!.
      </p>
      <div className="estado-vacio-ctas">
        <Link href="/liga" className="btn btn-primary">
          Ver el ranking del mes →
        </Link>
      </div>
    </div>
  );
}
