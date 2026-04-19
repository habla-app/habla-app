// Distribución de premios en el FE para calcular "1er premio estimado"
// en la header de ComboModal. Valores idénticos a DISTRIB_PREMIOS del
// torneos.service.ts — duplicamos para no mezclar server/client imports.

export const DISTRIB_PREMIOS_FE = {
  primero: 0.35,
  segundo: 0.2,
  tercero: 0.12,
  cuartoADecimo: 0.33,
} as const;
