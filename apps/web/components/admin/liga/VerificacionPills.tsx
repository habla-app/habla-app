// VerificacionPills — Lote O (May 2026): pills server component para los
// flags de cada fila Top 10 + el estado final. Renderiza HTML literal del
// mockup con clases adm-pill / adm-pill-green / adm-pill-amber /
// adm-pill-red (definidas en mockup-styles.css desde Lote R).

interface TopFlagPillProps {
  flag: "ok" | "amber" | "rojo";
  labelOk: string;
  labelAmber: string;
  labelRed: string;
}

export function TopFlagPill({ flag, labelOk, labelAmber, labelRed }: TopFlagPillProps) {
  if (flag === "ok") return <span className="adm-pill adm-pill-green">{labelOk}</span>;
  if (flag === "rojo") return <span className="adm-pill adm-pill-red">{labelRed}</span>;
  return <span className="adm-pill adm-pill-amber">{labelAmber}</span>;
}

interface EstadoFinalPillProps {
  estado: "Listo" | "Bloqueante" | "Falta DNI" | "Pendiente";
}

export function EstadoFinalPill({ estado }: EstadoFinalPillProps) {
  if (estado === "Listo") return <span className="adm-pill adm-pill-green">Listo</span>;
  if (estado === "Bloqueante") return <span className="adm-pill adm-pill-red">⚠ Bloqueante</span>;
  if (estado === "Falta DNI") return <span className="adm-pill adm-pill-amber">Falta DNI</span>;
  return <span className="adm-pill adm-pill-amber">Pendiente</span>;
}
