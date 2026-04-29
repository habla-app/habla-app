// Servicio de notificaciones + preferencias.
//
// Responsabilidades:
//  - Obtener / actualizar PreferenciasNotif del usuario (con defaults).
//  - Helper `debeNotificar(usuarioId, tipo)` que SIEMPRE se consulta antes
//    de despachar un email. Si no existen preferencias para el usuario,
//    devuelve TRUE (default opt-in vía schema).
//  - Wrappers específicos (`notifyTorneoCancelado`,
//    `notifySolicitudEliminar`, etc.) fire-and-forget para que el caller
//    (transacción atómica) no bloquee su commit esperando el email.
//
// Lote 3 (Abr 2026): se quitaron los wrappers de canje (`notifyCanjeEnviado`,
// `notifyCanjeEntregado`) y el `notifyPremioGanado` (reemplazado por
// `notifyPremioMensualGanado` en Lote 5 — abajo). La columna
// `PreferenciasNotif.notifVencimientos` se dropeó del schema.
//
// Lote 4 (Abr 2026): se quitaron `notifyAuditoriaContable` y
// `notifyBackupFallo` junto con la demolición de la auditoría contable.
// Si volvemos a querer alertas internas, se recrean en Lote 6 con el
// sistema de eventos in-house.
//
// Lote 5 (May 2026): `notifyPremioMensualGanado` notifica al ganador de
// un premio del leaderboard mensual. El payload viene completo desde el
// service (no se reconsulta nada) — el caller es el cron J o el endpoint
// admin de cierre. Respeta `notifPremios` por defecto opt-in.

import { prisma } from "@habla/db";
import { enviarEmail } from "./email.service";
import {
  criticosResumenTemplate,
  cuentaEliminadaTemplate,
  datosDescargadosTemplate,
  premioMensualGanadoTemplate,
  solicitudEliminarTemplate,
  torneoCanceladoTemplate,
  type CriticosResumenInput,
} from "../emails/templates";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Preferencias
// ---------------------------------------------------------------------------

export const PREFERENCIAS_DEFAULT = {
  notifInicioTorneo: true,
  notifResultados: true,
  notifPremios: true,
  notifSugerencias: true,
  notifCierreTorneo: true,
  notifPromos: false,
  emailSemanal: false,
} as const;

export type PreferenciasKey = keyof typeof PREFERENCIAS_DEFAULT;

export interface PreferenciasNotificaciones {
  usuarioId: string;
  notifInicioTorneo: boolean;
  notifResultados: boolean;
  notifPremios: boolean;
  notifSugerencias: boolean;
  notifCierreTorneo: boolean;
  notifPromos: boolean;
  emailSemanal: boolean;
}

export async function obtenerPreferencias(
  usuarioId: string,
): Promise<PreferenciasNotificaciones> {
  const existente = await prisma.preferenciasNotif.findUnique({
    where: { usuarioId },
  });
  if (existente) {
    return { ...existente };
  }
  const creada = await prisma.preferenciasNotif.create({
    data: { usuarioId, ...PREFERENCIAS_DEFAULT },
  });
  return { ...creada };
}

export interface ActualizarPreferenciasInput {
  notifInicioTorneo?: boolean;
  notifResultados?: boolean;
  notifPremios?: boolean;
  notifSugerencias?: boolean;
  notifCierreTorneo?: boolean;
  notifPromos?: boolean;
  emailSemanal?: boolean;
}

export async function actualizarPreferencias(
  usuarioId: string,
  patch: ActualizarPreferenciasInput,
): Promise<PreferenciasNotificaciones> {
  const actualizada = await prisma.preferenciasNotif.upsert({
    where: { usuarioId },
    create: { usuarioId, ...PREFERENCIAS_DEFAULT, ...patch },
    update: patch,
  });
  return { ...actualizada };
}

export async function debeNotificar(
  usuarioId: string,
  tipo: PreferenciasKey,
): Promise<boolean> {
  const prefs = await prisma.preferenciasNotif.findUnique({
    where: { usuarioId },
    select: {
      notifInicioTorneo: true,
      notifResultados: true,
      notifPremios: true,
      notifSugerencias: true,
      notifCierreTorneo: true,
      notifPromos: true,
      emailSemanal: true,
    },
  });
  const valor = prefs
    ? (prefs as Record<string, boolean>)[tipo] ?? PREFERENCIAS_DEFAULT[tipo]
    : PREFERENCIAS_DEFAULT[tipo];
  return Boolean(valor);
}

async function obtenerDestinatario(
  usuarioId: string,
): Promise<{ email: string; nombre: string } | null> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { email: true, nombre: true, deletedAt: true },
  });
  if (!u) return null;
  if (u.deletedAt) return null;
  if (!u.email) return null;
  return { email: u.email, nombre: u.nombre };
}

// ---------------------------------------------------------------------------
// Wrappers por evento — fire-and-forget
// ---------------------------------------------------------------------------

export async function notifyTorneoCancelado(input: {
  usuarioId: string;
  torneoNombre: string;
  partido: string;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifResultados"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = torneoCanceladoTemplate({
      nombreUsuario: destinatario.nombre,
      torneoNombre: input.torneoNombre,
      partido: input.partido,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyTorneoCancelado: error");
  }
}

export async function notifySolicitudEliminar(input: {
  usuarioId: string;
  tokenUrl: string;
}): Promise<void> {
  try {
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = solicitudEliminarTemplate({
      nombreUsuario: destinatario.nombre,
      tokenUrl: input.tokenUrl,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifySolicitudEliminar: error");
  }
}

export async function notifyDatosDescargados(input: {
  usuarioId: string;
  urlDescarga: string;
  expiraEnHoras: number;
}): Promise<void> {
  try {
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = datosDescargadosTemplate({
      nombreUsuario: destinatario.nombre,
      urlDescarga: input.urlDescarga,
      expiraEnHoras: input.expiraEnHoras,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyDatosDescargados: error");
  }
}

export async function notifyPremioMensualGanado(input: {
  userId: string;
  email: string;
  username: string;
  posicion: number;
  montoSoles: number;
  mesKey: string;
  nombreMes: string;
  nombreMesSiguiente: string;
  /** Monto del 1° puesto — para el cierre motivacional del email. */
  premioPrimerPuestoSoles?: number;
}): Promise<void> {
  try {
    if (input.montoSoles <= 0) return; // dummies de inspección no notifican
    if (!(await debeNotificar(input.userId, "notifPremios"))) return;
    if (!input.email) return;
    const tpl = premioMensualGanadoTemplate({
      username: input.username,
      posicion: input.posicion,
      nombreMes: input.nombreMes,
      nombreMesSiguiente: input.nombreMesSiguiente,
      montoSoles: input.montoSoles,
      premioPrimerPuestoSoles: input.premioPrimerPuestoSoles ?? 500,
    });
    await enviarEmail({ to: input.email, ...tpl });
  } catch (err) {
    logger.error(
      { err, userId: input.userId, mes: input.mesKey },
      "notifyPremioMensualGanado: error",
    );
  }
}

/**
 * Lote 6 — alerta a ADMIN_ALERT_EMAIL cuando hubo > 0 errores `level=critical`
 * en la última hora. Lo dispara el cron M (instrumentation.ts) con su propio
 * anti-spam (no manda más de 1 vez por hora).
 *
 * No respeta `PreferenciasNotif` — es un email operativo, no transaccional
 * de usuario. El destinatario es el admin definido en env, no un Usuario.
 */
export async function notifyCriticosResumen(
  input: CriticosResumenInput,
): Promise<void> {
  try {
    const to = process.env.ADMIN_ALERT_EMAIL;
    if (!to) {
      logger.warn(
        { source: "notify:criticos-resumen" },
        "ADMIN_ALERT_EMAIL no configurado — skip alerta crítica",
      );
      return;
    }
    const tpl = criticosResumenTemplate(input);
    await enviarEmail({ to, ...tpl });
  } catch (err) {
    // Importante: este logger.error podría re-disparar log_errores → cron M.
    // Por eso el `source` es "notify:criticos-resumen" y el hook del logger
    // hace skip si source.startsWith("logs"|"analytics") — pero "notify"
    // SÍ se persiste (raro pero no debería loopearse en práctica porque
    // el envío fallido no genera un nuevo crítico).
    logger.error({ err, source: "notify:criticos-resumen" }, "notifyCriticosResumen: error");
  }
}

/**
 * Confirmación post-eliminación de cuenta. Recibe email + nombre EXPLÍCITOS
 * porque al llamarse el usuario puede estar ya anonimizado/borrado.
 */
export async function notifyCuentaEliminada(input: {
  email: string;
  nombre: string;
  modo: "hard" | "soft";
}): Promise<void> {
  try {
    if (!input.email) return;
    const tpl = cuentaEliminadaTemplate({
      nombreUsuario: input.nombre || "Hola",
      modo: input.modo,
    });
    await enviarEmail({ to: input.email, ...tpl });
  } catch (err) {
    logger.error({ err, email: input.email }, "notifyCuentaEliminada: error");
  }
}

