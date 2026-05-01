// Configuración estática de planes Premium (Lote D).
//
// Fuente única de verdad de los precios y labels que se muestran en
// /premium, /premium/checkout, /premium/mi-suscripcion. Si Lote E publica
// distintos precios en OpenPay, hay que mantener este archivo en sync con
// `PLANES_PRECIO_CENTIMOS` de `pasarela-pagos/types.ts`.

export type PlanKey = "mensual" | "trimestral" | "anual";

export interface PlanConfig {
  key: PlanKey;
  /** Label visible (ej "Anual"). */
  label: string;
  /** Subtítulo bajo el label. */
  subtitulo: string;
  /** Precio entero en soles (sin decimales — los planes están en S/ enteros). */
  precioSoles: number;
  /** Periodo descriptivo corto ("por mes", "al año", "por 3 meses"). */
  periodoCorto: string;
  /** Equivalencia mensual cuando el plan es trimestral o anual. */
  equivalenciaMensual: string | null;
  /** % de ahorro vs mensual en formato "32%" o null si es el mensual. */
  ahorroPct: string | null;
  /** Días que dura el plan. */
  duracionDias: number;
}

export const PLANES: Record<PlanKey, PlanConfig> = {
  mensual: {
    key: "mensual",
    label: "Mensual",
    subtitulo: "Cancela cuando quieras",
    precioSoles: 49,
    periodoCorto: "por mes",
    equivalenciaMensual: null,
    ahorroPct: null,
    duracionDias: 30,
  },
  trimestral: {
    key: "trimestral",
    label: "Trimestral",
    subtitulo: "Ahorras 19% · S/ 39.6/mes",
    precioSoles: 119,
    periodoCorto: "por 3 meses",
    equivalenciaMensual: "S/ 39.6/mes",
    ahorroPct: "19%",
    duracionDias: 90,
  },
  anual: {
    key: "anual",
    label: "Anual",
    subtitulo: "Ahorras 32% · S/ 33.2/mes",
    precioSoles: 399,
    periodoCorto: "al año",
    equivalenciaMensual: "S/ 33.2/mes",
    ahorroPct: "32%",
    duracionDias: 365,
  },
};

export function planKeyDesdeEnum(
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL",
): PlanKey {
  return plan.toLowerCase() as PlanKey;
}
