// PremiosGrid — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-list (.premios-grid, líneas 3105-3116).
//
// 10 celdas con fondo según ranking: gold (1°), silver (2°-3°), neutral (4-10°).

import {
  premioParaPosicion,
  TOTAL_PREMIO_MENSUAL,
} from "@/lib/services/leaderboard.service";

export function PremiosGrid() {
  const POSICIONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <>
      <div className="section-bar" style={{ marginTop: 24 }}>
        <div className="section-bar-left">
          <div className="section-bar-icon">💰</div>
          <div>
            <div className="section-bar-title">Reparto de premios · Top 10</div>
            <div className="section-bar-subtitle">
              S/ {TOTAL_PREMIO_MENSUAL.toLocaleString("es-PE")} totales cada mes
            </div>
          </div>
        </div>
      </div>
      <div className="premios-grid">
        {POSICIONES.map((pos) => {
          const monto = premioParaPosicion(pos);
          const cls =
            pos === 1 ? "premio-cell gold" : pos <= 3 ? "premio-cell silver" : "premio-cell";
          return (
            <div key={pos} className={cls}>
              <div className="premio-pos">{pos}°</div>
              <div className="premio-monto">S/{monto}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
