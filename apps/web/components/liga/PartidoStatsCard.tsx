// PartidoStatsCard — Lote T v3.2 (May 2026): port literal 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-detail (líneas 3599-3638).
//
// Estructura del mockup:
//   .section-bar (📊 + "Datos del partido" + "Actualizados en tiempo real")
//   .card (padding:18px; margin-bottom:14px)
//     .stat-bar-row x4 — Posesión, Tiros al arco, Córners, Tarjetas amarillas
//
// Cada .stat-bar-row contiene:
//   .stat-bar-label  → tres spans: valor local · nombre · valor visita
//   .stat-bar-track  → dos divs (.stat-bar-local + .stat-bar-visita)
//
// El servicio de stats live no existe hoy (los datos vendrían de
// EstadisticasPartidoLado en eventos.mapper.ts). Esta vista renderiza solo
// si la página le pasa `stats` no nulas. Hasta que el servicio exista, la
// página /liga/[slug] no la renderiza.

interface StatsLado {
  posesion: number | null; // 0-100
  tiros: number | null;
  corners: number | null;
  tarjetasAmarillas: number | null;
}

interface Props {
  local: StatsLado;
  visita: StatsLado;
}

export function PartidoStatsCard({ local, visita }: Props) {
  return (
    <>
      <div className="section-bar">
        <div className="section-bar-left">
          <div className="section-bar-icon">📊</div>
          <div>
            <div className="section-bar-title">Datos del partido</div>
            <div className="section-bar-subtitle">
              Actualizados en tiempo real
            </div>
          </div>
        </div>
      </div>
      <div
        className="card partido-stats-card"
        style={{ padding: 18, marginBottom: 14 }}
      >
        <Barra
          nombre="Posesión"
          valLocal={local.posesion}
          valVisita={visita.posesion}
          esPct
        />
        <Barra
          nombre="Tiros al arco"
          valLocal={local.tiros}
          valVisita={visita.tiros}
        />
        <Barra
          nombre="Córners"
          valLocal={local.corners}
          valVisita={visita.corners}
        />
        <Barra
          nombre="Tarjetas amarillas"
          valLocal={local.tarjetasAmarillas}
          valVisita={visita.tarjetasAmarillas}
        />
      </div>
    </>
  );
}

function Barra({
  nombre,
  valLocal,
  valVisita,
  esPct = false,
}: {
  nombre: string;
  valLocal: number | null;
  valVisita: number | null;
  esPct?: boolean;
}) {
  const total = (valLocal ?? 0) + (valVisita ?? 0);
  const pctLocal = esPct
    ? valLocal ?? 50
    : total > 0
      ? Math.round(((valLocal ?? 0) / total) * 100)
      : 50;
  const pctVisita = 100 - pctLocal;
  const sufijo = esPct ? "%" : "";
  return (
    <div className="stat-bar-row">
      <div className="stat-bar-label">
        <span>
          {valLocal !== null ? `${valLocal}${sufijo}` : "—"}
        </span>
        <span className="stat-bar-label-name">{nombre}</span>
        <span>
          {valVisita !== null ? `${valVisita}${sufijo}` : "—"}
        </span>
      </div>
      <div className="stat-bar-track">
        <div className="stat-bar-local" style={{ width: `${pctLocal}%` }} />
        <div className="stat-bar-visita" style={{ width: `${pctVisita}%` }} />
      </div>
    </div>
  );
}
