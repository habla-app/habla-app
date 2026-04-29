// CuotasComparator — Lote 9.
//
// Async server component que comparte data de odds con la vista. Tres
// caminos en el RSC:
//   - Cache hit: render directo de `<CuotasGrid>` con la data.
//   - Cache miss + Redis configurado: render skeleton + `<CuotasComparatorPoller>`
//     que pollea `/api/v1/cuotas/[partidoId]` cada 3s (max 4 intentos).
//   - Sin Redis (REDIS_URL ausente): el cache siempre es miss, pero el
//     poller tiraría loops infinitos contra el endpoint que tampoco
//     persiste. El comportamiento es el mismo que Redis caído: miss →
//     poller → max attempts → estado vacío. Aceptable: en producción
//     siempre hay Redis (Railway).
//
// El tracking del evento `cuotas_comparator_visto` se dispara una sola
// vez en el mount inicial del wrapper (server-rendered), independiente
// del estado.
//
// Reusable: el componente se registra en MDX_COMPONENTS y también se
// importa directo desde los pages `/cuotas` y `/partidos/[slug]`.

import { obtenerOddsCacheadas } from "@/lib/services/odds-cache.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { CuotasGrid } from "./CuotasGrid";
import { CuotasComparatorPoller } from "./CuotasComparatorPoller";

interface Props {
  partidoId: string;
}

export async function CuotasComparator({ partidoId }: Props) {
  const cached = await obtenerOddsCacheadas(partidoId);

  return (
    <>
      <TrackOnMount
        event="cuotas_comparator_visto"
        props={{ partidoId, hit: !!cached }}
      />
      {cached ? (
        <CuotasGrid partidoId={partidoId} data={cached} />
      ) : (
        <CuotasComparatorPoller partidoId={partidoId} />
      )}
    </>
  );
}
