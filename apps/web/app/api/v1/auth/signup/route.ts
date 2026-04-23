// POST /api/v1/auth/signup
//
// Registro formal email (Abr 2026). Crea usuario en BD con username
// definitivo + `usernameLocked=true` + `tycAceptadosAt=now` + bonus 500
// Lukas (BONUS, sin vencimiento) en una transacción atómica. No dispara
// el magic link — eso lo hace el cliente con `signIn("resend")` tras
// recibir `ok: true`.
//
// Body: { email, username, aceptaTyc }
// Respuesta OK: { ok: true, data: { email } }
// Errores: USERNAME_EN_USO (409), EMAIL_EN_USO (409), USERNAME_RESERVADO
// (409), VALIDACION_FALLIDA (400).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@habla/db";
import {
  DomainError,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { esReservado } from "@/lib/config/usernames-reservados";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const BONUS_BIENVENIDA_LUKAS = 500;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const SignupSchema = z.object({
  email: z
    .string()
    .email("Email inválido.")
    .transform((s) => s.trim().toLowerCase()),
  username: z
    .string()
    .transform((s) => s.trim().toLowerCase()),
  aceptaTyc: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const { email, username, aceptaTyc } = parsed.data;

    if (!aceptaTyc) {
      throw new ValidacionFallida(
        "Debes aceptar los Términos y confirmar que sos mayor de 18 años.",
        { field: "aceptaTyc" },
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      throw new ValidacionFallida(
        "El usuario debe tener 3-20 caracteres (letras minúsculas, números o guión bajo).",
        { field: "username" },
      );
    }

    if (esReservado(username)) {
      throw new DomainError(
        "USERNAME_RESERVADO",
        "Ese nombre de usuario no está disponible.",
        409,
        { field: "username" },
      );
    }

    // Verificar ambos campos únicos antes de crear para dar error claro.
    const [emailExistente, usernameExistente] = await Promise.all([
      prisma.usuario.findUnique({ where: { email }, select: { id: true } }),
      prisma.usuario.findUnique({
        where: { username },
        select: { id: true },
      }),
    ]);

    if (emailExistente) {
      throw new DomainError(
        "EMAIL_EN_USO",
        "Ya existe una cuenta con ese email. Iniciá sesión.",
        409,
        { field: "email" },
      );
    }
    if (usernameExistente) {
      throw new DomainError(
        "USERNAME_EN_USO",
        "Ese nombre de usuario ya está tomado.",
        409,
        { field: "username" },
      );
    }

    // Crear usuario + transacción BONUS atómica.
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email,
          // Nombre inicial igual al username — el usuario puede editarlo
          // después en /perfil. Esto evita dejar el campo vacío si Google
          // no devuelve nombre y dar un valor reconocible.
          nombre: username,
          username,
          usernameLocked: true,
          tycAceptadosAt: new Date(),
          balanceLukas: BONUS_BIENVENIDA_LUKAS,
        },
      });
      await tx.transaccionLukas.create({
        data: {
          usuarioId: usuario.id,
          tipo: "BONUS",
          monto: BONUS_BIENVENIDA_LUKAS,
          descripcion: "Bonus de bienvenida",
          venceEn: null,
        },
      });
    });

    logger.info({ email, username }, "signup email completado");

    return Response.json({ ok: true, data: { email } });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error({ err }, "POST /auth/signup falló");
    }
    return toErrorResponse(err);
  }
}
