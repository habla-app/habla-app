// Constantes de torneos y distribucion de premios

export const RAKE_PORCENTAJE = 0.12; // 12% del pozo bruto

// Distribucion del pozo neto (pozo bruto - rake)
// Los porcentajes suman 100% del pozo neto
export const DISTRIBUCION_PREMIOS = {
  "1": 0.35, // 1er lugar: 35%
  "2": 0.20, // 2do lugar: 20%
  "3": 0.12, // 3er lugar: 12%
  "4-10": 0.33, // 4to a 10mo: 33% repartido entre ellos
} as const;

// Rangos de entrada por tipo de torneo (en centavos de Lukas)
export const ENTRADA_RANGO = {
  EXPRESS: { min: 300, max: 500 }, // S/ 3-5
  ESTANDAR: { min: 1000, max: 2000 }, // S/ 10-20
  PREMIUM: { min: 3000, max: 5000 }, // S/ 30-50
  GRAN_TORNEO: { min: 10000, max: 10000 }, // S/ 100
} as const;

export const MAX_TICKETS_POR_USUARIO = 10;
export const MIN_INSCRITOS_PARA_ACTIVAR = 2;
export const MINUTOS_ANTES_CIERRE = 5;
