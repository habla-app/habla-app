// Fuente única de packs de compra de Lukas — Lote 8 (repricing).
//
// Tabla autoritativa: Básico S/10, Medio S/25, Grande S/50, VIP S/100.
// Los bonos van a la bolsa BONUS (no canjeables, sin vencimiento). Los Lukas
// pagados van a la bolsa COMPRADAS con vencimiento 36m.
//
// Cualquier código que necesite el listado, precios o bonos de packs DEBE
// importar de este archivo. Prohibido hardcodear montos en componentes,
// tests, services o Culqi adapter.

export interface PackLukas {
  id: PackLukasId;
  /** Precio en soles (1 Luka = S/1, así que también == lukas comprados). */
  soles: number;
  /** Lukas que entran a la bolsa COMPRADAS. */
  lukas: number;
  /** Bonus que entra a la bolsa BONUS (0 para pack básico). */
  bonus: number;
}

export type PackLukasId = "basic" | "medium" | "large" | "vip";

export const PACKS_LUKAS = [
  { id: "basic",  soles: 10,  lukas: 10,  bonus: 0  },
  { id: "medium", soles: 25,  lukas: 25,  bonus: 5  },
  { id: "large",  soles: 50,  lukas: 50,  bonus: 10 },
  { id: "vip",    soles: 100, lukas: 100, bonus: 20 },
] as const satisfies ReadonlyArray<PackLukas>;

export function getPack(id: string): PackLukas | undefined {
  return PACKS_LUKAS.find((p) => p.id === id);
}

/** Map id → bonus. Útil para callers que solo necesitan el bonus. */
export const BONUS_POR_PACK: Record<PackLukasId, number> = Object.fromEntries(
  PACKS_LUKAS.map((p) => [p.id, p.bonus]),
) as Record<PackLukasId, number>;
