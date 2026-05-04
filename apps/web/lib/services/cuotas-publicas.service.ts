// Servicio de lectura PÚBLICA de cuotas para `<CuotasComparator>` (Lote V).
//
// Lee directo de la tabla `CuotasCasa` filtrando por `estado IN (OK, STALE)`.
// Devuelve una estructura por mercado con todas las casas que tienen valor
// para esa selección. La capa de presentación (`CuotasGridV5`) decide cuál
// es la "mejor cuota" y aplica los badges visuales.
//
// Sin Redis. La lectura es directa de Postgres con índice en partidoId
// (rápido). El índice también cubre `[casa, estado]` para queries futuras.

import { prisma } from "@habla/db";
import type { CasaCuotas } from "./scrapers/types";
import type { CuotasV5Payload } from "@/components/mdx/CuotasGridV5";

const ETIQUETAS_CASA: Record<CasaCuotas, string> = {
  stake: "Stake",
  apuesta_total: "Apuesta Total",
  coolbet: "Coolbet",
  doradobet: "Doradobet",
  betano: "Betano",
  inkabet: "Inkabet",
  te_apuesto: "Te Apuesto",
};

interface SeleccionDef {
  outcome: string;
  label: string;
  campo:
    | "cuotaLocal"
    | "cuotaEmpate"
    | "cuotaVisita"
    | "cuota1X"
    | "cuota12"
    | "cuotaX2"
    | "cuotaOver25"
    | "cuotaUnder25"
    | "cuotaBttsSi"
    | "cuotaBttsNo";
}

const MERCADO_1X2: SeleccionDef[] = [
  { outcome: "local", label: "Local", campo: "cuotaLocal" },
  { outcome: "empate", label: "Empate", campo: "cuotaEmpate" },
  { outcome: "visita", label: "Visita", campo: "cuotaVisita" },
];
const MERCADO_DOBLE_OP: SeleccionDef[] = [
  { outcome: "1x", label: "1X", campo: "cuota1X" },
  { outcome: "12", label: "12", campo: "cuota12" },
  { outcome: "x2", label: "X2", campo: "cuotaX2" },
];
const MERCADO_OU25: SeleccionDef[] = [
  { outcome: "over25", label: "Más de 2.5", campo: "cuotaOver25" },
  { outcome: "under25", label: "Menos de 2.5", campo: "cuotaUnder25" },
];
const MERCADO_BTTS: SeleccionDef[] = [
  { outcome: "btts_si", label: "Sí", campo: "cuotaBttsSi" },
  { outcome: "btts_no", label: "No", campo: "cuotaBttsNo" },
];

/**
 * Devuelve el payload listo para `<CuotasGridV5>`. Si no hay cuotas en
 * estado OK/STALE, devuelve null — el caller decide si renderiza un
 * fallback (`<EstadoVacio>` del propio CuotasGridV5 o el flujo legacy).
 */
export async function obtenerCuotasV5(
  partidoId: string,
): Promise<CuotasV5Payload | null> {
  const filas = await prisma.cuotasCasa.findMany({
    where: { partidoId, estado: { in: ["OK", "STALE"] } },
    orderBy: { casa: "asc" },
  });
  if (filas.length === 0) return null;

  const ultimaActualizacion = filas
    .map((f) => f.capturadoEn)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  function buildLineas(seleccions: SeleccionDef[]) {
    return seleccions
      .map((sel) => {
        const cuotas = filas
          .map((fila) => {
            const v = fila[sel.campo as keyof typeof fila];
            const valor = v && typeof v === "object" && "toNumber" in v
              ? (v as { toNumber(): number }).toNumber()
              : null;
            if (valor === null || valor <= 0) return null;
            const casa = fila.casa as CasaCuotas;
            return {
              casa,
              casaLabel: ETIQUETAS_CASA[casa] ?? casa,
              valor,
              estado: (fila.estado === "STALE" ? "STALE" : "OK") as "OK" | "STALE",
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        return { outcome: sel.outcome, label: sel.label, cuotas };
      })
      .filter((linea) => linea.cuotas.length > 0);
  }

  return {
    partidoId,
    actualizadoEn: ultimaActualizacion,
    mercados: {
      "1X2": buildLineas(MERCADO_1X2),
      doble_op: buildLineas(MERCADO_DOBLE_OP),
      mas_menos_25: buildLineas(MERCADO_OU25),
      btts: buildLineas(MERCADO_BTTS),
    },
  };
}
