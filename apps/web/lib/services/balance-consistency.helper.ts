// Guard de consistencia post-mutación de balances — Lote 6C-fix3.
//
// Helper compartido que se llama al final de toda mutación atómica de Lukas
// (descuento, acreditación, reembolso, vencimiento). Lee el usuario
// refrescado desde la transacción y verifica la invariante I1:
//
//   balanceLukas === balanceCompradas + balanceBonus + balanceGanadas
//
// Si diverge, loggea `error` con el delta y el contexto. NO lanza ni rompe
// el flujo del usuario — el objetivo es detectar regresiones tempranas en
// producción mediante el cron diario de auditoría (Job G), que consolida
// todos los logs y manda email al admin.
//
// Patrón de uso (dentro de prisma.$transaction):
//
//   await tx.usuario.update({ ... });
//   await verificarConsistenciaBalance(tx, usuarioId, "canjes.solicitar");
//
// Costo: 1 query SELECT mínimo (4 columnas). Imperceptible para el caller.

import type { Prisma } from "@habla/db";
import { logger } from "./logger";

/** Tipo del cliente prisma dentro de una transacción. */
type TxClient = Prisma.TransactionClient;

/**
 * Verifica que `balanceLukas == balanceCompradas + balanceBonus + balanceGanadas`
 * post-mutación. Si diverge, loggea error con delta y contexto. Nunca lanza.
 *
 * @param tx        Cliente prisma dentro de una `$transaction`.
 * @param usuarioId Usuario afectado por la mutación que acaba de correr.
 * @param contexto  String corto identificando el flujo (ej. "canjes.solicitar",
 *                  "ranking.acreditarPremios"). Aparece en los logs.
 */
export async function verificarConsistenciaBalance(
  tx: TxClient,
  usuarioId: string,
  contexto: string,
): Promise<void> {
  const u = await tx.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      balanceLukas: true,
      balanceCompradas: true,
      balanceBonus: true,
      balanceGanadas: true,
    },
  });
  if (!u) return; // raro pero no es nuestro problema acá

  const sumaBolsas = u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
  if (u.balanceLukas !== sumaBolsas) {
    logger.error(
      {
        usuarioId,
        contexto,
        balanceLukas: u.balanceLukas,
        sumaBolsas,
        delta: u.balanceLukas - sumaBolsas,
        balanceCompradas: u.balanceCompradas,
        balanceBonus: u.balanceBonus,
        balanceGanadas: u.balanceGanadas,
      },
      "DESINCRONIZACION: balanceLukas != suma bolsas tras mutación",
    );
  }
}
