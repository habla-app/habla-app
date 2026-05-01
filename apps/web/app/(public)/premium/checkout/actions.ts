"use server";

// Server actions del checkout Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/checkout.spec.md.
//
// `procesarCheckout` recibe el `tokenTarjeta` ya generado por OpenPay.js
// client-side. Backend NUNCA toca PAN/CVV. Llama a `crearSuscripcion` del
// servicio de suscripciones (Lote E) que se encarga de OpenPay + BD.
//
// Si OpenPay aún no está configurado (env vars vacías), `crearSuscripcion`
// lanza `OpenPayNoConfigurado` y devolvemos un error claro al cliente.

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  crearSuscripcion,
  type PlanSuscripcion,
} from "@/lib/services/suscripciones.service";
import { OpenPayNoConfigurado } from "@/lib/services/pasarela-pagos/openpay-adapter";
import { ValidacionFallida } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const checkoutSchema = z.object({
  plan: z.enum(["mensual", "trimestral", "anual"]),
  tokenTarjeta: z.string().min(1, "tokenTarjeta requerido"),
  deviceSessionId: z.string().min(1, "deviceSessionId requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  documentoTipo: z.enum(["DNI", "RUC", "CE"]),
  documentoNumero: z.string().min(6, "Documento inválido"),
  telefono: z.string().nullable(),
});

export interface ProcesarCheckoutResult {
  ok: boolean;
  /** Solo si ok=true. */
  suscripcionId?: string;
  /** Mensaje user-facing si ok=false. */
  error?: string;
  /** Código corto para tracking. */
  code?: string;
}

export async function procesarCheckout(
  raw: unknown,
): Promise<ProcesarCheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Tu sesión expiró. Vuelve a iniciar sesión y reintenta.",
      code: "no_session",
    };
  }

  const parse = checkoutSchema.safeParse(raw);
  if (!parse.success) {
    logger.warn(
      { source: "premium-checkout", issues: parse.error.issues },
      "procesarCheckout: input inválido",
    );
    return {
      ok: false,
      error: "Datos del formulario inválidos. Revisa los campos.",
      code: "validation",
    };
  }
  const data = parse.data;

  // Persistir el teléfono si lo proveyó (no bloquea checkout si falla).
  if (data.telefono) {
    try {
      await prisma.usuario.update({
        where: { id: session.user.id },
        data: { telefono: data.telefono },
      });
    } catch (err) {
      logger.warn(
        { err, userId: session.user.id, source: "premium-checkout" },
        "procesarCheckout: no se pudo persistir telefono (continuando)",
      );
    }
  }

  try {
    const suscripcion = await crearSuscripcion({
      usuarioId: session.user.id,
      plan: data.plan as PlanSuscripcion,
      tokenTarjeta: data.tokenTarjeta,
      deviceSessionId: data.deviceSessionId,
      nombre: data.nombre,
      email: session.user.email ?? "",
    });
    return { ok: true, suscripcionId: suscripcion.id };
  } catch (err) {
    if (err instanceof OpenPayNoConfigurado) {
      return {
        ok: false,
        error:
          "Los pagos no están disponibles temporalmente. Suscríbete al newsletter para que te avisemos.",
        code: "no_configurado",
      };
    }
    if (err instanceof ValidacionFallida) {
      return { ok: false, error: err.message, code: "validation" };
    }
    // OpenPayApiError u otra excepción — el adapter loggea el detalle.
    logger.error(
      { err, userId: session.user.id, plan: data.plan, source: "premium-checkout" },
      "procesarCheckout: crearSuscripcion falló",
    );
    return {
      ok: false,
      error:
        "No pudimos procesar tu pago. Verifica los datos de tu tarjeta o intenta con otra.",
      code: "openpay_error",
    };
  }
}
