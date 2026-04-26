// Helper central de lectura de balances — Lote 6A.
//
// REGLA DURA (CLAUDE.md §13): ningún componente, endpoint ni service consume
// usuario.balanceCompradas/Bonus/Ganadas directamente. Todo pasa por este
// helper. Excepción autorizada: los services del propio módulo de mutación
// de bolsas (torneos.service, canjes.service, ranking.service, compras.service,
// vencimiento-lukas.job, wallet-view.service).
//
// Lote 6C: se agregan getLukasJuego / getLukasPremios y las constantes de
// label/descripción para uso en todos los puntos de display.

import type { Usuario } from "@habla/db";

type UsuarioBalances = Pick<
  Usuario,
  "balanceCompradas" | "balanceBonus" | "balanceGanadas"
>;

// ---------------------------------------------------------------------------
// Labels y descripciones — fuente única para todo el display
// ---------------------------------------------------------------------------

/** Nombre visible del balance total (para jugar y ganar). Lote 6C. */
export const LUKAS_JUEGO_LABEL = "Lukas Juego";
/** Descripción corta de Lukas Juego. Lote 6C. */
export const LUKAS_JUEGO_DESC = "Todo tu saldo · Para jugar y ganar";

/** Nombre visible del subconjunto canjeable (ganadas en torneos). Lote 6C. */
export const LUKAS_PREMIOS_LABEL = "Lukas Premios";
/** Descripción corta de Lukas Premios. Lote 6C. */
export const LUKAS_PREMIOS_DESC = "Ganadas en torneos · Canjeables en Tienda";

// ---------------------------------------------------------------------------
// Funciones de cálculo
// ---------------------------------------------------------------------------

/** Suma de las 3 bolsas. Compatible con session.user.balanceLukas. */
export function getBalanceTotal(u: UsuarioBalances): number {
  return u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
}

/**
 * Lukas Juego = total de las 3 bolsas. Todo lo disponible para inscribirse
 * en torneos y ganar. Alias semántico de getBalanceTotal. Lote 6C.
 */
export function getLukasJuego(u: UsuarioBalances): number {
  return getBalanceTotal(u);
}

/** Solo los Lukas ganados en torneos — únicos canjeables en /tienda. */
export function getBalanceCanjeable(u: UsuarioBalances): number {
  return u.balanceGanadas;
}

/**
 * Lukas Premios = solo balanceGanadas. Subconjunto de Lukas Juego.
 * Son los únicos que se pueden gastar en /tienda. Lote 6C.
 */
export function getLukasPremios(u: UsuarioBalances): number {
  return getBalanceCanjeable(u);
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
