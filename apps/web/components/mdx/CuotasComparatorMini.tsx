// CuotasComparatorMini — Lote 11.
//
// Variante compacta del CuotasComparator del Lote 9. Muestra SOLO el
// mercado 1X2 (sin BTTS ni +2.5) con 3 chips horizontales. Pensado para
// embedded en cards de la home, no para pages dedicadas.
//
// Si el cache es miss, devuelve null (no skeleton, no poller). Esto
// mantiene la home rápida y "sin huecos" — cuando el cron N (Lote 9)
// pueble la cache para el partido, las cuotas aparecen en el siguiente
// SSR. Si una casa no tiene cuota para algún outcome, esa chip queda
// con "—" pero la card no se rompe.

import type { OddsOutcome } from "@/lib/services/odds-cache.service";
import { obtenerOddsCacheadas } from "@/lib/services/odds-cache.service";

interface Props {
  partidoId: string;
}

export async function CuotasComparatorMini({ partidoId }: Props) {
  const cached = await obtenerOddsCacheadas(partidoId);
  if (!cached) return null;

  const { local, empate, visita } = cached.mercados["1X2"];
  const hayAlguna = !!(local || empate || visita);
  if (!hayAlguna) return null;

  return (
    <div
      role="note"
      aria-label="Cuotas resumen 1X2"
      className="grid grid-cols-3 gap-1.5"
    >
      <Chip
        partidoId={partidoId}
        outcome="local"
        label="Local"
        data={local}
      />
      <Chip
        partidoId={partidoId}
        outcome="empate"
        label="Empate"
        data={empate}
      />
      <Chip
        partidoId={partidoId}
        outcome="visita"
        label="Visita"
        data={visita}
      />
    </div>
  );
}

function Chip({
  partidoId,
  outcome,
  label,
  data,
}: {
  partidoId: string;
  outcome: "local" | "empate" | "visita";
  label: string;
  data: OddsOutcome | null;
}) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-light bg-subtle px-2 py-2 text-[11px] text-muted-d">
        <span className="text-[9px] font-bold uppercase tracking-[0.06em]">
          {label}
        </span>
        <span className="mt-0.5 font-mono text-[14px] font-bold">—</span>
      </div>
    );
  }

  const utm = new URLSearchParams({
    utm_source: "home",
    utm_medium: "comparador-mini",
    partidoId,
    mercado: "1X2",
    outcome,
  }).toString();

  return (
    <a
      href={`/go/${data.casa}?${utm}`}
      rel="sponsored noopener"
      className="flex flex-col items-center justify-center gap-0.5 rounded-sm bg-brand-gold px-2 py-2 text-black shadow-[0_2px_6px_rgba(255,184,0,0.25)] transition-all hover:-translate-y-px hover:bg-brand-gold-light"
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.06em] opacity-80">
        {label}
      </span>
      <span className="font-mono text-[15px] font-black tabular-nums leading-none">
        {data.odd.toFixed(2)}
      </span>
      <span className="text-[8px] font-bold uppercase opacity-70">
        {data.casaNombre}
      </span>
    </a>
  );
}
