// Helper central de lectura de balances — Lote 6A.
//
// REGLA DURA (CLAUDE.md §13): ningún componente, endpoint ni service consume
// usuario.balanceCompradas/Bonus/Ganadas directamente. Todo pasa por este
// helper. Excepción autorizada: los services del propio módulo de mutación
// de bolsas (torneos.service, canjes.service, ranking.service, compras.service,
// vencimiento-lukas.job, wallet-view.service).

import type { Usuario } from "@habla/db";

type UsuarioBalances = Pick<
  Usuario,
  "balanceCompradas" | "balanceBonus" | "balanceGanadas"
>;

/** Suma de las 3 bolsas. Compatible con session.user.balanceLukas. */
export function getBalanceTotal(u: UsuarioBalances): number {
  return u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
}

/** Solo los Lukas ganados en torneos — únicos canjeables en /tienda. */
export function getBalanceCanjeable(u: UsuarioBalances): number {
  return u.balanceGanadas;
}

/** Todos los Lukas disponibles para inscribirse en torneos (= total). */
export function getBalanceDisponibleParaJugar(u: UsuarioBalances): number {
  return getBalanceTotal(u);
}

export interface BalanceDesglosado {
  compradas: number;
  bonus: number;
  ganadas: number;
  total: number;
  canjeable: number;
}

export function getBalanceDesglosado(u: UsuarioBalances): BalanceDesglosado {
  return {
    compradas: u.balanceCompradas,
    bonus: u.balanceBonus,
    ganadas: u.balanceGanadas,
    total: getBalanceTotal(u),
    canjeable: getBalanceCanjeable(u),
  };
}
