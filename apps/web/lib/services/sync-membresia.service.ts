// Cron sync de membresía Channel ↔ suscripciones — Lote E (May 2026).
//
// Frecuencia: cada hora (cron Q en instrumentation.ts).
//
// Sub-tareas:
//   1. invites pendientes  → re-enviar invite link a suscriptores que no se
//                            unieron en >24h.
//   2. vencimientos         → marcar VENCIDA + remover acceso al Channel.
//   3. cancelaciones efectivas → marcar acceso revocado tras pasar
//                                vencimiento.
//   4. pagos fallidos persistentes → marcar FALLIDA tras 3 reintentos
//                                    OpenPay sin éxito.
//   5. expirar garantía 7 días → flippear `enGarantia=false`.
//
// Email batch al admin con los usuarios a remover manualmente del Channel
// (WhatsApp Channels no expone API de gestión de membresía al momento).

import { prisma, type Suscripcion, type Usuario } from "@habla/db";

import { logger } from "./logger";
import { track } from "./analytics.service";
import { enviarEmail, enviarEmailFalloPago } from "./email.service";
import { reenviarInviteChannel } from "./whatsapp/picks-distribuidor.service";
import {
  expirarGarantias,
  listarCancelacionesEfectivas,
  listarVencidas,
  marcarCancelacionEfectiva,
  marcarVencida,
} from "./suscripciones.service";

const REINVITE_AFTER_HOURS = 24;
const MAX_INVITES = 3;

export interface SyncReporte {
  invites_reenviados: number;
  vencimientos_procesados: number;
  cancelaciones_efectivas: number;
  pagos_fallidos_marcados: number;
  garantias_expiradas: number;
  errores: number;
  duracionMs: number;
}

export async function syncMembresiaChannel(): Promise<SyncReporte> {
  const inicio = Date.now();
  logger.info({ source: "cron:sync-membresia" }, "sync membresía: inicio");

  const reporte: SyncReporte = {
    invites_reenviados: 0,
    vencimientos_procesados: 0,
    cancelaciones_efectivas: 0,
    pagos_fallidos_marcados: 0,
    garantias_expiradas: 0,
    errores: 0,
    duracionMs: 0,
  };

  const usuariosARemover: Array<{
    suscripcion: Suscripcion;
    usuario: Usuario;
    motivo: "VENCIMIENTO" | "CANCELACION_EFECTIVA" | "PAGO_FALLIDO";
  }> = [];

  // -------------------------------------------------------------------------
  // 1. Invites pendientes
  // -------------------------------------------------------------------------
  try {
    const desde = new Date(Date.now() - REINVITE_AFTER_HOURS * 3600 * 1000);
    const pendientes = await prisma.miembroChannel.findMany({
      where: {
        estado: { in: ["INVITADO", "REINVITADO"] },
        ultimoInviteAt: { lt: desde },
        invitesEnviados: { lt: MAX_INVITES },
        suscripcion: { activa: true },
      },
      include: {
        suscripcion: { include: { usuario: true } },
      },
    });

    for (const m of pendientes) {
      try {
        const tel = m.suscripcion.usuario.telefono;
        if (!tel) continue;
        await reenviarInviteChannel({
          usuarioId: m.suscripcion.usuarioId,
          telefono: tel,
          nombre: m.suscripcion.usuario.nombre,
        });
        await prisma.miembroChannel.update({
          where: { id: m.id },
          data: {
            estado: "REINVITADO",
            invitesEnviados: { increment: 1 },
            ultimoInviteAt: new Date(),
          },
        });
        reporte.invites_reenviados++;
      } catch (err) {
        logger.error(
          { err, miembroId: m.id, source: "cron:sync-membresia" },
          "invite pendiente falló",
        );
        reporte.errores++;
      }
    }
  } catch (err) {
    logger.error(
      { err, source: "cron:sync-membresia" },
      "sub-task invites pendientes falló",
    );
    reporte.errores++;
  }

  // -------------------------------------------------------------------------
  // 2. Vencimientos
  // -------------------------------------------------------------------------
  try {
    const vencidas = await listarVencidas();
    for (const sus of vencidas) {
      try {
        await marcarVencida(sus.id);
        const u = await prisma.usuario.findUnique({ where: { id: sus.usuarioId } });
        if (u) {
          usuariosARemover.push({ suscripcion: sus, usuario: u, motivo: "VENCIMIENTO" });
        }
        void track({
          evento: "suscripcion_vencida_detectada",
          userId: sus.usuarioId,
          props: { suscripcionId: sus.id },
        });
        reporte.vencimientos_procesados++;
      } catch (err) {
        logger.error(
          { err, suscripcionId: sus.id, source: "cron:sync-membresia" },
          "vencimiento falló",
        );
        reporte.errores++;
      }
    }
  } catch (err) {
    logger.error(
      { err, source: "cron:sync-membresia" },
      "sub-task vencimientos falló",
    );
    reporte.errores++;
  }

  // -------------------------------------------------------------------------
  // 3. Cancelaciones efectivas
  // -------------------------------------------------------------------------
  try {
    const cancelaciones = await listarCancelacionesEfectivas();
    for (const sus of cancelaciones) {
      try {
        await marcarCancelacionEfectiva(sus.id);
        const u = await prisma.usuario.findUnique({ where: { id: sus.usuarioId } });
        if (u) {
          usuariosARemover.push({
            suscripcion: sus,
            usuario: u,
            motivo: "CANCELACION_EFECTIVA",
          });
        }
        void track({
          evento: "suscripcion_cancelacion_efectiva",
          userId: sus.usuarioId,
          props: { suscripcionId: sus.id },
        });
        reporte.cancelaciones_efectivas++;
      } catch (err) {
        logger.error(
          { err, suscripcionId: sus.id, source: "cron:sync-membresia" },
          "cancelación efectiva falló",
        );
        reporte.errores++;
      }
    }
  } catch (err) {
    logger.error(
      { err, source: "cron:sync-membresia" },
      "sub-task cancelaciones efectivas falló",
    );
    reporte.errores++;
  }

  // -------------------------------------------------------------------------
  // 4. Pagos fallidos persistentes
  // -------------------------------------------------------------------------
  try {
    const desde = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const susConFallosPersistentes = await prisma.suscripcion.findMany({
      where: {
        activa: true,
        pagos: {
          some: {
            estado: "RECHAZADO",
            intentos: { gte: 3 },
            fecha: { gte: desde },
          },
          none: {
            estado: "PAGADO",
            fecha: { gte: desde },
          },
        },
      },
      include: { usuario: true },
    });
    for (const sus of susConFallosPersistentes) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.suscripcion.update({
            where: { id: sus.id },
            data: { estado: "FALLIDA", activa: false },
          });
          await tx.miembroChannel.updateMany({
            where: {
              suscripcionId: sus.id,
              estado: { in: ["INVITADO", "REINVITADO", "UNIDO"] },
            },
            data: { estado: "REMOVIDO", removidoEn: new Date() },
          });
        });
        if (sus.usuario) {
          usuariosARemover.push({
            suscripcion: sus,
            usuario: sus.usuario,
            motivo: "PAGO_FALLIDO",
          });
          await enviarEmailFalloPago({
            email: sus.usuario.email,
            nombre: sus.usuario.nombre,
            motivo: "Tu tarjeta fue rechazada en varios intentos. La suscripción se desactivó.",
          });
        }
        void track({
          evento: "suscripcion_pagos_fallidos_marcada",
          userId: sus.usuarioId,
          props: { suscripcionId: sus.id },
        });
        reporte.pagos_fallidos_marcados++;
      } catch (err) {
        logger.error(
          { err, suscripcionId: sus.id, source: "cron:sync-membresia" },
          "pagos fallidos falló",
        );
        reporte.errores++;
      }
    }
  } catch (err) {
    logger.error(
      { err, source: "cron:sync-membresia" },
      "sub-task pagos fallidos falló",
    );
    reporte.errores++;
  }

  // -------------------------------------------------------------------------
  // 5. Expirar garantía 7 días
  // -------------------------------------------------------------------------
  try {
    reporte.garantias_expiradas = await expirarGarantias();
  } catch (err) {
    logger.error(
      { err, source: "cron:sync-membresia" },
      "sub-task expirar garantías falló",
    );
    reporte.errores++;
  }

  // -------------------------------------------------------------------------
  // 6. Email batch al admin si hay usuarios a remover del Channel
  // -------------------------------------------------------------------------
  if (usuariosARemover.length > 0) {
    await enviarReporteAdmin(usuariosARemover);
  }

  reporte.duracionMs = Date.now() - inicio;
  logger.info(
    { ...reporte, source: "cron:sync-membresia" },
    "sync membresía: fin",
  );
  void track({
    evento: "cron_sync_membresia_ejecutado",
    props: { ...reporte },
  });

  return reporte;
}

async function enviarReporteAdmin(
  items: Array<{
    suscripcion: Suscripcion;
    usuario: Usuario;
    motivo: "VENCIMIENTO" | "CANCELACION_EFECTIVA" | "PAGO_FALLIDO";
  }>,
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    logger.warn(
      { source: "cron:sync-membresia" },
      "enviarReporteAdmin: ADMIN_EMAIL no configurado, skip",
    );
    return;
  }
  const filas = items
    .map(
      (x) => `<li>
      <strong>${escapeHtml(x.usuario.nombre)}</strong> (${escapeHtml(x.usuario.email)})<br>
      Tel: ${escapeHtml(x.usuario.telefono ?? "no registrado")}<br>
      Motivo: ${escapeHtml(x.motivo)} (suscripción ${x.suscripcion.id})
    </li>`,
    )
    .join("");
  const html = `<h2>Sync membresía Channel · ${new Date().toLocaleString("es-PE")}</h2>
<p>Estos usuarios deben ser removidos manualmente del WhatsApp Channel "Habla! Picks":</p>
<ul>${filas}</ul>
<p><strong>Pasos para removerlos:</strong></p>
<ol>
  <li>Abrir el WhatsApp Channel en tu teléfono.</li>
  <li>Channel info → Members.</li>
  <li>Tap en cada usuario de la lista → Remove.</li>
</ol>`;
  const text = items
    .map(
      (x) =>
        `${x.usuario.nombre} <${x.usuario.email}> tel ${x.usuario.telefono ?? "n/a"} · ${x.motivo}`,
    )
    .join("\n");

  await enviarEmail({
    to: adminEmail,
    subject: `[Habla!] Sync membresía: ${items.length} usuario${items.length === 1 ? "" : "s"} a remover del Channel`,
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
