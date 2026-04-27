// Plan de cuentas seed (Lote 8 §2.B).
//
// 11 cuentas iniciales. El seeding se ejecuta vía
// `POST /api/v1/admin/contabilidad/apertura` (idempotente). Esta constante
// es la fuente única de verdad — Job I y la vista del balance general la
// consumen para conocer los códigos esperados.

import type { TipoCuenta } from "@habla/db";

export interface CuentaSeed {
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
}

export const PLAN_DE_CUENTAS: ReadonlyArray<CuentaSeed> = [
  // Activo
  { codigo: "1010", nombre: "Caja-Banco Interbank",      tipo: "ACTIVO" },
  // Pasivo
  { codigo: "4010", nombre: "Pasivo Lukas Compradas",    tipo: "PASIVO" },
  { codigo: "4020", nombre: "Pasivo Lukas Bonus",        tipo: "PASIVO" },
  { codigo: "4030", nombre: "Pasivo Lukas Ganadas",      tipo: "PASIVO" },
  { codigo: "4040", nombre: "IGV por Pagar",             tipo: "PASIVO" },
  // Patrimonio
  { codigo: "5010", nombre: "Capital Habla",             tipo: "PATRIMONIO" },
  // Ingresos
  { codigo: "7010", nombre: "Ingreso por Rake",          tipo: "INGRESO" },
  { codigo: "7020", nombre: "Ingreso por Canjes",        tipo: "INGRESO" },
  { codigo: "7030", nombre: "Ingreso por Breakage",      tipo: "INGRESO" },
  // Gastos
  { codigo: "8010", nombre: "Costo Marketing - Bonus",   tipo: "GASTO" },
  { codigo: "8020", nombre: "Costo Premios Físicos",     tipo: "GASTO" },
];

/** Códigos de cuentas usados como constantes en hooks contables. */
export const COD = {
  CAJA_BANCO:        "1010",
  PASIVO_COMPRADAS:  "4010",
  PASIVO_BONUS:      "4020",
  PASIVO_GANADAS:    "4030",
  IGV_POR_PAGAR:     "4040",
  CAPITAL:           "5010",
  ING_RAKE:          "7010",
  ING_CANJES:        "7020",
  ING_BREAKAGE:      "7030",
  COSTO_BONUS:       "8010",
  COSTO_PREMIOS:     "8020",
} as const;

/** IGV peruano (18%) usado para split bruto → neto + IGV.
 *  Helper: `montoSinIgv = monto * 100/118`, `igv = monto * 18/118`. */
export const IGV_PCT = 18;
