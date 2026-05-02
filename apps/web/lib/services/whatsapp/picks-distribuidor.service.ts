// Distribuidor de picks aprobados → bot 1:1 + flag para Channel manual.
// Lote E (May 2026).
//
// Flujo:
//   1. Admin aprueba un pick desde /admin/picks-premium (Lote F).
//   2. Endpoint `POST /api/v1/admin/picks-premium/[id]/aprobar` marca el pick
//      como APROBADO y dispara `distribuirPickAprobado(pickId)`.
//   3. Este service:
//      a) Busca todos los suscriptores activos con `telefono` y
//         `notifPremiumPicks=true`.
//      b) Para cada uno, envía el mensaje formateado por bot 1:1 con retry
//         3x. El watermark es el email del suscriptor.
//      c) Marca `enviadoAlChannel=true` en el pick (al menos 1 envío ok).
//      d) Si más del 10% de envíos fallan, log critical (alimenta el cron
//         M de alertas).
//
// El Channel WhatsApp NO se publica automáticamente — el admin pega el
// mensaje manualmente desde la UI (`copiar mensaje al portapapeles`)
// hasta que Meta libere API de Channels.

import { prisma } from "@habla/db";

import { logger } from "@/lib/services/logger";
import { registrarError } from "@/lib/services/logs.service";
import { track } from "@/lib/services/analytics.service";
import { retryConBackoff } from "@/lib/utils/retry";

import { formatearPickPremium } from "./pick-formato";
import { WhatsAppBusinessClient, isWhatsAppConfigured } from "./wa-business-client";

const FAIL_THRESHOLD = 0.1; // 10% de fallos → log critical

export interface DistribucionResult {
  enviadosOk: number;
  fallaron: number;
  total: number;
  /** True si la operación se completó exitosamente (al menos 1 envío ok
   *  y no se superó FAIL_THRESHOLD). */
  exitoso: boolean;
}

/**
 * Envía un pick aprobado a todos los suscriptores activos con teléfono.
 * Idempotente: si el pick ya tiene `enviadoAlChannel=true`, retorna sin
 * reenviar.
 *
 * Nunca tira: errores se registran y se devuelve un reporte. El caller
 * decide si re-disparar.
 */
export async function distribuirPickAprobado(
  pickId: string,
): Promise<DistribucionResult> {
  const pick = await prisma.pickPremium.findUnique({
    where: { id: pickId },
    include: { partido: true, casaRecomendada: true },
  });
  if (!pick) {
    logger.warn(
      { pickId, source: "whatsapp:distribuidor" },
      "distribuirPickAprobado: pick no encontrado",
    );
    return { enviadosOk: 0, fallaron: 0, total: 0, exitoso: false };
  }
  if (!pick.aprobado) {
    logger.warn(
      { pickId, source: "whatsapp:distribuidor" },
      "distribuirPickAprobado: pick no aprobado, skip",
    );
    return { enviadosOk: 0, fallaron: 0, total: 0, exitoso: false };
  }
  // Idempotencia: ya enviado → no reenviar.
  if (pick.enviadoAlChannel) {
    return { enviadosOk: 0, fallaron: 0, total: 0, exitoso: true };
  }

  if (!isWhatsAppConfigured()) {
    logger.warn(
      { pickId, source: "whatsapp:distribuidor" },
      "distribuirPickAprobado: WhatsApp no configurado, skip",
    );
    return { enviadosOk: 0, fallaron: 0, total: 0, exitoso: false };
  }

  // Suscriptores activos con telefono + opt-in de picks.
  const suscriptores = await prisma.suscripcion.findMany({
    where: {
      activa: true,
      usuario: {
        telefono: { not: null },
        preferenciasNotif: { notifPremiumPicks: true },
      },
    },
    include: {
      usuario: { include: { preferenciasNotif: true } },
    },
  });

  if (suscriptores.length === 0) {
    logger.info(
      { pickId, source: "whatsapp:distribuidor" },
      "distribuirPickAprobado: sin suscriptores activos con telefono — solo Channel manual",
    );
    // Igual marcamos enviadoAlChannel=true: ya no quedan envíos por hacer.
    await prisma.pickPremium.update({
      where: { id: pickId },
      data: { enviadoAlChannel: true, enviadoEn: new Date() },
    });
    return { enviadosOk: 0, fallaron: 0, total: 0, exitoso: true };
  }

  const wa = new WhatsAppBusinessClient();
  let enviadosOk = 0;
  let fallaron = 0;

  const results = await Promise.allSettled(
    suscriptores.map(async (sub) => {
      const telefono = sub.usuario.telefono;
      if (!telefono) return; // typed-guard, ya filtrado arriba
      const mensaje = formatearPickPremium(pick, {
        watermark: sub.usuario.email,
      });
      return retryConBackoff(
        async () => {
          const r = await wa.enviarMensajeTexto({ to: telefono, body: mensaje });
          if (!r.ok) {
            // Lanzamos para que retryConBackoff reintente. Excepto en
            // 'unconfigured' (no tiene sentido reintentar).
            if (r.reason === "unconfigured") {
              throw new Error("WhatsApp no configurado");
            }
            throw new Error(`WhatsApp error: ${r.reason} ${r.status ?? ""}`);
          }
          return r;
        },
        {
          intentos: 3,
          delayBaseMs: 2000,
          label: `pick-distribuidor-${sub.id}`,
        },
      );
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") enviadosOk++;
    else fallaron++;
  }

  // Atomic update del flag + timestamp.
  await prisma.pickPremium.update({
    where: { id: pickId },
    data: { enviadoAlChannel: enviadosOk > 0, enviadoEn: new Date() },
  });

  void track({
    evento: "pick_premium_distribuido",
    props: {
      pickId,
      partidoId: pick.partidoId,
      total: suscriptores.length,
      enviadosOk,
      fallaron,
    },
  });

  const failRate = suscriptores.length > 0 ? fallaron / suscriptores.length : 0;
  if (failRate > FAIL_THRESHOLD) {
    await registrarError({
      level: "critical",
      source: "whatsapp:distribuidor",
      message: `Distribución de pick ${pickId} con ${(failRate * 100).toFixed(0)}% de fallos`,
      metadata: { pickId, total: suscriptores.length, enviadosOk, fallaron },
    });
  }

  logger.info(
    { pickId, total: suscriptores.length, enviadosOk, fallaron, source: "whatsapp:distribuidor" },
    "distribuirPickAprobado: completado",
  );

  return {
    enviadosOk,
    fallaron,
    total: suscriptores.length,
    exitoso: enviadosOk > 0 && failRate <= FAIL_THRESHOLD,
  };
}

/**
 * Re-envía el invite link del WhatsApp Channel a un usuario que no se unió
 * tras la primera invitación. Usado por el cron sync (cada 24h).
 *
 * Si no hay teléfono configurado, no hace nada (el invite ya fue mandado por
 * email en activarSuscripcion). Idempotente: el caller actualiza el contador.
 */
export async function reenviarInviteChannel(input: {
  usuarioId: string;
  telefono: string | null;
  nombre: string;
}): Promise<{ ok: boolean }> {
  if (!input.telefono) return { ok: false };
  const channelLink =
    process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? null;
  if (!channelLink) {
    logger.warn(
      { source: "whatsapp:distribuidor" },
      "reenviarInviteChannel: WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK no configurado",
    );
    return { ok: false };
  }
  const wa = new WhatsAppBusinessClient();
  const body = `Hola ${input.nombre}! 👋

Notamos que aún no te uniste al WhatsApp Channel privado *Habla! Picks*. Aquí tu link:

${channelLink}

Una vez dentro vas a recibir 2-4 picks/día con razonamiento y EV+. ¡Te esperamos!

⚠ _Apuesta responsable._`;
  const r = await wa.enviarMensajeTexto({ to: input.telefono, body });
  return { ok: r.ok };
}
