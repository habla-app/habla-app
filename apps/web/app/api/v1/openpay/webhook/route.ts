// POST /api/v1/openpay/webhook — Lote E.
//
// Recibe eventos de OpenPay BBVA tras los cobros + cancelaciones de
// suscripción. Verifica la firma HMAC-SHA256 con OPENPAY_WEBHOOK_SECRET y
// delega a `suscripciones.service` para idempotencia.
//
// Eventos manejados:
//   - charge.succeeded         → activarSuscripcion (primer cobro o
//                                recurrente)
//   - charge.failed            → registrarPagoFallido
//   - subscription.canceled    → no-op (ya cancelamos en BD desde el endpoint
//                                de usuario; webhook confirma)
//   - subscription.expired     → marcar VENCIDA si todavía estaba activa
//
// Cualquier otro evento se loggea en INFO y se ignora.
//
// Reglas duras:
//   - Sin firma válida → 401.
//   - Idempotencia: el webhook puede reintentar; los services verifican
//     estado antes de mutar.
//   - Cero acceso a datos de tarjeta sensibles — solo ultimosCuatro/marca.

import { NextRequest } from "next/server";

import {
  activarSuscripcion,
  registrarPagoFallido,
} from "@/lib/services/suscripciones.service";
import { verificarFirmaOpenPay } from "@/lib/services/pasarela-pagos/openpay-adapter";
import { logger } from "@/lib/services/logger";
import { prisma } from "@habla/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OpenPayWebhookEvent {
  type?: string;
  event_date?: string;
  transaction?: {
    id?: string;
    subscription_id?: string | null;
    customer_id?: string | null;
    amount?: number;
    status?: string;
    method?: string;
    card?: { card_number?: string; brand?: string };
    error_code?: string;
    error_message?: string;
  };
  // OpenPay también envía eventos de subscription al raíz (no transaction).
  subscription?: {
    id?: string;
    status?: string;
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-openpay-signature") ??
    req.headers.get("openpay-signature") ??
    null;

  if (!verificarFirmaOpenPay(rawBody, signature)) {
    logger.warn(
      { source: "openpay:webhook" },
      "POST /api/v1/openpay/webhook: firma inválida",
    );
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  let event: OpenPayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventType = event.type ?? "";
  logger.info(
    { eventType, source: "openpay:webhook" },
    "POST /api/v1/openpay/webhook: evento recibido",
  );

  try {
    switch (eventType) {
      case "charge.succeeded": {
        const tx = event.transaction;
        if (!tx?.subscription_id || !tx?.id) {
          // Cobro único (no de suscripción) o data incompleta.
          logger.info(
            { eventType, source: "openpay:webhook" },
            "charge.succeeded sin subscription_id, ignorado",
          );
          break;
        }
        const ult4 = tx.card?.card_number?.slice(-4) ?? null;
        await activarSuscripcion({
          openpaySuscripcionId: tx.subscription_id,
          openpayCobroId: tx.id,
          monto: tx.amount,
          ultimosCuatro: ult4,
          marcaTarjeta: tx.card?.brand ?? null,
          metodo: tx.method ?? null,
        });
        break;
      }
      case "charge.failed": {
        const tx = event.transaction;
        if (!tx?.subscription_id || !tx?.id) break;
        await registrarPagoFallido({
          openpaySuscripcionId: tx.subscription_id,
          openpayCobroId: tx.id,
          monto: tx.amount,
          codigoError: tx.error_code ?? null,
          mensajeError: tx.error_message ?? null,
        });
        break;
      }
      case "subscription.canceled": {
        // Confirmación: el endpoint de usuario ya marcó CANCELANDO. No hay
        // que hacer nada salvo loggear.
        const subId = event.subscription?.id ?? event.transaction?.subscription_id;
        logger.info(
          { subId, source: "openpay:webhook" },
          "subscription.canceled confirmado por OpenPay",
        );
        break;
      }
      case "subscription.expired": {
        const subId = event.subscription?.id ?? event.transaction?.subscription_id;
        if (!subId) break;
        // Marcar VENCIDA si todavía estaba activa. Idempotente.
        const sus = await prisma.suscripcion.findUnique({
          where: { openpaySuscripcionId: subId },
        });
        if (sus && sus.activa) {
          await prisma.$transaction(async (tx) => {
            await tx.suscripcion.update({
              where: { id: sus.id },
              data: { estado: "VENCIDA", activa: false },
            });
            await tx.miembroChannel.updateMany({
              where: {
                suscripcionId: sus.id,
                estado: { in: ["INVITADO", "REINVITADO", "UNIDO"] },
              },
              data: { estado: "REMOVIDO", removidoEn: new Date() },
            });
          });
        }
        break;
      }
      default:
        logger.info(
          { eventType, source: "openpay:webhook" },
          "evento no manejado, ignorado",
        );
    }
  } catch (err) {
    logger.error(
      { err, eventType, source: "openpay:webhook" },
      "POST /api/v1/openpay/webhook: handler falló",
    );
    // Devolvemos 200 igual: si el webhook devuelve 5xx, OpenPay reintenta y
    // podríamos generar duplicados (los services son idempotentes pero el
    // log se llena de basura). El error queda en logs/critical.
    return Response.json(
      { ok: false, error: "internal" },
      { status: 200 },
    );
  }

  return Response.json({ ok: true });
}
