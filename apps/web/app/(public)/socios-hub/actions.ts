"use server";

// Server actions para gestión de suscripción Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.
//
// Acciones expuestas:
//   - cancelarMiSuscripcion(motivo?): cancela en OpenPay + marca local.
//   - reactivarMiSuscripcion(): reactiva una suscripción CANCELANDO antes
//     de que pase la fecha de vencimiento.
//
// Cambio de plan se difiere a Lote F (operación admin → propaga al user)
// porque OpenPay requiere recrear la suscripción y preservar el saldo
// proporcional, lógica más compleja que se aborda con el dashboard admin.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { cancelarSuscripcion } from "@/lib/services/suscripciones.service";
import { logger } from "@/lib/services/logger";
import { track } from "@/lib/services/analytics.service";

const motivoSchema = z.string().max(200).optional();

export interface CancelarResult {
  ok: boolean;
  error?: string;
  vencimiento?: string | null;
}

export async function cancelarMiSuscripcion(
  motivo?: string,
): Promise<CancelarResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Tu sesión expiró." };
  }

  const motivoSan = motivoSchema.safeParse(motivo).success ? motivo : undefined;

  // Encontrar suscripción activa del usuario.
  const sus = await prisma.suscripcion.findFirst({
    where: { usuarioId: session.user.id, activa: true, cancelada: false },
    orderBy: { iniciada: "desc" },
  });
  if (!sus) {
    return { ok: false, error: "No tienes una suscripción activa." };
  }

  try {
    const result = await cancelarSuscripcion({
      suscripcionId: sus.id,
      usuarioId: session.user.id,
      motivo: motivoSan,
    });
    revalidatePath("/socios-hub");
    return {
      ok: true,
      vencimiento: result.vencimiento?.toISOString() ?? null,
    };
  } catch (err) {
    logger.error(
      { err, suscripcionId: sus.id, source: "premium-mi-suscripcion" },
      "cancelarMiSuscripcion: fallo",
    );
    return {
      ok: false,
      error:
        "No pudimos procesar la cancelación. Intenta de nuevo o contacta soporte.",
    };
  }
}

export interface ReactivarResult {
  ok: boolean;
  error?: string;
}

/**
 * Reactiva la suscripción si todavía no venció (cancelada=true pero
 * vencimiento futuro). Quita la marca de cancelada para que el cron sync
 * no la suspenda al pasar `vencimiento` y siga renovándose.
 *
 * Nota: si la suscripción ya pasó por OpenPay con cancelación efectiva,
 * habría que recrearla. Esa lógica vive en Lote F (admin) — aquí solo el
 * caso "todavía dentro del periodo".
 */
export async function reactivarMiSuscripcion(): Promise<ReactivarResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Tu sesión expiró." };
  }

  const sus = await prisma.suscripcion.findFirst({
    where: {
      usuarioId: session.user.id,
      cancelada: true,
      activa: true,
    },
    orderBy: { iniciada: "desc" },
  });
  if (!sus) {
    return {
      ok: false,
      error: "No hay suscripción cancelada elegible para reactivar.",
    };
  }
  if (sus.vencimiento && sus.vencimiento.getTime() < Date.now()) {
    return {
      ok: false,
      error:
        "Tu suscripción ya venció. Suscríbete de nuevo desde /premium.",
    };
  }

  try {
    await prisma.suscripcion.update({
      where: { id: sus.id },
      data: {
        cancelada: false,
        canceladaEn: null,
        motivoCancela: null,
        estado: "ACTIVA",
      },
    });

    void track({
      evento: "premium_reactivado",
      userId: session.user.id,
      props: { suscripcionId: sus.id, plan: sus.plan },
    });

    revalidatePath("/socios-hub");
    return { ok: true };
  } catch (err) {
    logger.error(
      { err, suscripcionId: sus.id, source: "premium-mi-suscripcion" },
      "reactivarMiSuscripcion: fallo",
    );
    return {
      ok: false,
      error: "No pudimos reactivar. Intenta de nuevo o contacta soporte.",
    };
  }
}
