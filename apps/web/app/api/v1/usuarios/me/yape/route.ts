// PATCH /api/v1/usuarios/me/yape — Lote U v3.2.
//
// Captura/actualiza el yapeNumero del usuario logueado. Diseñado para que
// los ganadores del Top 10 mensual de la Liga Habla! puedan cobrar el
// premio.
//
// Decisión §1.3 del análisis-repo-vs-mockup-v3.2: el premio es publicitario
// (S/1,250/mes en pagos por Yape, no renta laboral) — datos mínimos: nombre
// (ya existente) + yapeNumero. NO se pide DNI, NO se pide cuenta bancaria.
//
// Validación de formato: número peruano de 9 dígitos que empieza con "9"
// (formato Yape — los celulares peruanos móviles arrancan con "9"). Se
// guarda sin prefijo "+51" para consistencia con la columna existente.
// El cliente puede pasar el número con o sin espacios; lo normalizamos.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

// 9 dígitos, primero "9" — patrón de número Yape válido en Perú.
const YAPE_REGEX = /^9\d{8}$/;

const Body = z.object({
  yapeNumero: z
    .string()
    .min(9)
    .max(20)
    .transform((v) => v.replace(/\D/g, "")) // dejá solo dígitos
    .refine((v) => YAPE_REGEX.test(v), {
      message: "Número Yape inválido (debe ser celular peruano: 9 dígitos empezando con 9).",
    }),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Número Yape inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { yapeNumero: parsed.data.yapeNumero },
    });

    logger.info(
      { usuarioId: session.user.id },
      "yapeNumero actualizado por el usuario",
    );

    return Response.json({ data: { ok: true } });
  } catch (err) {
    logger.error({ err }, "PATCH /usuarios/me/yape falló");
    return toErrorResponse(err);
  }
}
