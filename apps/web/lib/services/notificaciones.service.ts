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
// `notifyCanjeEntregado`) y el `notifyPremioGanado` (será reemplazado por
// `notifyPremioMensualGanado` en Lote 5). La columna
// `PreferenciasNotif.notifVencimientos` se dropeó del schema.
//
// Lote 4 (Abr 2026): se quitaron `notifyAuditoriaContable` y
// `notifyBackupFallo` junto con la demolición de la auditoría contable.
// Si volvemos a querer alertas internas, se recrean en Lote 6 con el
// sistema de eventos in-house.

import { prisma } from "@habla/db";
import { enviarEmail } from "./email.service";
import {
  cuentaEliminadaTemplate,
  datosDescargadosTemplate,
  solicitudEliminarTemplate,
  torneoCanceladoTemplate,
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

