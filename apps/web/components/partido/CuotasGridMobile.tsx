// CuotasGridMobile — variante mobile-first del comparador de cuotas.
// Lote B v3.1. Spec:
// docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// A diferencia del CuotasGrid del Lote 9 (grid de 2-3 columnas con CTA
// directo en cada celda), esta versión mobile-first usa filas verticales
// con una columna por outcome (1 / X / 2) + columna casa + botón flecha.
//
// La fila con la mejor cuota (cualquier outcome con mayor odd) lleva
// `bg-gold-dim` con borde dorado + badge "★ MEJOR" flotante.
//
// Mobile-first riguroso: row clickeable de altura ≥56px, números grandes
// con tabular-nums para alineación, cero hex hardcodeados.

import type {
  OddsCacheEntry,
  OddsOutcome,
} from "@/lib/services/odds-cache.service";
import { Badge } from "@/components/ui";

interface Props {
  partidoId: string;
  data: OddsCacheEntry;
  /** Cuando se renderiza desde /cuotas (listing), mostrar header
   *  "Cuotas comparadas" + footer disclaimer. Cuando se renderiza desde
   *  /partidos/[slug], el header lo provee la sección padre. */
  conHeader?: boolean;
}

export function CuotasGridMobile({ partidoId, data, conHeader = true }: Props) {
  const { mercados, actualizadoEn } = data;
  if (estaVacio(data)) return <EstadoVacio />;

  // Para el comparador resumido extraemos: 1 / X / 2 con la mejor casa
  // por outcome + flag "es la mejor cuota global del trío".
  const filas = construirFilasComparador(mercados);

  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas mobile"
      className="my-4 overflow-hidden rounded-md border border-light bg-card shadow-sm"
    >
      {conHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-light bg-subtle px-4 py-3">
          <span className="font-display text-label-md text-brand-blue-main">
            📊 Cuotas comparadas
          </span>
          <span className="rounded-sm bg-card px-2 py-0.5 text-body-xs font-bold text-muted-d">
            {formatTiempoRelativo(actualizadoEn)}
          </span>
        </header>
      ) : null}

      <div className="divide-y divide-light">
        {filas.map((fila) => (
          <FilaCuota
            key={`${fila.casa}-${fila.outcomeKey}`}
            fila={fila}
            partidoId={partidoId}
          />
        ))}
      </div>

      {conHeader ? (
        <p className="border-t border-light bg-subtle/50 px-4 py-3 text-body-xs leading-[1.5] text-muted-d">
          Cuotas referenciales · sólo casas autorizadas MINCETUR.
        </p>
      ) : null}
    </aside>
  );
}

interface Fila {
  casa: string;
  casaNombre: string;
  outcomeKey: "1" | "X" | "2" | "over" | "under" | "btts-si" | "btts-no";
  label: string;
  cuota: number;
  esMejor: boolean;
}

function FilaCuota({
  fila,
  partidoId,
}: {
  fila: Fila;
  partidoId: string;
}) {
  const utm = new URLSearchParams({
    utm_source: "partido",
    utm_medium: "comparador",
    partidoId,
    outcome: fila.outcomeKey,
  }).toString();
  const href = `/go/${fila.casa}?${utm}`;

  return (
    <a
      href={href}
      rel="sponsored noopener"
      className={`touch-target flex min-h-[56px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hover ${
        fila.esMejor ? "bg-gold-dim" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-display-sm uppercase tracking-[0.04em] text-dark">
          {fila.label}
        </span>
        {fila.esMejor ? (
          <Badge variant="gold" size="sm">
            ★ MEJOR
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-num-md tabular-nums text-dark">
            {fila.cuota.toFixed(2)}
          </p>
          <p className="text-body-xs uppercase text-muted-d">{fila.casaNombre}</p>
        </div>
        <span
          aria-hidden
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-gold text-black shadow-gold-btn"
        >
          →
        </span>
      </div>
    </a>
  );
}

function construirFilasComparador(
  mercados: OddsCacheEntry["mercados"],
): Fila[] {
  const filas: Fila[] = [];

  function push(
    outcome: OddsOutcome | null,
    key: Fila["outcomeKey"],
    label: string,
  ) {
    if (!outcome) return;
    filas.push({
      casa: outcome.casa,
      casaNombre: outcome.casaNombre,
      outcomeKey: key,
      label,
      cuota: outcome.odd,
      esMejor: false,
    });
  }

  push(mercados["1X2"].local, "1", "Local · 1");
  push(mercados["1X2"].empate, "X", "Empate · X");
  push(mercados["1X2"].visita, "2", "Visita · 2");
  push(mercados["+2.5"].over, "over", "+2.5 goles");
  push(mercados["+2.5"].under, "under", "−2.5 goles");
  push(mercados.BTTS.si, "btts-si", "BTTS Sí");
  push(mercados.BTTS.no, "btts-no", "BTTS No");

  // Marcar las mejores cuotas por trío (1X2). Las del 1X2 son las que
  // tienen badge dorado destacado en mobile.
  const grupo1x2 = filas.filter((f) =>
    ["1", "X", "2"].includes(f.outcomeKey),
  );
  if (grupo1x2.length > 0) {
    const max = Math.max(...grupo1x2.map((f) => f.cuota));
    const mejor = grupo1x2.find((f) => f.cuota === max);
    if (mejor) mejor.esMejor = true;
  }

  return filas;
}

function estaVacio(data: OddsCacheEntry): boolean {
  const m = data.mercados;
  return (
    !m["1X2"].local &&
    !m["1X2"].empate &&
    !m["1X2"].visita &&
    !m.BTTS.si &&
    !m.BTTS.no &&
    !m["+2.5"].over &&
    !m["+2.5"].under
  );
}

function EstadoVacio() {
  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas"
      className="my-4 overflow-hidden rounded-md border border-light bg-card shadow-sm"
    >
      <div className="px-4 py-7 text-center">
        <p className="font-display text-display-sm text-dark">
          Sin cuotas disponibles aún
        </p>
        <p className="mx-auto mt-2 max-w-[420px] text-body-sm leading-[1.55] text-muted-d">
          Las casas autorizadas MINCETUR aún no publican cuotas para este
          partido.
        </p>
        <a
          href="/casas"
          className="touch-target mt-4 inline-flex items-center gap-1.5 rounded-sm border border-light bg-card px-4 py-2 text-body-sm font-bold text-dark transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Ver casas autorizadas →
        </a>
      </div>
    </aside>
  );
}

function formatTiempoRelativo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "hace un momento";
  const diffMin = Math.floor((Date.now() - t) / 60_000);
  if (diffMin < 1) return "hace <1 min";
  if (diffMin < 60) return `hace ${diffMin}min`;
  return `hace ${Math.floor(diffMin / 60)}h`;
}
