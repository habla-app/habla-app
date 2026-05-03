// RankingMensualTabla — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-list (.ranking-table del mes,
// líneas 3130-3294).
//
// Estructura del mockup:
//   table.ranking-table
//     thead: Pos · Tipster · Predicciones · % acierto · Δ semana · Puntos
//     tbody: filas Top 10 + corte ("posiciones X-Y ocultas") + tr.me-row si
//            el usuario actual está fuera del Top.
//
// Algunos campos (predicciones / % acierto / Δ semana) no viven en el modelo
// actual — los renderizamos como "—" para mantener fidelidad estructural.

import Link from "next/link";

interface Fila {
  posicion: number;
  userId: string;
  username: string;
  puntos: number;
  /** Total de predicciones jugadas este mes (opcional). */
  jugados?: number | null;
  /** Aciertos / total — solo si los tenemos. */
  aciertosNum?: number | null;
  /** % acierto. */
  pctAcierto?: number | null;
  /** Δ puntos semana. */
  delta?: number | null;
  /** Ciudad opcional. */
  ciudad?: string | null;
}

interface Props {
  filas: Fila[];
  miUserId: string | null;
  /** Si el usuario actual no está en el top mostrado, su fila aparte. */
  miFilaFueraDelTop?: Fila | null;
}

const TOP_VISIBLE = 10;

export function RankingMensualTabla({ filas, miUserId, miFilaFueraDelTop }: Props) {
  if (filas.length === 0) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏁</div>
        <p
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text-dark)",
            textTransform: "uppercase",
          }}
        >
          Aún no hay actividad este mes
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted-d)", marginTop: 8 }}>
          Apenas finalice el primer torneo, los puntos empiezan a contar.
        </p>
      </div>
    );
  }

  const top = filas.slice(0, TOP_VISIBLE);
  const ocultasDesde = TOP_VISIBLE + 1;
  const hayMas = filas.length > TOP_VISIBLE;
  const miFila =
    miFilaFueraDelTop ??
    (miUserId ? filas.find((f) => f.userId === miUserId && f.posicion > TOP_VISIBLE) : null) ??
    null;

  return (
    <table className="ranking-table" style={{ marginBottom: 24 }}>
      <thead>
        <tr>
          <th style={{ width: 50 }}>Pos</th>
          <th>Tipster</th>
          <th className="center">Predicciones</th>
          <th className="center">% acierto</th>
          <th className="center">Δ semana</th>
          <th className="center">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {top.map((f) => (
          <FilaTipster key={f.userId} fila={f} esMe={f.userId === miUserId} />
        ))}

        {hayMas ? (
          <tr>
            <td
              colSpan={6}
              style={{
                textAlign: "center",
                color: "var(--text-muted-d)",
                fontSize: 11,
                padding: 10,
                background: "var(--bg-subtle)",
              }}
            >
              ↓ posiciones {ocultasDesde}-{filas.length} ocultas ↓
            </td>
          </tr>
        ) : null}

        {miFila ? <FilaTipster fila={miFila} esMe={true} /> : null}
      </tbody>
    </table>
  );
}

function FilaTipster({ fila, esMe }: { fila: Fila; esMe: boolean }) {
  const posCls =
    fila.posicion === 1 ? "rank-pos gold" : esMe ? "rank-pos blue" : "rank-pos";
  const aciertoColor =
    fila.pctAcierto !== null && fila.pctAcierto !== undefined
      ? fila.pctAcierto >= 55
        ? "var(--green)"
        : "var(--orange)"
      : "var(--text-muted-d)";

  return (
    <tr className={esMe ? "me-row" : undefined}>
      <td>
        <div className={posCls}>{fila.posicion}°</div>
      </td>
      <td>
        <Link href={`/jugador/${fila.username}`} style={{ color: "inherit" }}>
          <div className="rank-username">{esMe ? "@yo (tú)" : `@${fila.username}`}</div>
          <div className={`rank-meta${esMe ? " blue" : ""}`}>
            {esMe
              ? `Tu posición${fila.jugados !== null && fila.jugados !== undefined ? ` · ${fila.jugados} partidos` : ""}`
              : `${fila.ciudad ? `${fila.ciudad}` : ""}${fila.jugados !== null && fila.jugados !== undefined ? ` · ${fila.jugados} partidos` : ""}`}
          </div>
        </Link>
      </td>
      <td className="center">
        {fila.aciertosNum !== null && fila.aciertosNum !== undefined && fila.jugados
          ? `${fila.aciertosNum} / ${fila.jugados}`
          : "—"}
      </td>
      <td className="center">
        {fila.pctAcierto !== null && fila.pctAcierto !== undefined ? (
          <span style={{ color: aciertoColor, fontWeight: 700 }}>
            {fila.pctAcierto}%
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="center">
        {fila.delta !== null && fila.delta !== undefined ? (
          <span
            style={{
              color: fila.delta > 0 ? "var(--green)" : "var(--orange)",
              fontWeight: 700,
            }}
          >
            {fila.delta > 0 ? "+" : ""}
            {fila.delta}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="center">
        <span className="rank-pts">{fila.puntos}</span>
      </td>
    </tr>
  );
}
