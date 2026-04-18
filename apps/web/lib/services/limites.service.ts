// Servicio de límites de juego — stub. Sub-Sprint 7 implementa el CRUD
// real de límites mensuales/diarios y auto-exclusión. Por ahora siempre
// deja pasar.
//
// La lógica real deberá consultar:
//   - LimitesJuego del usuario (mensual de compra, diario de tickets,
//     auto-exclusionHasta)
//   - TransaccionLukas del mes (suma de compras)
//   - Tickets del día
// y lanzar `LimiteExcedido` cuando corresponda.

import type { Prisma } from "@habla/db";

type TxClient = Prisma.TransactionClient;

export interface ChequeoInscripcionInput {
  tx: TxClient;
  usuarioId: string;
  entradaLukas: number;
}

export async function verificarLimiteInscripcion(
  _input: ChequeoInscripcionInput,
): Promise<void> {
  // Stub intencional — Sub-Sprint 7 implementa los checks reales.
  return;
}
