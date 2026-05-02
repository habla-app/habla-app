// Bot FAQ 1:1 vía WhatsApp Business API — Lote E (May 2026).
//
// Flujo end-to-end:
//   1. Usuario escribe al número del bot.
//   2. Webhook `POST /api/v1/whatsapp/webhook` recibe el mensaje.
//   3. `procesarMensajeUsuario()` busca/crea ConversacionBot, guarda mensaje
//      USER, decide qué responder.
//   4. Tres caminos:
//        a) Detección de ludopatía → respuesta fija + derivar a admin.
//        b) Usuario no Premium → CTA a /premium.
//        c) Usuario Premium → llamar a Claude API con historial + base.
//   5. Guarda mensaje ASSISTANT + envía por WhatsApp + actualiza
//      `ultimoMensajeAt`.
//   6. Si la respuesta incluye [DERIVAR_HUMANO], notifica al admin.
//
// Reglas duras:
//   - Rate limit: máx 10 mensajes/usuario/hora (limit en BD por
//     ConversacionBot).
//   - Cero alucinaciones de info sensible — system prompt prohíbe inventar.
//   - Logs detallados con tokens consumidos, modelo, tiempo.
//   - Auditoría de derivaciones (fueDerivado=true en MensajeBot).

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@habla/db";

import { logger } from "@/lib/services/logger";
import { track } from "@/lib/services/analytics.service";
import { registrarError } from "@/lib/services/logs.service";
import { enviarEmail } from "@/lib/services/email.service";
import { esSuscriptorPremium } from "@/lib/services/suscripciones.service";

import {
  WhatsAppBusinessClient,
  isWhatsAppConfigured,
} from "./wa-business-client";
import { LUDOPATIA_TRIGGERS } from "./bot-knowledge-base";
import { RESPUESTA_LUDOPATIA, systemPromptBot } from "./bot-prompts";

const DEFAULT_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 800;
const HISTORIAL_TURNS = 10; // últimos turnos del usuario+asistente
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; /* 1h */

interface AnthropicConfig {
  apiKey: string;
  model: string;
}

function readAnthropicConfig(): AnthropicConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  };
}

export interface ProcesarMensajeInput {
  whatsappFrom: string;
  contenido: string;
  whatsappMsgId: string;
  contactName?: string;
}

export async function procesarMensajeUsuario(
  input: ProcesarMensajeInput,
): Promise<{
  ok: boolean;
  respuesta?: string;
  derivado?: boolean;
}> {
  const inicio = Date.now();
  void track({
    evento: "bot_mensaje_recibido",
    props: { whatsappFrom: input.whatsappFrom },
  });

  // 1. Buscar usuario por phone (el campo es Usuario.telefono).
  const usuario = await prisma.usuario.findFirst({
    where: { telefono: input.whatsappFrom },
  });

  // 2. Obtener o crear conversación abierta.
  let conversacion = await prisma.conversacionBot.findFirst({
    where: { whatsappFrom: input.whatsappFrom, cerrada: false },
    include: {
      mensajes: { orderBy: { creadoEn: "asc" }, take: 50 },
    },
  });
  if (!conversacion) {
    const created = await prisma.conversacionBot.create({
      data: {
        whatsappFrom: input.whatsappFrom,
        usuarioId: usuario?.id ?? null,
      },
    });
    conversacion = { ...created, mensajes: [] };
  }

  // 3. Guardar mensaje del usuario.
  await prisma.mensajeBot.create({
    data: {
      conversacionId: conversacion.id,
      rol: "USER",
      contenido: input.contenido.slice(0, 8000),
      whatsappMsgId: input.whatsappMsgId,
    },
  });

  // 4. Rate limit: máx 10 mensajes USER en última hora.
  const desde = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const usadosUltimaHora = await prisma.mensajeBot.count({
    where: {
      conversacionId: conversacion.id,
      rol: "USER",
      creadoEn: { gte: desde },
    },
  });
  if (usadosUltimaHora > RATE_LIMIT_MAX) {
    return enviarRespuesta({
      conversacionId: conversacion.id,
      to: input.whatsappFrom,
      texto:
        "Has alcanzado el límite de uso del bot (10 mensajes/hora). Intenta de nuevo en 1 hora. Si tienes algo urgente, escríbenos a soporte@hablaplay.com 💌",
      generadoConIA: false,
    });
  }

  // 5. Detección de ludopatía — antes de cualquier otra ruta.
  if (detectaLudopatia(input.contenido)) {
    void track({
      evento: "bot_ludopatia_detectada",
      userId: usuario?.id,
      props: { whatsappFrom: input.whatsappFrom },
    });
    await registrarError({
      level: "critical",
      source: "bot:ludopatia",
      message: `Bot detectó señal de ludopatía en ${usuario?.email ?? input.whatsappFrom}`,
      userId: usuario?.id,
      metadata: { conversacionId: conversacion.id },
    });
    const r = await enviarRespuesta({
      conversacionId: conversacion.id,
      to: input.whatsappFrom,
      texto: RESPUESTA_LUDOPATIA,
      generadoConIA: false,
      fueDerivado: true,
    });
    void notificarAdminConsultaDerivada(conversacion.id);
    return r;
  }

  // 6. Si no es Premium, respuesta limitada.
  const esPremium = usuario?.id ? await esSuscriptorPremium(usuario.id) : false;
  if (!esPremium) {
    const nombre = usuario?.nombre ?? input.contactName ?? "";
    const respuesta = `Hola${nombre ? " " + nombre : ""}! 👋

Soy el bot FAQ de Habla! — pero solo respondo dudas a fondo a suscriptores Premium.

Si querés acceso, suscribite (S/ 49/mes, garantía 7 días):
https://hablaplay.com/premium

Si tenés dudas sin ser Premium, escribinos a soporte@hablaplay.com 💌`;
    return enviarRespuesta({
      conversacionId: conversacion.id,
      to: input.whatsappFrom,
      texto: respuesta,
      generadoConIA: false,
    });
  }

  // 7. Llamada a Claude.
  const anthropicCfg = readAnthropicConfig();
  if (!anthropicCfg) {
    logger.warn(
      { source: "bot:faq" },
      "procesarMensajeUsuario: ANTHROPIC_API_KEY no configurada — fallback estático",
    );
    return enviarRespuesta({
      conversacionId: conversacion.id,
      to: input.whatsappFrom,
      texto:
        "Estoy en mantenimiento ahora mismo. Si tu consulta es urgente, escribinos a soporte@hablaplay.com — te respondemos en menos de 24h. 🙋",
      generadoConIA: false,
    });
  }

  const historial = conversacion.mensajes.slice(-HISTORIAL_TURNS).map((m) => ({
    role: (m.rol === "USER" ? "user" : "assistant") as "user" | "assistant",
    content: m.contenido,
  }));

  let respuestaClaude = "";
  let tokensUsados: number | null = null;
  try {
    const anthropic = new Anthropic({ apiKey: anthropicCfg.apiKey });
    const response = await anthropic.messages.create({
      model: anthropicCfg.model,
      max_tokens: MAX_TOKENS,
      system: systemPromptBot({ nombreUsuario: usuario?.nombre }),
      messages: [
        ...historial,
        { role: "user", content: input.contenido },
      ],
    });
    respuestaClaude = response.content
      .filter((c) => c.type === "text")
      .map((c) => ("text" in c ? c.text : ""))
      .join("\n")
      .trim();
    tokensUsados =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);
    void track({
      evento: "bot_respuesta_generada",
      userId: usuario?.id,
      props: {
        conversacionId: conversacion.id,
        modelo: anthropicCfg.model,
        tokensUsados,
        durationMs: Date.now() - inicio,
      },
    });
  } catch (err) {
    logger.error(
      { err, source: "bot:faq" },
      "procesarMensajeUsuario: Claude API falló",
    );
    return enviarRespuesta({
      conversacionId: conversacion.id,
      to: input.whatsappFrom,
      texto:
        "Tuve un problema al procesar tu mensaje. Intenta de nuevo en un momento, o escribinos a soporte@hablaplay.com 💌",
      generadoConIA: false,
    });
  }

  // 8. Detección de derivación + sanitización del marker.
  const debeDerivar = /\[DERIVAR_HUMANO\]/i.test(respuestaClaude);
  const respuestaLimpia = respuestaClaude
    .replace(/\[DERIVAR_HUMANO\]/gi, "")
    .trim();
  const respuestaFinal = debeDerivar
    ? `${respuestaLimpia}\n\nVoy a derivar tu pregunta a un humano. Te respondemos en menos de 24h. 🙋`
    : respuestaLimpia;

  const r = await enviarRespuesta({
    conversacionId: conversacion.id,
    to: input.whatsappFrom,
    texto: respuestaFinal,
    generadoConIA: true,
    modeloIA: anthropicCfg.model,
    tokensUsados,
    fueDerivado: debeDerivar,
  });
  if (debeDerivar) {
    void track({
      evento: "bot_consulta_derivada",
      userId: usuario?.id,
      props: { conversacionId: conversacion.id },
    });
    void notificarAdminConsultaDerivada(conversacion.id);
  }

  // 9. Touch ultimoMensajeAt + reset cerrada=false.
  await prisma.conversacionBot.update({
    where: { id: conversacion.id },
    data: { ultimoMensajeAt: new Date(), cerrada: false },
  });

  return r;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectaLudopatia(texto: string): boolean {
  const lower = texto.toLowerCase();
  return LUDOPATIA_TRIGGERS.some((t) => lower.includes(t));
}

async function enviarRespuesta(input: {
  conversacionId: string;
  to: string;
  texto: string;
  generadoConIA: boolean;
  modeloIA?: string;
  tokensUsados?: number | null;
  fueDerivado?: boolean;
}): Promise<{ ok: boolean; respuesta?: string; derivado?: boolean }> {
  // Persistir en BD primero (audit trail) — el envío puede fallar pero queda
  // registrada la respuesta del bot.
  await prisma.mensajeBot.create({
    data: {
      conversacionId: input.conversacionId,
      rol: "ASSISTANT",
      contenido: input.texto,
      generadoConIA: input.generadoConIA,
      modeloIA: input.modeloIA ?? null,
      tokensUsados: input.tokensUsados ?? null,
      fueDerivado: input.fueDerivado ?? false,
    },
  });

  if (!isWhatsAppConfigured()) {
    return { ok: false, respuesta: input.texto, derivado: input.fueDerivado };
  }
  const wa = new WhatsAppBusinessClient();
  const r = await wa.enviarMensajeTexto({ to: input.to, body: input.texto });
  if (!r.ok) {
    logger.warn(
      { reason: r.reason, source: "bot:faq" },
      "enviarRespuesta: WhatsApp send falló",
    );
    return { ok: false, respuesta: input.texto, derivado: input.fueDerivado };
  }
  return { ok: true, respuesta: input.texto, derivado: input.fueDerivado };
}

async function notificarAdminConsultaDerivada(
  conversacionId: string,
): Promise<void> {
  const conv = await prisma.conversacionBot.findUnique({
    where: { id: conversacionId },
    include: {
      mensajes: { orderBy: { creadoEn: "desc" }, take: 8 },
      usuario: true,
    },
  });
  if (!conv) return;

  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    logger.warn(
      { source: "bot:faq" },
      "notificarAdminConsultaDerivada: ADMIN_EMAIL no configurado, skip",
    );
    return;
  }

  const userLabel = conv.usuario?.email ?? conv.whatsappFrom;
  const mensajesRecientes = [...conv.mensajes].reverse();
  const html = `<p>El bot derivó una consulta a humano.</p>
<p><strong>Usuario:</strong> ${escapeHtml(userLabel)} (${escapeHtml(conv.whatsappFrom)})</p>
<h3>Últimos mensajes:</h3>
<ul>
  ${mensajesRecientes
    .map(
      (m) =>
        `<li><strong>${m.rol === "USER" ? "Usuario" : "Bot"}:</strong> ${escapeHtml(m.contenido).slice(0, 800)}</li>`,
    )
    .join("")}
</ul>
<p>Responde directamente al WhatsApp del usuario o desde la consola de WhatsApp Business.</p>`;
  const text = mensajesRecientes
    .map(
      (m) => `[${m.rol}] ${m.contenido.slice(0, 200)}`,
    )
    .join("\n");

  await enviarEmail({
    to: adminEmail,
    subject: `[Habla!] Bot derivó consulta · ${userLabel}`,
    html,
    text,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
