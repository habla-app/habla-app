// Servicio de suscripciones Premium — Lote E (May 2026).
//
// Reemplaza el placeholder Lote C (que devolvía null para todos). Lifecycle
// completo: crear → activar (vía webhook) → cancelar / reembolsar / vencer.
//
// Reglas duras (CLAUDE.md §14-19):
//   - Cero datos de tarjeta tocan el servidor (tokenización OpenPay.js).
//   - Idempotencia obligatoria en webhook handlers (verificar estado antes
//     de mutar).
//   - Atomicidad transaccional cuando se tocan suscripcion + pago + miembro
//     en el mismo flujo (`prisma.$transaction`).
//   - Logs en cada falla con contexto suficiente para debug.
//   - Reintentos para envíos críticos (email bienvenida) — 3 intentos con
//     backoff exponencial.
//
// La firma pública compatible con Lote C (`obtenerEstadoPremium`,
// `tienePremiumActivo`) se preserva para que perfil/comunidad/torneo no
// requieran refactor.

import { prisma, EstadoSuscripcion as PrismaEstadoSuscripcion, type Suscripcion as PrismaSuscripcion } from "@habla/db";
import { OpenPayAdapter } from "./pasarela-pagos/openpay-adapter";
import {
  OPENPAY_PLAN_IDS,
  PLANES_DURACION_DIAS,
  PLANES_PRECIO_CENTIMOS,
  type PlanCode,
} from "./pasarela-pagos/types";
import { enviarEmailBienvenidaPremium, enviarEmailReembolso, enviarEmailRenovacion, enviarEmailFalloPago } from "./email.service";
import { logger } from "./logger";
import { track } from "./analytics.service";
import { ValidacionFallida, NoAutorizado } from "./errors";
import { retryConBackoff } from "@/lib/utils/retry";

// -----------------------------------------------------------------------
// Public types — compat shim con Lote C
// -----------------------------------------------------------------------

export type EstadoSuscripcion = "activa" | "cancelando" | "vencida";
export type PlanSuscripcion = "mensual" | "trimestral" | "anual";

export interface EstadoPremium {
  activa: boolean;
  estado: EstadoSuscripcion;
  plan: PlanSuscripcion;
  /** ISO date del próximo cobro o fecha de fin si está cancelando. */
  proximoCobro: Date;
  /** Link de invitación al WhatsApp Channel privado. */
  channelLink: string | null;
}

function toPlanLower(plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL"): PlanSuscripcion {
  return plan.toLowerCase() as PlanSuscripcion;
}

function mapEstadoPublico(s: PrismaSuscripcion): EstadoSuscripcion {
  if (s.estado === "CANCELANDO") return "cancelando";
  if (s.estado === "ACTIVA") return "activa";
  return "vencida";
}

/**
 * Estado Premium del usuario. Lote C: devolvía null. Lote E: lee la
 * suscripción activa real. Mantiene la firma de Lote C — UI no cambia.
 */
export async function obtenerEstadoPremium(
  userId: string,
): Promise<EstadoPremium | null> {
  const sus = await prisma.suscripcion.findFirst({
    where: { usuarioId: userId, activa: true },
    orderBy: { creadoEn: "desc" },
  });
  if (!sus) return null;
  return {
    activa: sus.activa,
    estado: mapEstadoPublico(sus),
    plan: toPlanLower(sus.plan),
    proximoCobro: sus.proximoCobro ?? sus.vencimiento ?? new Date(),
    channelLink: process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? null,
  };
}

export async function tienePremiumActivo(userId: string): Promise<boolean> {
  const count = await prisma.suscripcion.count({
    where: { usuarioId: userId, activa: true },
  });
  return count > 0;
}

/** Internal: ¿este usuarioId tiene suscripción activa? Helper para bot FAQ. */
export async function esSuscriptorPremium(userId: string): Promise<boolean> {
  return tienePremiumActivo(userId);
}

// -----------------------------------------------------------------------
// Crear suscripción — disparado por POST /api/v1/premium/suscribir
// -----------------------------------------------------------------------

export interface CrearSuscripcionInput {
  usuarioId: string;
  plan: PlanSuscripcion;
  /** Token de tarjeta (OpenPay.js client-side). */
  tokenTarjeta: string;
  /** Device session ID anti-fraude (OpenPay.js client-side). */
  deviceSessionId: string;
  /** Datos del titular para customer en OpenPay. */
  nombre: string;
  email: string;
}

/**
 * Crea la suscripción en OpenPay + fila local en estado PENDIENTE. La
 * activación real (estado=ACTIVA, primer pago acreditado, miembro creado en
 * Channel) ocurre cuando llega el webhook `charge.succeeded`.
 *
 * Idempotencia: si el usuario ya tiene una suscripción activa, lanza
 * ValidacionFallida (NO crea duplicado en OpenPay).
 */
export async function crearSuscripcion(
  input: CrearSuscripcionInput,
): Promise<PrismaSuscripcion> {
  const planEnum = input.plan.toUpperCase() as PlanCode;
  const precio = PLANES_PRECIO_CENTIMOS[planEnum];
  const duracionDias = PLANES_DURACION_DIAS[planEnum];
  if (!precio || !duracionDias) {
    throw new ValidacionFallida(`Plan no soportado: ${input.plan}`);
  }
  if (!OPENPAY_PLAN_IDS[planEnum]) {
    throw new ValidacionFallida(`Plan sin mapping en OpenPay: ${planEnum}`);
  }

  // Idempotencia: ¿ya tiene activa?
  const existente = await prisma.suscripcion.findFirst({
    where: { usuarioId: input.usuarioId, activa: true },
  });
  if (existente) {
    throw new ValidacionFallida(
      "Ya tienes una suscripción activa. Cancela la actual antes de crear una nueva.",
      { suscripcionId: existente.id },
    );
  }

  // Crear en OpenPay (puede tirar OpenPayApiError si la tarjeta es rechazada).
  const openpay = new OpenPayAdapter();
  const result = await openpay.crearSuscripcion({
    usuarioId: input.usuarioId,
    plan: planEnum,
    tokenTarjeta: input.tokenTarjeta,
    deviceSessionId: input.deviceSessionId,
    nombre: input.nombre,
    email: input.email,
  });

  // Calcular fechas: proximoCobro y vencimiento iguales en creación. La
  // garantía 7 días empieza ahora (cron sync flippea enGarantia=false al
  // pasar 7 días).
  const ahora = new Date();
  const proximoCobro = new Date(ahora);
  proximoCobro.setDate(proximoCobro.getDate() + duracionDias);

  const sus = await prisma.suscripcion.create({
    data: {
      usuarioId: input.usuarioId,
      plan: planEnum,
      precio,
      openpaySuscripcionId: result.suscripcionId,
      openpayCustomerId: result.customerId,
      estado: "PENDIENTE",
      activa: false,
      proximoCobro,
      vencimiento: proximoCobro,
      enGarantia: true,
    },
  });

  void track({
    evento: "premium_suscripcion_creada",
    userId: input.usuarioId,
    props: {
      suscripcionId: sus.id,
      plan: planEnum,
      openpaySuscripcionId: result.suscripcionId,
    },
  });

  logger.info(
    {
      suscripcionId: sus.id,
      usuarioId: input.usuarioId,
      plan: planEnum,
      openpaySuscripcionId: result.suscripcionId,
      source: "suscripciones",
    },
    "crearSuscripcion: PENDIENTE creada, esperando webhook",
  );

  return sus;
}

// -----------------------------------------------------------------------
// Activar suscripción — disparado por webhook OpenPay charge.succeeded
// -----------------------------------------------------------------------

/**
 * Activa la suscripción tras confirmación de cobro. Idempotente: si ya está
 * ACTIVA, no hace nada y devuelve la fila actual. También crea el
 * `PagoSuscripcion` correspondiente y la fila inicial en `MiembroChannel`
 * (estado INVITADO).
 *
 * Si ya existe un pago con el mismo `openpayCobroId` (webhook reintentando),
 * no crea duplicado.
 */
export async function activarSuscripcion(input: {
  openpaySuscripcionId: string;
  openpayCobroId: string;
  monto?: number;
  ultimosCuatro?: string | null;
  marcaTarjeta?: string | null;
  metodo?: string | null;
}): Promise<PrismaSuscripcion | null> {
  const sus = await prisma.suscripcion.findUnique({
    where: { openpaySuscripcionId: input.openpaySuscripcionId },
    include: { usuario: true },
  });
  if (!sus) {
    logger.warn(
      {
        openpaySuscripcionId: input.openpaySuscripcionId,
        source: "suscripciones:activar",
      },
      "activarSuscripcion: suscripción no encontrada en BD",
    );
    return null;
  }

  // Idempotencia 1: pago ya registrado.
  const pagoExistente = await prisma.pagoSuscripcion.findUnique({
    where: { openpayCobroId: input.openpayCobroId },
  });
  if (pagoExistente) {
    logger.info(
      {
        suscripcionId: sus.id,
        openpayCobroId: input.openpayCobroId,
        source: "suscripciones:activar",
      },
      "activarSuscripcion: pago ya registrado (idempotencia)",
    );
    return sus;
  }

  const yaEstabaActiva = sus.activa;

  // Transacción atómica: actualizar suscripcion + insertar pago + crear/actualizar miembro.
  const updated = await prisma.$transaction(async (tx) => {
    if (!yaEstabaActiva) {
      await tx.suscripcion.update({
        where: { id: sus.id },
        data: {
          estado: "ACTIVA",
          activa: true,
        },
      });
    }

    await tx.pagoSuscripcion.create({
      data: {
        suscripcionId: sus.id,
        openpayCobroId: input.openpayCobroId,
        openpayMetodo: input.metodo ?? null,
        monto: input.monto ?? sus.precio,
        estado: "PAGADO",
        acreditadoEn: new Date(),
        ultimosCuatro: input.ultimosCuatro ?? null,
        marcaTarjeta: input.marcaTarjeta ?? null,
      },
    });

    if (!yaEstabaActiva) {
      // Solo crear miembro si todavía no existía. No usamos upsert por el
      // unique compuesto (suscripcionId, estado).
      const existente = await tx.miembroChannel.findFirst({
        where: { suscripcionId: sus.id },
      });
      if (!existente) {
        await tx.miembroChannel.create({
          data: {
            suscripcionId: sus.id,
            usuarioId: sus.usuarioId,
            estado: "INVITADO",
            invitesEnviados: 1,
            ultimoInviteAt: new Date(),
          },
        });
      }
    }

    return tx.suscripcion.findUnique({
      where: { id: sus.id },
      include: { usuario: true },
    });
  });

  void track({
    evento: yaEstabaActiva ? "premium_pago_cobrado" : "premium_suscripcion_activada",
    userId: sus.usuarioId,
    props: {
      suscripcionId: sus.id,
      plan: sus.plan,
      monto: input.monto ?? sus.precio,
    },
  });

  // Email de bienvenida solo en la primera activación. Fire-and-forget con
  // retry — no bloquea el handler del webhook.
  if (!yaEstabaActiva && sus.usuario) {
    void retryConBackoff(
      () =>
        enviarEmailBienvenidaPremium({
          email: sus.usuario.email,
          nombre: sus.usuario.nombre,
          plan: sus.plan,
          proximoCobro: sus.proximoCobro ?? new Date(),
        }),
      { intentos: 3, label: "email-bienvenida-premium" },
    ).catch((err) => {
      logger.error(
        { err, suscripcionId: sus.id, source: "suscripciones:activar" },
        "activarSuscripcion: email de bienvenida falló tras retries",
      );
    });
  } else if (yaEstabaActiva && sus.usuario) {
    // Cobro recurrente: email de renovación. Fire-and-forget.
    void retryConBackoff(
      () =>
        enviarEmailRenovacion({
          email: sus.usuario.email,
          nombre: sus.usuario.nombre,
          plan: sus.plan,
          proximoCobro: sus.proximoCobro ?? new Date(),
          monto: input.monto ?? sus.precio,
        }),
      { intentos: 3, label: "email-renovacion-premium" },
    ).catch((err) => {
      logger.error(
        { err, suscripcionId: sus.id, source: "suscripciones:activar" },
        "activarSuscripcion: email renovación falló",
      );
    });
  }

  logger.info(
    {
      suscripcionId: sus.id,
      yaEstabaActiva,
      source: "suscripciones",
    },
    "activarSuscripcion: ok",
  );

  return updated;
}

// -----------------------------------------------------------------------
// Webhook helper — pago rechazado
// -----------------------------------------------------------------------

/**
 * Marca el cobro como RECHAZADO. Si es el primer cobro (suscripcion
 * todavía PENDIENTE), marca la suscripción como FALLIDA. Si es un cobro
 * recurrente, OpenPay reintenta automáticamente — solo registramos el
 * intento.
 */
export async function registrarPagoFallido(input: {
  openpaySuscripcionId: string;
  openpayCobroId: string;
  monto?: number;
  codigoError?: string | null;
  mensajeError?: string | null;
}): Promise<void> {
  const sus = await prisma.suscripcion.findUnique({
    where: { openpaySuscripcionId: input.openpaySuscripcionId },
    include: { usuario: true },
  });
  if (!sus) {
    logger.warn(
      { ...input, source: "suscripciones:rechazo" },
      "registrarPagoFallido: suscripción no encontrada",
    );
    return;
  }

  // Idempotencia: pago ya registrado.
  const existente = await prisma.pagoSuscripcion.findUnique({
    where: { openpayCobroId: input.openpayCobroId },
  });

  await prisma.$transaction(async (tx) => {
    if (existente) {
      await tx.pagoSuscripcion.update({
        where: { id: existente.id },
        data: {
          estado: "RECHAZADO",
          intentos: { increment: 1 },
          rechazadoEn: new Date(),
          codigoError: input.codigoError ?? existente.codigoError,
          mensajeError: input.mensajeError ?? existente.mensajeError,
        },
      });
    } else {
      await tx.pagoSuscripcion.create({
        data: {
          suscripcionId: sus.id,
          openpayCobroId: input.openpayCobroId,
          monto: input.monto ?? sus.precio,
          estado: "RECHAZADO",
          rechazadoEn: new Date(),
          codigoError: input.codigoError ?? null,
          mensajeError: input.mensajeError ?? null,
        },
      });
    }

    // Si es primer cobro (PENDIENTE), pasamos a FALLIDA inmediatamente.
    // Si es recurrente (ACTIVA), dejamos que OpenPay reintente y el cron
    // sync detecte tras 3 intentos sin éxito.
    if (sus.estado === "PENDIENTE") {
      await tx.suscripcion.update({
        where: { id: sus.id },
        data: { estado: "FALLIDA", activa: false },
      });
    }
  });

  void track({
    evento: "premium_pago_fallido",
    userId: sus.usuarioId,
    props: {
      suscripcionId: sus.id,
      openpayCobroId: input.openpayCobroId,
      codigoError: input.codigoError ?? null,
    },
  });

  // Email al usuario solo si fue el primer cobro (PENDIENTE → FALLIDA).
  // Recurrentes los notifica el cron sync cuando agota retries.
  if (sus.estado === "PENDIENTE" && sus.usuario) {
    void retryConBackoff(
      () =>
        enviarEmailFalloPago({
          email: sus.usuario.email,
          nombre: sus.usuario.nombre,
          motivo: input.mensajeError ?? "Tu tarjeta fue rechazada por la pasarela.",
        }),
      { intentos: 3, label: "email-fallo-pago-premium" },
    ).catch((err) => {
      logger.error(
        { err, suscripcionId: sus.id, source: "suscripciones:rechazo" },
        "registrarPagoFallido: email falló",
      );
    });
  }

  logger.warn(
    {
      suscripcionId: sus.id,
      openpayCobroId: input.openpayCobroId,
      codigoError: input.codigoError,
      source: "suscripciones:rechazo",
    },
    "registrarPagoFallido: cobro rechazado",
  );
}

// -----------------------------------------------------------------------
// Cancelar suscripción — usuario lo dispara desde /premium/mi-suscripcion
// -----------------------------------------------------------------------

/**
 * Cancela en OpenPay (no más cobros) y marca la suscripción local como
 * CANCELANDO. El acceso al Channel se mantiene hasta `vencimiento` — el
 * cron sync transiciona a VENCIDA automáticamente.
 *
 * Idempotencia: si ya está cancelada, retorna { ok: true } sin tocar nada.
 */
export async function cancelarSuscripcion(input: {
  suscripcionId: string;
  usuarioId: string;
  motivo?: string;
}): Promise<{ ok: true; vencimiento: Date | null }> {
  const sus = await prisma.suscripcion.findUnique({
    where: { id: input.suscripcionId },
  });
  if (!sus) {
    throw new ValidacionFallida("Suscripción no encontrada");
  }
  if (sus.usuarioId !== input.usuarioId) {
    throw new NoAutorizado("No puedes cancelar la suscripción de otro usuario");
  }

  // Idempotencia: ya cancelada.
  if (sus.cancelada) {
    return { ok: true, vencimiento: sus.vencimiento };
  }

  if (sus.openpaySuscripcionId) {
    try {
      const openpay = new OpenPayAdapter();
      await openpay.cancelarSuscripcion(sus.openpaySuscripcionId);
    } catch (err) {
      logger.error(
        { err, suscripcionId: sus.id, source: "suscripciones:cancelar" },
        "cancelarSuscripcion: OpenPay cancel falló (continuamos local)",
      );
      // No bloqueamos la cancelación local. El admin puede limpiar manual.
    }
  }

  await prisma.suscripcion.update({
    where: { id: sus.id },
    data: {
      estado: "CANCELANDO",
      cancelada: true,
      canceladaEn: new Date(),
      motivoCancela: input.motivo ?? null,
      // activa SIGUE en true hasta el cron sync (procesa al pasar `vencimiento`).
    },
  });

  void track({
    evento: "premium_cancelado",
    userId: input.usuarioId,
    props: {
      suscripcionId: sus.id,
      plan: sus.plan,
      motivo: input.motivo ?? null,
      diasUsados:
        Math.floor((Date.now() - sus.iniciada.getTime()) / (1000 * 60 * 60 * 24)),
    },
  });

  logger.info(
    {
      suscripcionId: sus.id,
      usuarioId: input.usuarioId,
      vencimiento: sus.vencimiento,
      source: "suscripciones",
    },
    "cancelarSuscripcion: marcada CANCELANDO",
  );

  return { ok: true, vencimiento: sus.vencimiento };
}

// -----------------------------------------------------------------------
// Reembolsar en garantía 7 días
// -----------------------------------------------------------------------

/**
 * Reembolso completo del último pago. Solo permitido si `enGarantia=true`
 * (primeros 7 días desde la activación). Marca la suscripción como
 * REEMBOLSADA + activa=false + remueve del Channel.
 *
 * Llamado por: endpoint admin `POST /api/v1/admin/suscripciones/[id]/reembolsar`
 * (Lote F) o por el endpoint del usuario si decidimos exponerlo en self-service.
 */
export async function reembolsarEnGarantia(input: {
  suscripcionId: string;
  /** Email del admin que aprueba (auditoría). Opcional si self-service. */
  aprobadoPor?: string;
}): Promise<{ ok: true }> {
  const sus = await prisma.suscripcion.findUnique({
    where: { id: input.suscripcionId },
    include: {
      pagos: { orderBy: { fecha: "desc" }, take: 1 },
      usuario: true,
    },
  });
  if (!sus) {
    throw new ValidacionFallida("Suscripción no encontrada");
  }
  if (!sus.enGarantia) {
    throw new ValidacionFallida(
      "Esta suscripción está fuera de la garantía de 7 días.",
    );
  }
  if (sus.estado === "REEMBOLSADA") {
    return { ok: true }; // Idempotente
  }
  const ultimoPago = sus.pagos[0];
  if (!ultimoPago || ultimoPago.estado !== "PAGADO") {
    throw new ValidacionFallida(
      "No hay pago acreditado para reembolsar (estado actual: " +
        (ultimoPago?.estado ?? "ninguno") +
        ")",
    );
  }

  // Reembolsar en OpenPay. Si falla, no marcamos REEMBOLSADA.
  const openpay = new OpenPayAdapter();
  await openpay.reembolsar(ultimoPago.openpayCobroId);

  await prisma.$transaction(async (tx) => {
    await tx.suscripcion.update({
      where: { id: sus.id },
      data: {
        estado: "REEMBOLSADA",
        activa: false,
        reembolsoPedido: true,
        reembolsoEn: new Date(),
      },
    });
    await tx.pagoSuscripcion.update({
      where: { id: ultimoPago.id },
      data: { estado: "REEMBOLSADO" },
    });
    await tx.miembroChannel.updateMany({
      where: { suscripcionId: sus.id, estado: { in: ["INVITADO", "REINVITADO", "UNIDO"] } },
      data: { estado: "REMOVIDO", removidoEn: new Date() },
    });
  });

  void track({
    evento: "premium_reembolsado",
    userId: sus.usuarioId,
    props: {
      suscripcionId: sus.id,
      monto: ultimoPago.monto,
      aprobadoPor: input.aprobadoPor ?? null,
    },
  });

  if (sus.usuario) {
    void retryConBackoff(
      () =>
        enviarEmailReembolso({
          email: sus.usuario.email,
          nombre: sus.usuario.nombre,
          monto: ultimoPago.monto,
        }),
      { intentos: 3, label: "email-reembolso-premium" },
    ).catch((err) => {
      logger.error(
        { err, suscripcionId: sus.id, source: "suscripciones:reembolso" },
        "reembolsarEnGarantia: email falló",
      );
    });
  }

  logger.info(
    {
      suscripcionId: sus.id,
      monto: ultimoPago.monto,
      aprobadoPor: input.aprobadoPor,
      source: "suscripciones",
    },
    "reembolsarEnGarantia: ok",
  );

  return { ok: true };
}

// -----------------------------------------------------------------------
// Helpers para crons
// -----------------------------------------------------------------------

/**
 * Lista suscripciones activas que ya pasaron `vencimiento`. Usado por el
 * cron sync para marcar VENCIDA.
 */
export async function listarVencidas(): Promise<PrismaSuscripcion[]> {
  return prisma.suscripcion.findMany({
    where: {
      activa: true,
      cancelada: false,
      vencimiento: { lt: new Date() },
    },
  });
}

/**
 * Lista suscripciones canceladas con vencimiento pasado (cancelaciones
 * efectivas). Usado por el cron sync.
 */
export async function listarCancelacionesEfectivas(): Promise<
  PrismaSuscripcion[]
> {
  return prisma.suscripcion.findMany({
    where: {
      cancelada: true,
      activa: true,
      vencimiento: { lt: new Date() },
    },
  });
}

/**
 * Marca como VENCIDA (sin acceso al Channel). Atómico con miembroChannel.
 */
export async function marcarVencida(suscripcionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.suscripcion.update({
      where: { id: suscripcionId },
      data: { estado: PrismaEstadoSuscripcion.VENCIDA, activa: false },
    });
    await tx.miembroChannel.updateMany({
      where: {
        suscripcionId,
        estado: { in: ["INVITADO", "REINVITADO", "UNIDO"] },
      },
      data: { estado: "REMOVIDO", removidoEn: new Date() },
    });
  });
}

/**
 * Marca como cancelación efectiva (acceso revocado). Atómico con miembroChannel.
 * Diferencia con `marcarVencida`: el estado queda CANCELANDO (no VENCIDA),
 * porque conceptualmente el user pidió cancelar, no que se le venciera.
 */
export async function marcarCancelacionEfectiva(
  suscripcionId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.suscripcion.update({
      where: { id: suscripcionId },
      data: { activa: false },
    });
    await tx.miembroChannel.updateMany({
      where: {
        suscripcionId,
        estado: { in: ["INVITADO", "REINVITADO", "UNIDO"] },
      },
      data: { estado: "REMOVIDO", removidoEn: new Date() },
    });
  });
}

/**
 * Lista suscripciones cuya garantía debería expirar. El cron sync llama
 * `expirarGarantias()` para flippear `enGarantia=false` después de 7 días.
 */
export async function expirarGarantias(): Promise<number> {
  const haceSieteDias = new Date();
  haceSieteDias.setDate(haceSieteDias.getDate() - 7);
  const result = await prisma.suscripcion.updateMany({
    where: {
      enGarantia: true,
      iniciada: { lt: haceSieteDias },
      activa: true,
    },
    data: { enGarantia: false },
  });
  return result.count;
}
