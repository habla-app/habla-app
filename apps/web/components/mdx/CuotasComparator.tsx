// CuotasComparator — Lote 9 + adaptación Lote V (May 2026).
//
// V.5 flow:
//   1. Intentar leer de la tabla `CuotasCasa` (motor del Lote V) — la fuente
//      preferida desde mayo 2026. Cubre las 7 casas peruanas con cuota actual
//      + estado (OK/STALE).
//   2. Si no hay datos en CuotasCasa, caer al cache legacy de odds-cache
//      (Lote 9, basado en api-football). Comportamiento original.
//
// El componente se mantiene drop-in para los callers existentes (MDX +
// `/partidos/[slug]`). Cualquier vista nueva que prefiera el grid Lote V
// puede importar `<CuotasGridV5>` directamente.
//
// El tracking del evento `cuotas_comparator_visto` se dispara una sola vez
// en el mount inicial del wrapper (server-rendered), con la fuente real
// resuelta en el prop `hit`.

import { obtenerOddsCacheadas } from "@/lib/services/odds-cache.service";
import { obtenerCuotasV5 } from "@/lib/services/cuotas-publicas.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { CuotasGrid } from "./CuotasGrid";
import { CuotasGridV5 } from "./CuotasGridV5";
import { CuotasComparatorPoller } from "./CuotasComparatorPoller";

interface Props {
  partidoId: string;
}

export async function CuotasComparator({ partidoId }: Props) {
  // Lote V: lectura preferente de CuotasCasa (motor productivo desde mayo).
  const v5 = await obtenerCuotasV5(partidoId);
  if (v5) {
    return (
      <>
        <TrackOnMount
          event="cuotas_comparator_visto"
          props={{ partidoId, hit: true, fuente: "cuotas_casa" }}
        />
        <CuotasGridV5 data={v5} />
      </>
    );
  }

  // Fallback: cache legacy (api-football vía Redis).
  const cached = await obtenerOddsCacheadas(partidoId);

  return (
    <>
      <TrackOnMount
        event="cuotas_comparator_visto"
        props={{
          partidoId,
          hit: !!cached,
          fuente: cached ? "odds_cache" : "ninguna",
        }}
      />
      {cached ? (
        <CuotasGrid partidoId={partidoId} data={cached} />
      ) : (
        <CuotasComparatorPoller partidoId={partidoId} />
      )}
    </>
  );
}
