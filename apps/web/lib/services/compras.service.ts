// Servicio de compras de Lukas — Lote 6A + Lote 8 (Culqi mockeado).
//
// Llamado desde el webhook `/webhooks/culqi` tras verificar la firma. La
// lógica de acreditación es pura; el webhook se encarga de idempotencia
// (`EventoCulqi.eventId @unique`) y de validar el pack contra la tabla
// autoritativa `PACKS_LUKAS` (`lib/constants/packs-lukas.ts`).
//
// Bolsas: los Lukas comprados van a COMPRADAS (con vencimiento 36m);
// el bonus del pack (si aplica) va a BONUS (sin vencimiento).

import { prisma } from "@habla/db";
import { getBalanceTotal } from "../lukas-display";
import { logger } from "./logger";
import { MESES_VENCIMIENTO_COMPRA } from "../config/economia";
import { verificarConsistenciaBalance } from "./balance-consistency.helper";
import {
  registrarCompraLukas,
  registrarBonusEmitido,
} from "./contabilidad/contabilidad.service";
import { type PackLukasId } from "../constants/packs-lukas";

// Re-export para no romper callers existentes. La fuente única vive en
// `lib/constants/packs-lukas.ts` (Lote 8).
export { BONUS_POR_PACK } from "../constants/packs-lukas";

export interface AcreditarCompraInput {
  usuarioId: string;
  /** Lukas comprados (sin bonus). */
  montoCompradas: number;
  /** Bonus del pack (puede ser 0 para pack básico). */
  montoBonusExtra: number;
  /** ID de la transacción Culqi, para idempotencia y audit. */
  refId: string;
  /** ID del pack para registro contable (Lote 8). Opcional para callers
   *  legacy; sin él, la acreditación funciona pero no genera asiento. */
  packId?: PackLukasId;
}

export interface AcreditarCompraResult {
  nuevoBalance: number;
  transaccionCompraId: string;
}

export async function acreditarCompra(
  input: AcreditarCompraInput,
): Promise<AcreditarCompraResult> {
  if (input.montoCompradas <= 0) {
    throw new Error(
      `acreditarCompra: montoCompradas debe ser > 0, recibido ${input.montoCompradas}`,
    );
  }

  const venceEn = new Date(
    Date.now() + MESES_VENCIMIENTO_COMPRA * 30 * 24 * 60 * 60 * 1000,
  );

  const result = await prisma.$transaction(async (tx) => {
    const txCompra = await tx.transaccionLukas.create({
      data: {
        usuarioId: input.usuarioId,
        tipo: "COMPRA",
        bolsa: "COMPRADAS",
        monto: input.montoCompradas,
        descripcion: `Compra de ${input.montoCompradas} Lukas`,
        refId: input.refId,
        venceEn,
        saldoVivo: input.montoCompradas,
      },
    });

    if (input.montoBonusExtra > 0) {
      await tx.transaccionLukas.create({
        data: {
          usuarioId: input.usuarioId,
          tipo: "BONUS",
          bolsa: "BONUS",
          monto: input.montoBonusExtra,
          descripcion: `Bonus de pack (${input.montoBonusExtra} Lukas)`,
          refId: input.refId,
        },
      });
    }

    const montoTotal = input.montoCompradas + input.montoBonusExtra;
    await tx.usuario.update({
      where: { id: input.usuarioId },
      data: {
        balanceCompradas: { increment: input.montoCompradas },
        balanceBonus: { increment: input.montoBonusExtra },
        balanceLukas: { increment: montoTotal },
      },
    });

    const usuario = await tx.usuario.findUnique({
      where: { id: input.usuarioId },
      select: {
        balanceCompradas: true,
        balanceBonus: true,
        balanceGanadas: true,
      },
    });

    // Lote 6C-fix3: guard de consistencia post-mutación.
    await verificarConsistenciaBalance(tx, input.usuarioId, "compras.acreditar");

    // Lote 8: registrar contabilidad dentro de la misma tx. Si packId no
    // viene (callers legacy), salteamos el asiento — Lote 9 los migrará.
    if (input.packId) {
      await registrarCompraLukas(input.usuarioId, input.packId, input.refId, tx);
      if (input.montoBonusExtra > 0) {
        await registrarBonusEmitido(
          input.usuarioId,
          input.montoBonusExtra,
          "pack_bonus",
          tx,
        );
      }
    }

    return {
      nuevoBalance: getBalanceTotal(usuario!),
      transaccionCompraId: txCompra.id,
    };
  });

  logger.info(
    {
      usuarioId: input.usuarioId,
      montoCompradas: input.montoCompradas,
      montoBonusExtra: input.montoBonusExtra,
      refId: input.refId,
      nuevoBalance: result.nuevoBalance,
    },
    "compra de Lukas acreditada",
  );

  return result;
}
