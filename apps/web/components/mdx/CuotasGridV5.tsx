// CuotasGridV5 — Lote V fase V.5.
//
// Variante del CuotasGrid (Lote 9) que lee directo de la tabla `CuotasCasa`
// (motor de captura del Lote V). Renderiza las 7 casas peruanas con badges
// de "mejor cuota" por outcome + badge gris "datos desactualizados" cuando
// estado=STALE. CTA por casa apunta a `/go/[casa]?utm_*` (existente).
//
// El componente recibe un payload tipado y renderiza — la lectura BD vive
// en `CuotasComparator` (server component) o en cualquier otro caller.
//
// Sin "use client" — componente puro de presentación.

import type { CasaCuotas } from "@/lib/services/scrapers/types";

type EstadoCuotaVista = "OK" | "STALE";

interface MercadoLine {
  outcome: string;
  label: string;
  cuotas: Array<{ casa: CasaCuotas; casaLabel: string; valor: number; estado: EstadoCuotaVista }>;
}

export interface CuotasV5Payload {
  partidoId: string;
  actualizadoEn: Date | null;
  mercados: {
    "1X2": MercadoLine[];
    "doble_op": MercadoLine[];
    "mas_menos_25": MercadoLine[];
    "btts": MercadoLine[];
  };
}

const ETIQUETAS: Record<CasaCuotas, string> = {
  apuesta_total: "Apuesta Total",
  doradobet: "Doradobet",
  betano: "Betano",
  inkabet: "Inkabet",
  te_apuesto: "Te Apuesto",
};

interface Props {
  data: CuotasV5Payload;
}

function tiempoRelativo(d: Date | null): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "hace menos de 1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return `hace ${Math.floor(diffH / 24)} d`;
}

export function CuotasGridV5({ data }: Props) {
  const totalCuotas =
    data.mercados["1X2"].reduce((acc, l) => acc + l.cuotas.length, 0) +
    data.mercados["doble_op"].reduce((acc, l) => acc + l.cuotas.length, 0) +
    data.mercados["mas_menos_25"].reduce((acc, l) => acc + l.cuotas.length, 0) +
    data.mercados["btts"].reduce((acc, l) => acc + l.cuotas.length, 0);

  if (totalCuotas === 0) {
    return <EstadoVacio />;
  }

  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas"
      className="cuotas-comparator-v5"
    >
      <header className="cuotas-comparator-v5-head">
        <span className="cuotas-comparator-v5-title">📊 Cuotas comparadas</span>
        <span className="cuotas-comparator-v5-time">
          Actualizado {tiempoRelativo(data.actualizadoEn)}
        </span>
      </header>

      {data.mercados["1X2"].length > 0 ? (
        <Mercado titulo="Resultado (1X2)" lineas={data.mercados["1X2"]} partidoId={data.partidoId} />
      ) : null}

      {data.mercados["doble_op"].length > 0 ? (
        <Mercado titulo="Doble oportunidad" lineas={data.mercados["doble_op"]} partidoId={data.partidoId} />
      ) : null}

      {data.mercados["mas_menos_25"].length > 0 ? (
        <Mercado titulo="Más / Menos 2.5 goles" lineas={data.mercados["mas_menos_25"]} partidoId={data.partidoId} />
      ) : null}

      {data.mercados["btts"].length > 0 ? (
        <Mercado titulo="Ambos equipos anotan (BTTS)" lineas={data.mercados["btts"]} partidoId={data.partidoId} />
      ) : null}

      <p className="cuotas-comparator-v5-foot">
        Cuotas referenciales. La cuota final la confirma cada operador al
        momento de tu apuesta. Solo casas autorizadas por MINCETUR.
      </p>
    </aside>
  );
}

function Mercado({
  titulo,
  lineas,
  partidoId,
}: {
  titulo: string;
  lineas: MercadoLine[];
  partidoId: string;
}) {
  return (
    <section className="cuotas-comparator-v5-mercado">
      <h4 className="cuotas-comparator-v5-mercado-titulo">{titulo}</h4>
      <div className="cuotas-comparator-v5-grid">
        {lineas.map((linea) => {
          // Identificar mejor cuota (max value).
          const mejor = linea.cuotas.reduce(
            (acc, c) => (c.valor > acc ? c.valor : acc),
            0,
          );
          return (
            <div key={linea.outcome} className="cuotas-comparator-v5-linea">
              <div className="cuotas-comparator-v5-linea-titulo">
                {linea.label}
              </div>
              <div className="cuotas-comparator-v5-linea-cells">
                {linea.cuotas.map((c) => {
                  const esMejor = c.valor === mejor && c.valor > 0;
                  const esStale = c.estado === "STALE";
                  const utm = new URLSearchParams({
                    utm_source: "cuotas",
                    utm_medium: "comparador",
                    partidoId,
                    outcome: linea.outcome,
                  }).toString();
                  return (
                    <a
                      key={c.casa}
                      href={`/go/${c.casa}?${utm}`}
                      rel="sponsored noopener"
                      className={`cuotas-comparator-v5-cell${esMejor ? " best" : ""}${esStale ? " stale" : ""}`}
                    >
                      <span className="cuotas-comparator-v5-cell-casa">
                        {ETIQUETAS[c.casa] ?? c.casaLabel}
                      </span>
                      <span className="cuotas-comparator-v5-cell-valor">
                        {c.valor.toFixed(2)}
                      </span>
                      {esStale ? (
                        <span className="cuotas-comparator-v5-cell-stale">
                          desactualizada
                        </span>
                      ) : null}
                      {esMejor && !esStale ? (
                        <span className="cuotas-comparator-v5-cell-best">
                          ★ mejor
                        </span>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EstadoVacio() {
  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas"
      className="cuotas-comparator-v5"
    >
      <header className="cuotas-comparator-v5-head">
        <span className="cuotas-comparator-v5-title">📊 Cuotas comparadas</span>
      </header>
      <div className="cuotas-comparator-v5-empty">
        <p className="cuotas-comparator-v5-empty-title">
          No hay cuotas disponibles para este partido
        </p>
        <p className="cuotas-comparator-v5-empty-body">
          Ninguna de las casas autorizadas por MINCETUR tiene cuotas publicadas
          todavía. Mientras tanto, conocé las casas habilitadas.
        </p>
        <a href="/reviews-y-guias" className="cuotas-comparator-v5-empty-cta">
          Ver casas autorizadas →
        </a>
      </div>
    </aside>
  );
}
