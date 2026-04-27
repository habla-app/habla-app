// Servicio de notificaciones + preferencias — Sub-Sprint 7 + integración SS6.
//
// Responsabilidades:
//  - Obtener / actualizar PreferenciasNotif del usuario (con defaults).
//  - Helper `debeNotificar(usuarioId, tipo)` que SIEMPRE se consulta antes de
//    despachar un email (convención §14). Si no existen preferencias para el
//    usuario, devuelve TRUE (default de opt-out: el registro se crea con los
//    booleans por defecto del schema).
//  - Wrappers específicos (`notifyPremioGanado`, `notifyCanjeSolicitado`, etc.)
//    que encadenan: obtener user + email → chequear preferencia → renderizar
//    template → enviar. Cada wrapper acepta los inputs mínimos y resuelve
//    internamente los datos necesarios (nombre de usuario).
//
// Diseño: los wrappers son fire-and-forget para que el caller (transacción
// atómica) no bloquee su commit esperando el email. Si el email falla, logger
// emite error pero la transacción principal sigue OK.

import { prisma } from "@habla/db";
import { enviarEmail } from "./email.service";
import {
  auditoriaAlertaTemplate,
  auditoriaContableAlertaTemplate,
  backupFalloTemplate,
  canjeEnviadoTemplate,
  canjeEntregadoTemplate,
  canjeSolicitadoTemplate,
  cuentaEliminadaTemplate,
  datosDescargadosTemplate,
  lukasVencidosTemplate,
  lukasPorVencer30dTemplate,
  lukasPorVencer7dTemplate,
  premioGanadoTemplate,
  solicitudEliminarTemplate,
  torneoCanceladoTemplate,
  verifCodigoSmsEmailTemplate,
  type AuditoriaAlertaInput,
  type AuditoriaContableAlertaInput,
  type BackupFalloInput,
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
  notifVencimientos: true, // Lote 6A: avisos de vencimiento de Lukas comprados
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
  notifVencimientos: boolean; // Lote 6A
}

/** Lee las preferencias de un usuario. Si no existe registro, crea uno con defaults. */
export async function obtenerPreferencias(
  usuarioId: string,
): Promise<PreferenciasNotificaciones> {
  const existente = await prisma.preferenciasNotif.findUnique({
    where: { usuarioId },
  });
  if (existente) {
    return { ...existente };
  }
  // Upsert-like: crea con defaults y devuelve.
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

/**
 * Decide si un usuario debe recibir una notificación de cierto tipo.
 * Si no tiene preferencias en BD, usa los defaults. Opcionalmente skippea
 * usuarios sin email o soft-deleted.
 */
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
      notifVencimientos: true,
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

export async function notifyPremioGanado(input: {
  usuarioId: string;
  torneoNombre: string;
  posicion: number;
  premioLukas: number;
  partido: string;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifPremios"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = premioGanadoTemplate({
      nombreGanador: destinatario.nombre,
      torneoNombre: input.torneoNombre,
      posicion: input.posicion,
      premioLukas: input.premioLukas,
      partido: input.partido,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyPremioGanado: error");
  }
}

export async function notifyCanjeSolicitado(input: {
  usuarioId: string;
  nombrePremio: string;
  lukasUsados: number;
  requiereDireccion: boolean;
}): Promise<void> {
  try {
    // Canjes se notifican siempre — son transacciones del usuario,
    // no promos. Respetamos notifResultados (categoría más cercana).
    if (!(await debeNotificar(input.usuarioId, "notifResultados"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = canjeSolicitadoTemplate({
      nombreUsuario: destinatario.nombre,
      nombrePremio: input.nombrePremio,
      lukasUsados: input.lukasUsados,
      requiereDireccion: input.requiereDireccion,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyCanjeSolicitado: error");
  }
}

export async function notifyCanjeEnviado(input: {
  usuarioId: string;
  nombrePremio: string;
  metodo: string;
  codigoSeguimiento?: string;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifResultados"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = canjeEnviadoTemplate({
      nombreUsuario: destinatario.nombre,
      nombrePremio: input.nombrePremio,
      metodo: input.metodo,
      codigoSeguimiento: input.codigoSeguimiento,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyCanjeEnviado: error");
  }
}

export async function notifyCanjeEntregado(input: {
  usuarioId: string;
  nombrePremio: string;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifResultados"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = canjeEntregadoTemplate({
      nombreUsuario: destinatario.nombre,
      nombrePremio: input.nombrePremio,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyCanjeEntregado: error");
  }
}

export async function notifyTorneoCancelado(input: {
  usuarioId: string;
  torneoNombre: string;
  partido: string;
  entradaReembolsada: number;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifResultados"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = torneoCanceladoTemplate({
      nombreUsuario: destinatario.nombre,
      torneoNombre: input.torneoNombre,
      partido: input.partido,
      entradaReembolsada: input.entradaReembolsada,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyTorneoCancelado: error");
  }
}

export async function notifyVerifCodigoEmail(input: {
  usuarioId: string;
  codigo: string;
  expiraEnMin: number;
}): Promise<void> {
  try {
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = verifCodigoSmsEmailTemplate({
      nombreUsuario: destinatario.nombre,
      codigo: input.codigo,
      expiraEnMin: input.expiraEnMin,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyVerifCodigoEmail: error");
  }
}

export async function notifySolicitudEliminar(input: {
  usuarioId: string;
  tokenUrl: string;
  balanceLukas: number;
}): Promise<void> {
  try {
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = solicitudEliminarTemplate({
      nombreUsuario: destinatario.nombre,
      tokenUrl: input.tokenUrl,
      balanceLukas: input.balanceLukas,
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

/**
 * Confirmación post-eliminación de cuenta (Mini-lote 7.6). A diferencia
 * de los otros wrappers, recibe email + nombre EXPLÍCITOS porque al
 * llamarse el usuario puede estar ya anonimizado (soft delete) o borrado
 * (hard delete) — no podemos resolverlo desde la BD por usuarioId.
 *
 * El caller (`eliminarCuentaInmediato`) lee email + nombre antes de la
 * transacción y los pasa acá como fire-and-forget.
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

// ---------------------------------------------------------------------------
// Wrappers de vencimiento de Lukas — Lote 6A
// ---------------------------------------------------------------------------

/** Avisa que una compra de Lukas ya venció y el saldo se descontó. */
export async function notifyLukasVencidos(input: {
  usuarioId: string;
  monto: number;
  fechaCompra: Date;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifVencimientos"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const tpl = lukasVencidosTemplate({
      nombreUsuario: destinatario.nombre,
      monto: input.monto,
      fechaCompra: input.fechaCompra,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyLukasVencidos: error");
  }
}

/** Avisa que una compra de Lukas está próxima a vencer (30d o 7d). */
export async function notifyLukasPorVencer(input: {
  usuarioId: string;
  monto: number;
  venceEn: Date;
  dias: 7 | 30;
}): Promise<void> {
  try {
    if (!(await debeNotificar(input.usuarioId, "notifVencimientos"))) return;
    const destinatario = await obtenerDestinatario(input.usuarioId);
    if (!destinatario) return;
    const templateFn =
      input.dias === 7 ? lukasPorVencer7dTemplate : lukasPorVencer30dTemplate;
    const tpl = templateFn({
      nombreUsuario: destinatario.nombre,
      monto: input.monto,
      venceEn: input.venceEn,
      diasRestantes: input.dias,
    });
    await enviarEmail({ to: destinatario.email, ...tpl });
  } catch (err) {
    logger.error({ err, usuarioId: input.usuarioId }, "notifyLukasPorVencer: error");
  }
}

// ---------------------------------------------------------------------------
// Auditoría de balances — alerta interna al admin (Lote 6C-fix3)
// ---------------------------------------------------------------------------

/**
 * Envía una alerta por email al admin cuando la auditoría diaria detecta
 * hallazgos. Destinatario configurable vía env var `ADMIN_ALERT_EMAIL`. Si
 * no está seteada, loggea warn y NO envía (no rompe el cron).
 *
 * NO consulta `PreferenciasNotif` — es una notificación interna del sistema,
 * no del usuario.
 */
export async function enviarAlertaAuditoria(
  input: AuditoriaAlertaInput,
): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    logger.warn(
      {
        totalHallazgos: input.totalHallazgos,
        usuariosConProblemas: input.usuariosConProblemas,
      },
      "auditoria: ADMIN_ALERT_EMAIL no configurado, alerta NO enviada",
    );
    return;
  }
  try {
    const tpl = auditoriaAlertaTemplate(input);
    await enviarEmail({ to, ...tpl });
    logger.info(
      {
        to,
        totalHallazgos: input.totalHallazgos,
        usuariosConProblemas: input.usuariosConProblemas,
      },
      "auditoria: alerta enviada por email",
    );
  } catch (err) {
    logger.error({ err }, "enviarAlertaAuditoria: error");
  }
}

// ---------------------------------------------------------------------------
// Backups — alerta interna al admin (Lote 7)
// ---------------------------------------------------------------------------

/**
 * Envía email al admin cuando el job de backup falla 2 veces consecutivas.
 * Destinatario configurable vía env var `ADMIN_ALERT_EMAIL`. Si no está
 * seteada, loggea warn y NO envía (no rompe el cron).
 *
 * NO consulta `PreferenciasNotif` — es alerta de operación, no del usuario.
 */
export async function notifyBackupFallo(
  input: BackupFalloInput,
): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    logger.warn(
      { intentos: input.intentos.length },
      "backup: ADMIN_ALERT_EMAIL no configurado, alerta NO enviada",
    );
    return;
  }
  try {
    const tpl = backupFalloTemplate(input);
    await enviarEmail({ to, ...tpl });
    logger.info(
      { to, intentos: input.intentos.length },
      "backup: alerta de fallos consecutivos enviada por email",
    );
  } catch (err) {
    logger.error({ err }, "notifyBackupFallo: error");
  }
}

// ---------------------------------------------------------------------------
// Auditoría contable (Lote 8 §2.D) — alerta interna
// ---------------------------------------------------------------------------

/**
 * Envía email al admin cuando Job I detecta hallazgos `error` 2 veces
 * seguidas. NO consulta `PreferenciasNotif` — operación interna del sistema.
 */
export async function notifyAuditoriaContable(
  input: AuditoriaContableAlertaInput,
): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    logger.warn(
      { errores: input.errores, warns: input.warns },
      "auditoria-contable: ADMIN_ALERT_EMAIL no configurado, alerta NO enviada",
    );
    return;
  }
  try {
    const tpl = auditoriaContableAlertaTemplate(input);
    await enviarEmail({ to, ...tpl });
    logger.info(
      { to, errores: input.errores, warns: input.warns },
      "auditoria-contable: alerta enviada por email",
    );
  } catch (err) {
    logger.error({ err }, "notifyAuditoriaContable: error");
  }
}
