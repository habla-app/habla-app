// LigaHero — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-list (.liga-hero, líneas 3057-3079).

import Link from "next/link";

interface Props {
  nombreMes: string;
  totalTipsters: number;
  premioPrimerPuesto: number;
  diasAlCierre: number;
}

export function LigaHero({
  nombreMes,
  totalTipsters,
  premioPrimerPuesto,
  diasAlCierre,
}: Props) {
  return (
    <div className="liga-hero">
      <div className="liga-hero-eyebrow">🏆 Liga Habla! · {nombreMes}</div>
      <h1>
        Compite gratis<br />por S/ 1,250
      </h1>
      <p className="liga-hero-desc">
        Armá tu combinada de 5 predicciones por cada partido. Editala cuantas
        veces quieras hasta el kickoff. Top 10 del mes cobra en efectivo.
      </p>
      <div className="liga-hero-stats">
        <div className="liga-hero-stat">
          <div className="liga-hero-stat-val">{totalTipsters.toLocaleString("es-PE")}</div>
          <div className="liga-hero-stat-lbl">Tipsters</div>
        </div>
        <div className="liga-hero-stat">
          <div className="liga-hero-stat-val">S/{premioPrimerPuesto}</div>
          <div className="liga-hero-stat-lbl">Premio 1°</div>
        </div>
        <div className="liga-hero-stat">
          <div className="liga-hero-stat-val">{diasAlCierre}</div>
          <div className="liga-hero-stat-lbl">Días al cierre</div>
        </div>
      </div>
      <Link href="/liga#proximos" className="btn btn-primary">
        Hacer mi primera predicción →
      </Link>
    </div>
  );
}
