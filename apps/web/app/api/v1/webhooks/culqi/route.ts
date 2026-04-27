// POST /api/v1/webhooks/culqi — Lote 8.
//
// Punto de entrada del webhook de Culqi (real o mock). Valida HMAC, registra
// el evento como idempotente vía `EventoCulqi.eventId @unique`, acredita
// Lukas al usuario y emite el asiento contable, todo dentro de la misma
// `prisma.$transaction`.
//
// Idempotencia: si el unique constraint sobre `eventId` revienta, devolvemos
// 200 OK silencioso — Culqi reintenta hasta tener un 2xx, y queremos cortar
// la cadena de reintentos sin romper nada.

import { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { acreditarCompra } from "@/lib/services/compras.service";
import { getPasarelaPagos } from "@/lib/services/pasarela-pagos";
import { getPack, type PackLukasId } from "@/lib/constants/packs-lukas";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CulqiWebhookBody {
  eventId?: string;
  id?: string;
  type?: string;
  tipo?: string;
  data?: {
    cargoId?: string;
    id?: string;
    monto?: number;
    amount?: number;
    metadata?: { usuarioId?: string; packId?: string };
  };
  // Forma cruda Culqi (charge.creation.succeeded)
  object?: { id?: string; amount?: number; metadata?: Record<string, string> };
}

function extraerCampos(body: CulqiWebhookBody) {
  const eventId = body.eventId ?? body.id ?? `evt_${Date.now()}`;
  const tipo = body.type ?? body.tipo ?? "unknown";
  // Datos del cargo: priorizamos shape mock (data.*) y caemos a object.* (Culqi crudo).
  const cargoId =
    body.data?.cargoId ?? body.data?.id ?? body.object?.id ?? "";
  const montoCent =
    body.data?.monto ?? body.data?.amount ?? body.object?.amount ?? 0;
  // Si viene de Culqi real, monto está en céntimos. Mock manda en soles.
  const montoSoles =
    body.data?.monto !== undefined ? body.data.monto : Math.round(montoCent / 100);
  const metadata = body.data?.metadata ?? body.object?.metadata ?? {};
  return { eventId, tipo, cargoId, montoSoles, metadata };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("culqi-signature");

  const pasarela = getPasarelaPagos();
  if (!pasarela.verificarWebhook(rawBody, signature)) {
    logger.warn(
      { signature: signature?.slice(0, 8) },
      "webhook culqi: firma inválida",
    );
    return Response.json({ error: { code: "FIRMA_INVALIDA" } }, { status: 401 });
  }

  let body: CulqiWebhookBody;
  try {
    body = JSON.parse(rawBody) as CulqiWebhookBody;
  } catch {
    return Response.json({ error: { code: "JSON_INVALIDO" } }, { status: 400 });
  }

  const { eventId, tipo, cargoId, montoSoles, metadata } = extraerCampos(body);

  // Validar contra los packs autoritativos.
  const packId = (metadata.packId ?? "") as PackLukasId;
  const usuarioId = metadata.usuarioId ?? "";
  if (!usuarioId || !packId) {
    logger.warn({ eventId, metadata }, "webhook culqi: metadata incompleta");
    return Response.json(
      { error: { code: "METADATA_INCOMPLETA" } },
      { status: 400 },
    );
  }

  const pack = getPack(packId);
  if (!pack) {
    logger.warn({ eventId, packId }, "webhook culqi: pack desconocido");
    return Response.json(
      { error: { code: "PACK_DESCONOCIDO" } },
      { status: 400 },
    );
  }
  if (montoSoles !== pack.soles) {
    logger.warn(
      { eventId, montoSoles, esperado: pack.soles },
      "webhook culqi: monto no coincide con pack",
    );
    return Response.json(
      { error: { code: "MONTO_NO_COINCIDE" } },
      { status: 400 },
    );
  }

  // Idempotencia: insert antes de mutar nada. Si revienta el unique, OK silencioso.
  try {
    await prisma.eventoCulqi.create({
      data: {
        eventId,
        tipo,
        payload: body as unknown as object,
        usuarioId,
        cargoId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // P2002 = unique violation en Prisma.
    if (message.includes("Unique") || message.includes("P2002")) {
      logger.info({ eventId }, "webhook culqi: evento ya procesado, OK silencioso");
      return Response.json({ ok: true, idempotente: true });
    }
    throw err;
  }

  // Acreditar Lukas + asiento contable (compras.service.acreditarCompra
  // ya se encarga de invocar registrarCompraLukas + registrarBonusEmitido
  // dentro de su tx).
  try {
    const result = await acreditarCompra({
      usuarioId,
      montoCompradas: pack.lukas,
      montoBonusExtra: pack.bonus,
      refId: cargoId,
      packId: pack.id,
    });
    logger.info(
      { eventId, usuarioId, packId, nuevoBalance: result.nuevoBalance },
      "webhook culqi: compra acreditada",
    );
    return Response.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err, eventId, usuarioId, packId }, "webhook culqi: acreditación falló");
    // 500 fuerza a Culqi a reintentar.
    return Response.json(
      { error: { code: "ACREDITACION_FALLIDA" } },
      { status: 500 },
    );
  }
}
