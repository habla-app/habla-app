// GET/POST /api/v1/whatsapp/webhook — Lote E.
//
// GET: handshake inicial de Meta (envía hub.mode/verify_token/challenge).
// POST: eventos en producción — mensajes entrantes del bot 1:1 + status
// updates de los mensajes que enviamos.
//
// Reglas duras:
//   - GET responde challenge si verify_token coincide; 403 si no.
//   - POST verifica firma X-Hub-Signature-256 con WHATSAPP_APP_SECRET; sin
//     firma válida → 401.
//   - Idempotencia: WhatsApp puede reintentar el mismo evento. El handler
//     de mensajes verifica si el `whatsappMsgId` ya existe en MensajeBot
//     antes de procesar.
//   - Devolvemos 200 lo más rápido posible; el procesamiento real va al
//     bot en background (fire-and-forget).

import { NextRequest } from "next/server";

import { logger } from "@/lib/services/logger";
import { track } from "@/lib/services/analytics.service";
import { verificarFirmaWhatsApp } from "@/lib/services/whatsapp/wa-business-client";
import { procesarMensajeUsuario } from "@/lib/services/whatsapp/bot-faq.service";
import { prisma } from "@habla/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — handshake
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — eventos
// ---------------------------------------------------------------------------

interface WhatsAppEntryChange {
  value?: {
    messages?: Array<{
      id?: string;
      from?: string;
      timestamp?: string;
      type?: string;
      text?: { body?: string };
    }>;
    contacts?: Array<{
      profile?: { name?: string };
      wa_id?: string;
    }>;
    statuses?: Array<{
      id?: string;
      status?: string;
      recipient_id?: string;
    }>;
  };
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: WhatsAppEntryChange[];
  }>;
}

export async function POST(req: NextRequest): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verificarFirmaWhatsApp(rawBody, signature)) {
    logger.warn(
      { source: "whatsapp:webhook" },
      "POST /api/v1/whatsapp/webhook: firma inválida",
    );
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Iterar entries → changes → mensajes/statuses.
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      // 1) Mensajes entrantes (bot 1:1).
      if (value.messages && value.messages.length > 0) {
        const contacts = value.contacts ?? [];
        for (let i = 0; i < value.messages.length; i++) {
          const msg = value.messages[i];
          if (!msg || !msg.id || !msg.from) continue;

          // Idempotencia: si ya tenemos este whatsappMsgId, skip.
          const existe = await prisma.mensajeBot.findFirst({
            where: { whatsappMsgId: msg.id },
            select: { id: true },
          });
          if (existe) continue;

          // Solo texto soportado por ahora (audio/video/imagen → respuesta genérica).
          if (msg.type !== "text" || !msg.text?.body) {
            // Disparamos respuesta genérica fire-and-forget.
            void responderTipoNoSoportado(msg.from);
            continue;
          }

          const contactName = contacts[i]?.profile?.name;
          // Fire-and-forget: el bot toma su tiempo y WhatsApp espera 5s
          // antes de retry. Devolvemos 200 inmediato.
          void procesarMensajeUsuario({
            whatsappFrom: msg.from,
            contenido: msg.text.body,
            whatsappMsgId: msg.id,
            contactName,
          }).catch((err) => {
            logger.error(
              { err, source: "whatsapp:webhook" },
              "procesarMensajeUsuario falló",
            );
          });
        }
      }

      // 2) Status updates (delivered/read/failed) — solo loggeamos +
      //    analytics. No persistimos status por defecto.
      if (value.statuses && value.statuses.length > 0) {
        for (const st of value.statuses) {
          if (!st?.id || !st?.status) continue;
          void track({
            evento: "whatsapp_mensaje_status",
            props: {
              messageId: st.id,
              status: st.status,
              recipientId: st.recipient_id,
            },
          });
        }
      }
    }
  }

  return Response.json({ ok: true });
}

async function responderTipoNoSoportado(_to: string): Promise<void> {
  // No-op por ahora — opcionalmente podemos enviar un texto genérico.
  // Lo dejamos silenciado para no spamear si el user manda muchos no-text.
}
