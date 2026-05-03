// ComparadorTabla — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail (.comparador-table).
//
// Tabla con cuotas de las 5 casas autorizadas MINCETUR (Betano, Betsson,
// Coolbet, Doradobet, 1xBet) en mercados Local/Empate/Visita/+2.5/BTTS Sí.
// La celda con la mejor cuota por columna se resalta con .best-cuota.

interface FilaCuotas {
  casa: string;
  sigla: string;
  color: string;
  local: number | null;
  empate: number | null;
  visita: number | null;
  over25: number | null;
  bttsSi: number | null;
}

interface Props {
  filas: FilaCuotas[];
}

export function ComparadorTabla({ filas }: Props) {
  const bestLocal = bestPorColumna(filas, "local");
  const bestEmpate = bestPorColumna(filas, "empate");
  const bestVisita = bestPorColumna(filas, "visita");
  const bestOver25 = bestPorColumna(filas, "over25");
  const bestBttsSi = bestPorColumna(filas, "bttsSi");

  return (
    <>
      <div className="section-bar" style={{ marginTop: 24 }}>
        <div className="section-bar-left">
          <div className="section-bar-icon">📊</div>
          <div>
            <div className="section-bar-title">Comparador completo</div>
            <div className="section-bar-subtitle">
              {filas.length} casas autorizadas · cuotas referenciales
            </div>
          </div>
        </div>
      </div>
      <table className="comparador-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Casa</th>
            <th>Local</th>
            <th>Empate</th>
            <th>Visita</th>
            <th>+2.5</th>
            <th>BTTS Sí</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.casa}>
              <td className="casa-name">
                <div className="casa-logo" style={{ background: f.color }}>
                  {f.sigla}
                </div>
                {f.casa}
              </td>
              <Cuota value={f.local} best={f.local === bestLocal} />
              <Cuota value={f.empate} best={f.empate === bestEmpate} />
              <Cuota value={f.visita} best={f.visita === bestVisita} />
              <Cuota value={f.over25} best={f.over25 === bestOver25} />
              <Cuota value={f.bttsSi} best={f.bttsSi === bestBttsSi} />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Cuota({ value, best }: { value: number | null; best: boolean }) {
  if (value === null) return <td>—</td>;
  return <td className={best ? "best-cuota" : undefined}>{value.toFixed(2)}</td>;
}

function bestPorColumna(
  filas: FilaCuotas[],
  campo: keyof Pick<FilaCuotas, "local" | "empate" | "visita" | "over25" | "bttsSi">,
): number | null {
  let max: number | null = null;
  for (const f of filas) {
    const v = f[campo];
    if (v === null) continue;
    if (max === null || v > max) max = v;
  }
  return max;
}
